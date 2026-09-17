import { describe, expect, it } from 'vitest'
import { analyseWardrobe, outfitCapacity, predictWardrobe, shoppingNeeds, slotCoverage } from './wardrobe'
import { demoGarments } from './demoCloset'
import { makeGarment, makeProfile } from './testFixtures'

const closet = demoGarments(1_700_000_000_000)
const profile = makeProfile()

describe('outfitCapacity', () => {
  it('is zero without shoes, however many clothes there are', () => {
    const noShoes = closet.filter((g) => g.category !== 'shoes')
    expect(noShoes.length).toBeGreaterThan(5)
    expect(outfitCapacity(noShoes, profile)).toBe(0)
  })

  it('grows when a connecting piece is added', () => {
    const base = [makeGarment('T-shirt'), makeGarment('Jeans'), makeGarment('Sneakers')]
    const before = outfitCapacity(base, profile)
    const after = outfitCapacity([...base, makeGarment('Tailored trousers', { id: 'extra' })], profile)
    expect(after).toBeGreaterThan(before)
  })

  it('ignores predicted pieces the user has not confirmed', () => {
    const base = [makeGarment('T-shirt'), makeGarment('Jeans'), makeGarment('Sneakers')]
    const withGuess = [
      ...base,
      makeGarment('Midi skirt', { id: 'guess', origin: 'predicted', confirmed: false }),
    ]
    expect(outfitCapacity(withGuess, profile)).toBe(outfitCapacity(base, profile))
  })
})

describe('slotCoverage', () => {
  it('reports the specific empty cells', () => {
    const { coverage, gaps } = slotCoverage([makeGarment('T-shirt'), makeGarment('Jeans')], profile)
    expect(coverage).toBeLessThan(0.5)
    expect(gaps.some((g) => g.includes('shoes'))).toBe(true)
  })

  it('requires a warm outer layer only in cold climates', () => {
    const items = [makeGarment('T-shirt'), makeGarment('Jeans'), makeGarment('Sneakers')]
    const cold = slotCoverage(items, makeProfile({ climate: 'cold' }))
    const hot = slotCoverage(items, makeProfile({ climate: 'hot' }))
    expect(cold.gaps).toContain('a warm outer layer')
    expect(hot.gaps).not.toContain('a warm outer layer')
  })
})

describe('analyseWardrobe', () => {
  it('calls a three-piece closet genuinely short and recommends something', () => {
    const report = analyseWardrobe([makeGarment('T-shirt'), makeGarment('Jeans'), makeGarment('Sneakers')], profile)
    expect(report.verdict).toBe('not-enough')
    expect(report.needs.length).toBeGreaterThan(0)
    expect(report.summary).toMatch(/second-hand/i)
  })

  it('does not tell a well-stocked closet to buy anything', () => {
    const report = analyseWardrobe(closet, profile)
    expect(report.verdict).not.toBe('not-enough')
    if (report.verdict === 'rich') expect(report.needs).toEqual([])
  })

  it('never recommends a piece that unlocks nothing', () => {
    for (const need of analyseWardrobe(closet, profile).needs) {
      expect(need.unlocks).toBeGreaterThan(0)
    }
  })
})

describe('shoppingNeeds', () => {
  it('leads with the piece that unlocks the most outfits', () => {
    const needs = shoppingNeeds([makeGarment('Blouse'), makeGarment('Tailored trousers'), makeGarment('Heels')], profile)
    expect(needs.length).toBeGreaterThan(0)
    const ranks = { critical: 0, high: 1, 'nice-to-have': 2 } as const
    for (let i = 1; i < needs.length; i++) {
      expect(ranks[needs[i].priority]).toBeGreaterThanOrEqual(ranks[needs[i - 1].priority])
    }
    expect(needs[0].reason).toMatch(/unlocks|no /i)
  })

  it('does not suggest something equivalent to what is already owned', () => {
    const needs = shoppingNeeds(closet, profile, 5)
    for (const need of needs) {
      const duplicate = closet.some(
        (g) => g.category === need.category && Math.abs(g.formality - need.formality) < 1 && Math.abs(g.warmth - need.warmth) < 1.5,
      )
      expect(duplicate, need.query).toBe(false)
    }
  })
})

describe('predictWardrobe', () => {
  it('guesses staples the closet implies and explains why', () => {
    const predictions = predictWardrobe([makeGarment('Blouse'), makeGarment('Tailored trousers'), makeGarment('Heels')], profile)
    expect(predictions.length).toBeGreaterThan(0)
    for (const p of predictions) {
      expect(p.garment.origin).toBe('predicted')
      expect(p.garment.confirmed).toBe(false)
      expect(p.why.length).toBeGreaterThan(10)
    }
  })

  it('does not guess a coat for someone in a hot climate', () => {
    const predictions = predictWardrobe(
      [makeGarment('T-shirt'), makeGarment('Shorts'), makeGarment('Sandals')],
      makeProfile({ climate: 'hot' }),
    )
    expect(predictions.some((p) => p.garment.label.includes('overcoat'))).toBe(false)
  })

  it('stops guessing pieces the closet already covers', () => {
    const predictions = predictWardrobe(closet, profile)
    expect(predictions.some((p) => p.garment.label.includes('jeans'))).toBe(false)
  })
})
