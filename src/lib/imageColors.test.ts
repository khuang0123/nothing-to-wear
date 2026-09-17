import { describe, expect, it } from 'vitest'
import { dominantColorsFromPixels, samplePixels } from './imageColors'
import { hexToHsl } from './color'

/** Build RGBA image data: left half colour A, right half colour B. */
function splitImage(a: [number, number, number], b: [number, number, number], w = 16, h = 16) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const [r, g, bl] = x < w / 2 ? a : b
      data[i] = r
      data[i + 1] = g
      data[i + 2] = bl
      data[i + 3] = 255
    }
  }
  return { data, w, h }
}

describe('samplePixels', () => {
  it('weights the centre above the edges', () => {
    const { data, w, h } = splitImage([200, 30, 30], [30, 30, 200])
    const pixels = samplePixels(data, w, h)
    expect(pixels).toHaveLength(w * h)
    const centre = pixels[Math.floor(pixels.length / 2)]
    expect(centre.w).toBeGreaterThan(pixels[0].w)
  })

  it('de-weights blown-out and crushed pixels', () => {
    const { data, w, h } = splitImage([255, 255, 255], [0, 0, 0])
    const pixels = samplePixels(data, w, h)
    expect(pixels.every((p) => p.w <= 0.06)).toBe(true)
  })

  it('skips transparent pixels', () => {
    const { data, w, h } = splitImage([120, 60, 60], [60, 60, 120])
    for (let i = 3; i < data.length; i += 4) data[i] = 0
    expect(samplePixels(data, w, h)).toHaveLength(0)
  })
})

describe('dominantColorsFromPixels', () => {
  it('recovers the two colours in a split image', () => {
    const { data, w, h } = splitImage([190, 40, 40], [40, 40, 190])
    const colors = dominantColorsFromPixels(samplePixels(data, w, h), 2)
    expect(colors).toHaveLength(2)
    const hues = colors.map((c) => hexToHsl(c).h).sort((x, y) => x - y)
    expect(hues[0]).toBeGreaterThan(350 - 360 + 360 - 360) // red near 0
    expect(hues[0]).toBeLessThan(20)
    expect(hues[1]).toBeGreaterThan(200)
    expect(hues[1]).toBeLessThan(260)
  })

  it('returns a single colour for a flat image without crashing', () => {
    const { data, w, h } = splitImage([120, 100, 80], [120, 100, 80])
    const colors = dominantColorsFromPixels(samplePixels(data, w, h), 3)
    expect(colors.length).toBeGreaterThanOrEqual(1)
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is deterministic for the same input', () => {
    const { data, w, h } = splitImage([190, 40, 40], [40, 190, 90])
    const once = dominantColorsFromPixels(samplePixels(data, w, h), 3)
    const twice = dominantColorsFromPixels(samplePixels(data, w, h), 3)
    expect(once).toEqual(twice)
  })

  it('falls back to a grey rather than throwing on empty input', () => {
    expect(dominantColorsFromPixels([], 3)).toEqual(['#8a8a8a'])
  })
})
