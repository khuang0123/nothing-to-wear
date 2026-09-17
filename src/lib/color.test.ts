import { describe, expect, it } from 'vitest'
import {
  accentFor,
  buildPalette,
  colorName,
  contrastRatio,
  harmonyScore,
  hexToHsl,
  hslToHex,
  isNeutral,
  relationBetween,
} from './color'

describe('hsl conversion', () => {
  it('round-trips a saturated colour within rounding error', () => {
    const hex = '#c0392b'
    const back = hslToHex(hexToHsl(hex))
    const [a, b] = [hexToHsl(hex), hexToHsl(back)]
    expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.s - b.s)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.l - b.l)).toBeLessThanOrEqual(2)
  })

  it('handles shorthand hex and rubbish input', () => {
    expect(hexToHsl('#fff').l).toBe(100)
    expect(hexToHsl('nonsense').l).toBe(0)
  })
})

describe('isNeutral', () => {
  it('treats black, white, grey and beige as neutrals', () => {
    for (const hex of ['#000000', '#ffffff', '#7a7a7a', '#d8cfc0']) {
      expect(isNeutral(hex), hex).toBe(true)
    }
  })

  it('does not treat a saturated colour as neutral', () => {
    for (const hex of ['#c0392b', '#2e5bb8', '#3f9e4d']) {
      expect(isNeutral(hex), hex).toBe(false)
    }
  })
})

describe('relationBetween', () => {
  it('names the classic relationships', () => {
    expect(relationBetween('#c0392b', '#c9452f')).toBe('monochrome')
    expect(relationBetween('#c0392b', '#c98c2b')).toBe('analogous')
    expect(relationBetween('#c0392b', '#2bb3c0')).toBe('complementary')
    expect(relationBetween('#c0392b', '#d8cfc0')).toBe('neutral-anchored')
  })

  it('flags an awkward interval as a clash', () => {
    // ~70 degrees apart: too far to read as intentional, too close to read as opposition.
    expect(relationBetween('#c0392b', '#9ac02b')).toBe('clash')
  })

  it('scores a clash below every resolved relationship', () => {
    const clash = harmonyScore('#c0392b', '#9ac02b')
    for (const pair of [
      ['#c0392b', '#c98c2b'],
      ['#c0392b', '#2bb3c0'],
      ['#c0392b', '#d8cfc0'],
    ] as const) {
      expect(clash).toBeLessThan(harmonyScore(pair[0], pair[1]))
    }
  })
})

describe('colorName', () => {
  it('produces names a person would use', () => {
    expect(colorName('#ffffff')).toBe('off-white')
    expect(colorName('#000000')).toBe('black')
    expect(colorName('#7a7a7a')).toBe('grey')
    expect(colorName('#c9b28c')).toBe('camel')
    expect(colorName('#2e5bb8')).toContain('blue')
  })
})

describe('accentFor', () => {
  it('moves further from the base colour as the dial goes up', () => {
    const base = '#2e5bb8'
    const safe = hexToHsl(accentFor([base], 10))
    const wild = hexToHsl(accentFor([base], 90))
    const baseH = hexToHsl(base).h
    const dist = (h: number) => Math.min(Math.abs(h - baseH), 360 - Math.abs(h - baseH))
    expect(dist(wild.h)).toBeGreaterThan(dist(safe.h))
  })

  it('still returns an accent for an all-neutral outfit', () => {
    expect(accentFor(['#111111', '#eeeeee'], 20)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('buildPalette', () => {
  it('always ends with an accent and drops near-duplicates', () => {
    const palette = buildPalette(['#2e5bb8', '#2e5bb9', '#d8cfc0'], 50)
    expect(palette.at(-1)?.role).toBe('accent')
    expect(palette.filter((p) => p.role !== 'accent')).toHaveLength(2)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#c0392b', '#c0392b')).toBeCloseTo(1, 5)
  })
})
