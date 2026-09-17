import { describe, expect, it } from 'vitest'
import { captionFor, isValidPhone, normalisePhone } from './share'
import { makeGarment } from './testFixtures'
import type { Outfit } from '../types'

describe('normalisePhone', () => {
  it('strips formatting but keeps a leading plus', () => {
    expect(normalisePhone(' +1 (555) 012-3456 ')).toBe('+15550123456')
    expect(normalisePhone('555.012.3456')).toBe('5550123456')
  })
})

describe('isValidPhone', () => {
  it('accepts plausible numbers and rejects the rest', () => {
    expect(isValidPhone('+1 555 012 3456')).toBe(true)
    expect(isValidPhone('5550123')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
    expect(isValidPhone('1234567890123456789')).toBe(false)
    expect(isValidPhone('')).toBe(false)
  })
})

describe('captionFor', () => {
  const garments = [
    makeGarment('Blazer', { id: 'a', label: 'black blazer' }),
    makeGarment('Jeans', { id: 'b', label: 'indigo jeans' }),
  ]
  const outfit: Outfit = {
    id: 'fit_1',
    itemIds: ['a', 'b', 'missing'],
    roles: {},
    accessories: [],
    palette: [],
    score: 0.8,
    breakdown: { context: 1, climate: 1, color: 1, vibe: 1, silhouette: 1, daring: 1 },
    headline: 'Tonal black',
    rationale: [],
    moves: [],
    vibeMatch: ['tailored and crisp'],
    warnings: [],
    context: 'work',
    origin: 'generated',
    saved: true,
    createdAt: 0,
  }

  it('names the pieces it can find and skips the ones it cannot', () => {
    const caption = captionFor(outfit, garments)
    expect(caption).toContain('black blazer · indigo jeans')
    expect(caption).not.toContain('missing')
  })

  it('includes the vibe and the sustainability tags', () => {
    const caption = captionFor(outfit, garments)
    expect(caption).toContain('tailored and crisp')
    expect(caption).toContain('#wornagain')
  })
})
