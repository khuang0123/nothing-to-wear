/**
 * Colour maths for the stylist. No dependencies: hex in, hex out.
 *
 * The engine needs three things from colour: can I name it, do two colours
 * relate in a way a human would call intentional, and what third colour would
 * a stylist reach for.
 */

export interface Hsl {
  h: number // 0-359
  s: number // 0-100
  l: number // 0-100
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function hexToHsl(hex: string): Hsl {
  const [r8, g8, b8] = hexToRgb(hex)
  const r = r8 / 255
  const g = g8 / 255
  const b = b8 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: Math.round(h * 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x]
  const m = lN - c / 2
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255)
}

/** Blacks, whites, greys, and the beige/denim family that behaves like a neutral. */
export function isNeutral(hex: string): boolean {
  const { s, l } = hexToHsl(hex)
  if (s <= 14) return true
  if (l <= 14 || l >= 92) return true
  const { h } = hexToHsl(hex)
  const beige = h >= 20 && h <= 45 && s <= 32
  return beige
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export type ColorRelation =
  | 'monochrome'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'neutral-anchored'
  | 'clash'

export function relationBetween(a: string, b: string): ColorRelation {
  if (isNeutral(a) || isNeutral(b)) {
    if (isNeutral(a) && isNeutral(b)) {
      const la = hexToHsl(a).l
      const lb = hexToHsl(b).l
      return Math.abs(la - lb) < 18 ? 'monochrome' : 'neutral-anchored'
    }
    return 'neutral-anchored'
  }
  const d = hueDistance(hexToHsl(a).h, hexToHsl(b).h)
  if (d <= 18) return 'monochrome'
  if (d <= 45) return 'analogous'
  if (d >= 150) return 'complementary'
  if (d >= 100 && d < 150) return 'triadic'
  return 'clash'
}

/**
 * How "resolved" a pairing looks to an average eye. Clash is deliberately low —
 * the stylist inverts this score for high-adventurousness users, where a clash
 * is the point rather than a mistake.
 */
export function harmonyScore(a: string, b: string): number {
  switch (relationBetween(a, b)) {
    case 'monochrome':
      return 0.82
    case 'analogous':
      return 0.9
    case 'neutral-anchored':
      return 0.95
    case 'complementary':
      return 0.78
    case 'triadic':
      return 0.6
    case 'clash':
      return 0.25
  }
}

/** Average pairwise harmony across an outfit's colours. */
export function paletteHarmony(colors: string[]): number {
  const pairs: number[] = []
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      pairs.push(harmonyScore(colors[i], colors[j]))
    }
  }
  if (pairs.length === 0) return 0.7
  return pairs.reduce((a, b) => a + b, 0) / pairs.length
}

const HUE_NAMES: Array<[number, string]> = [
  [15, 'red'],
  [40, 'orange'],
  [65, 'yellow'],
  [95, 'chartreuse'],
  [150, 'green'],
  [185, 'teal'],
  [235, 'blue'],
  [265, 'indigo'],
  [290, 'violet'],
  [330, 'magenta'],
  [360, 'red'],
]

export function colorName(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  if (l >= 93) return 'off-white'
  if (l <= 12) return 'black'
  if (s <= 12) return l > 60 ? 'light grey' : l > 35 ? 'grey' : 'charcoal'
  const base = HUE_NAMES.find(([edge]) => h < edge)?.[1] ?? 'red'
  if (h >= 20 && h <= 45 && s <= 40) return l >= 75 ? 'cream' : l >= 45 ? 'camel' : 'brown'
  const tone = l >= 72 ? 'pale ' : l <= 28 ? 'deep ' : s >= 70 ? 'vivid ' : ''
  return `${tone}${base}`
}

/** A colour a stylist would add as the third note: the accessory / accent pick. */
export function accentFor(colors: string[], adventurousness: number): string {
  const chromatic = colors.filter((c) => !isNeutral(c))
  if (chromatic.length === 0) {
    // All-neutral fit: the accent is the only colour in the look, so make it count.
    return adventurousness > 55 ? '#e0483c' : '#8c6b4f'
  }
  const base = hexToHsl(chromatic[0])
  if (adventurousness > 66) {
    // Go opposite and loud.
    return hslToHex({ h: (base.h + 165) % 360, s: Math.min(92, base.s + 22), l: 52 })
  }
  if (adventurousness > 33) {
    return hslToHex({ h: (base.h + 38) % 360, s: Math.max(30, base.s - 8), l: 46 })
  }
  // Conservative: stay in family, shift value not hue.
  return hslToHex({ h: base.h, s: Math.max(12, base.s - 25), l: base.l > 50 ? 28 : 74 })
}

export function buildPalette(colors: string[], adventurousness: number) {
  const unique: string[] = []
  for (const c of colors) {
    if (!unique.some((u) => contrastRatio(u, c) < 1.12)) unique.push(c)
  }
  const accent = accentFor(unique, adventurousness)
  return [
    ...unique.slice(0, 3).map((hex, i) => ({
      hex,
      role: (i === 0 ? 'anchor' : 'secondary') as 'anchor' | 'secondary',
      name: colorName(hex),
    })),
    { hex: accent, role: 'accent' as const, name: colorName(accent) },
  ]
}
