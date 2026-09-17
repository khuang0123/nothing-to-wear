/**
 * Pull the dominant garment colours out of a photo, in the browser, with no
 * upload. Centre-weighted k-means over a downsampled canvas: the garment is
 * usually what the camera is pointed at, so pixels near the middle count more
 * and near-white/near-black border pixels (walls, shadow) count less.
 */

const SAMPLE_SIZE = 64
const ITERATIONS = 8

interface Px {
  r: number
  g: number
  b: number
  w: number
}

export function samplePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Px[] {
  const pixels: Px[] = []
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.hypot(cx, cy)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const alpha = data[i + 3]
      if (alpha < 200) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const lum = (r + g + b) / 3
      // De-weight blown-out and crushed pixels: usually background, not fabric.
      const tonal = lum > 246 || lum < 9 ? 0.05 : 1
      const dist = Math.hypot(x - cx, y - cy) / maxDist
      const centre = 1 - 0.65 * dist
      pixels.push({ r, g, b, w: tonal * centre })
    }
  }
  return pixels
}

function toHex(r: number, g: number, b: number) {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Weighted k-means in RGB. Deterministic seeding so the same photo gives the same tags. */
export function dominantColorsFromPixels(pixels: Px[], k = 3): string[] {
  const usable = pixels.filter((p) => p.w > 0.2)
  const pool = usable.length > 20 ? usable : pixels
  if (pool.length === 0) return ['#8a8a8a']

  // Deterministic farthest-point seeding. Seeding by brightness would collapse
  // whenever two garment colours happen to share a channel sum (red vs blue).
  const totalW = pool.reduce((s, p) => s + p.w, 0)
  const mean = {
    r: pool.reduce((s, p) => s + p.r * p.w, 0) / totalW,
    g: pool.reduce((s, p) => s + p.g * p.w, 0) / totalW,
    b: pool.reduce((s, p) => s + p.b * p.w, 0) / totalW,
  }
  let centroids = [mean]
  while (centroids.length < k) {
    let best = pool[0]
    let bestD = -1
    for (const p of pool) {
      let nearest = Infinity
      for (const c of centroids) {
        nearest = Math.min(nearest, (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2)
      }
      // Weight the distance so a large patch beats a single stray pixel.
      const d = nearest * p.w
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
    if (bestD <= 0) break
    centroids.push({ r: best.r, g: best.g, b: best.b })
  }

  let assignment = new Array<number>(pool.length).fill(0)
  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const d =
          (p.r - centroids[c].r) ** 2 + (p.g - centroids[c].g) ** 2 + (p.b - centroids[c].b) ** 2
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      if (assignment[i] !== best) moved = true
      assignment[i] = best
    }
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, w: 0 }))
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      const s = sums[assignment[i]]
      s.r += p.r * p.w
      s.g += p.g * p.w
      s.b += p.b * p.w
      s.w += p.w
    }
    centroids = centroids.map((c, i) =>
      sums[i].w > 0 ? { r: sums[i].r / sums[i].w, g: sums[i].g / sums[i].w, b: sums[i].b / sums[i].w } : c,
    )
    if (!moved) break
  }

  const weights = centroids.map((_, i) =>
    pool.reduce((s, p, idx) => (assignment[idx] === i ? s + p.w : s), 0),
  )
  return centroids
    .map((c, i) => ({ hex: toHex(c.r, c.g, c.b), weight: weights[i] }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.hex)
}

/** Browser entry point: data URL in, hex list out. */
export async function extractColors(dataUrl: string, k = 3): Promise<string[]> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  const ratio = img.naturalWidth / img.naturalHeight || 1
  canvas.width = ratio >= 1 ? SAMPLE_SIZE : Math.max(8, Math.round(SAMPLE_SIZE * ratio))
  canvas.height = ratio >= 1 ? Math.max(8, Math.round(SAMPLE_SIZE / ratio)) : SAMPLE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ['#8a8a8a']
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return dominantColorsFromPixels(samplePixels(data, canvas.width, canvas.height), k)
}

/** Read a File (camera or gallery) into a downscaled data URL we can persist. */
export function fileToDataUrl(file: File, maxEdge = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = async () => {
      const raw = String(reader.result)
      try {
        const img = new Image()
        img.src = raw
        await img.decode()
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(raw)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        resolve(raw)
      }
    }
    reader.readAsDataURL(file)
  })
}

/** Grab a still from a playing <video> — the "FaceTiming a friend" capture path. */
export function frameFromVideo(video: HTMLVideoElement, maxEdge = 720): string | null {
  if (!video.videoWidth) return null
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
