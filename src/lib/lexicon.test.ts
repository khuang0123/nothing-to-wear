import { describe, expect, it } from 'vitest'
import { NEUTRAL_VIBE, parseVibe } from './lexicon'

describe('parseVibe', () => {
  it('returns neutral axes for text it knows nothing about', () => {
    const { axes, matched } = parseVibe('zxqv')
    expect(matched).toEqual([])
    expect(axes).toEqual(NEUTRAL_VIBE)
  })

  it('reads a single term', () => {
    const { axes, matched } = parseVibe('sexy')
    expect(matched).toHaveLength(1)
    expect(axes.skin).toBeGreaterThan(0.7)
  })

  it('blends two terms instead of letting the last one win', () => {
    const sexy = parseVibe('sexy').axes
    const smart = parseVibe('smart').axes
    const both = parseVibe('sexy but smart').axes
    expect(both.skin).toBeLessThan(sexy.skin)
    expect(both.skin).toBeGreaterThan(smart.skin)
    expect(both.formality).toBeGreaterThan(NEUTRAL_VIBE.formality)
  })

  it('mirrors a negated term across neutral rather than ignoring it', () => {
    const plain = parseVibe('sexy').axes
    const negated = parseVibe('not sexy').axes
    expect(plain.skin).toBeGreaterThan(0.5)
    expect(negated.skin).toBeLessThan(0.5)
    expect(parseVibe('not sexy').matched[0]).toMatch(/^not /)
  })

  it('weights an intensified term more heavily than a softened one', () => {
    const veryLoud = parseVibe('very loud, smart').axes
    const slightlyLoud = parseVibe('slightly loud, smart').axes
    expect(veryLoud.boldness).toBeGreaterThan(slightlyLoud.boldness)
  })

  it('keeps formality inside the 1-5 scale and other axes inside 0-1', () => {
    const { axes } = parseVibe('very fierce very expensive very maximal very sexy')
    expect(axes.formality).toBeGreaterThanOrEqual(1)
    expect(axes.formality).toBeLessThanOrEqual(5)
    for (const key of ['boldness', 'skin', 'structure', 'saturation', 'contrast', 'texture', 'polish'] as const) {
      expect(axes[key], key).toBeGreaterThanOrEqual(0)
      expect(axes[key], key).toBeLessThanOrEqual(1)
    }
  })

  it('reports words it could not map so the UI can admit it', () => {
    const { unmapped } = parseVibe('sexy but hyperborean')
    expect(unmapped).toContain('hyperborean')
    expect(unmapped).not.toContain('sexy')
  })

  it('matches inside longer words', () => {
    expect(parseVibe('flirty').matched).toHaveLength(1)
    expect(parseVibe('minimalist').matched).toHaveLength(1)
  })

  it('treats modest as the coverage-forward end', () => {
    expect(parseVibe('modest').axes.skin).toBeLessThan(0.2)
  })
})
