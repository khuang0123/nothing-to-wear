import { describe, expect, it } from 'vitest'
import type { StylingPreferences } from '../types'
import { CLIMATE_WARMTH, contextProfile, coverageAtLeast, guessClimate } from './context'

function prefs(patch: Partial<StylingPreferences> = {}): StylingPreferences {
  return { context: 'casual', contextNote: '', adventurousness: 50, vibe: '', guardrails: true, ...patch }
}

describe('contextProfile', () => {
  it('ranks the contexts by formality', () => {
    const formality = (c: StylingPreferences['context']) => contextProfile(prefs({ context: c })).targetFormality
    expect(formality('event')).toBeGreaterThan(formality('work'))
    expect(formality('work')).toBeGreaterThan(formality('casual'))
  })

  it('leaves shuffle deliberately loose', () => {
    expect(contextProfile(prefs({ context: 'shuffle' })).tolerance).toBeGreaterThan(
      contextProfile(prefs({ context: 'event' })).tolerance,
    )
  })

  it('lets the note override the context', () => {
    const p = contextProfile(prefs({ context: 'event', contextNote: 'backyard picnic' }))
    expect(p.targetFormality).toBeLessThan(2.5)
  })

  it('applies a coverage floor for a place of worship', () => {
    expect(contextProfile(prefs({ contextNote: 'friday prayer at the mosque' })).minCoverage).toBe('full')
  })

  it('caps saturation for a funeral and keeps the strictest coverage floor', () => {
    const p = contextProfile(prefs({ context: 'event', contextNote: 'funeral with family' }))
    expect(p.maxSaturation).toBeLessThanOrEqual(0.2)
    expect(p.minCoverage).toBe('full')
    expect(p.cues.length).toBeGreaterThan(1)
  })

  it('pushes formality up for black tie', () => {
    expect(contextProfile(prefs({ context: 'event', contextNote: 'black tie gala' })).targetFormality).toBe(5)
  })
})

describe('coverageAtLeast', () => {
  it('orders coverage minimal < moderate < full', () => {
    expect(coverageAtLeast('full', 'moderate')).toBe(true)
    expect(coverageAtLeast('moderate', 'moderate')).toBe(true)
    expect(coverageAtLeast('minimal', 'moderate')).toBe(false)
  })
})

describe('guessClimate', () => {
  it('recognises cities it knows and gives up on ones it does not', () => {
    expect(guessClimate('Singapore')).toBe('hot')
    expect(guessClimate('chicago, il')).toBe('cool')
    expect(guessClimate('Nowhereville')).toBeNull()
  })
})

describe('CLIMATE_WARMTH', () => {
  it('increases monotonically from hot to cold', () => {
    const order = ['hot', 'warm', 'mild', 'cool', 'cold'] as const
    for (let i = 1; i < order.length; i++) {
      expect(CLIMATE_WARMTH[order[i]]).toBeGreaterThan(CLIMATE_WARMTH[order[i - 1]])
    }
  })
})
