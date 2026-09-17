import { describe, expect, it } from 'vitest'
import { checkGarment, checkOutfit, strongest } from './guardrails'
import { contextProfile } from './context'
import { makeGarment, makePrefs, makeProfile } from './testFixtures'

const casual = contextProfile(makePrefs())

describe('checkGarment — modesty', () => {
  const crop = makeGarment('Crop top')

  it('says nothing when the user set no coverage rules', () => {
    const warnings = checkGarment(crop, makeProfile({ modesty: 0 }), casual)
    expect(warnings.filter((w) => w.kind === 'modesty')).toHaveLength(0)
  })

  it('nudges softly at the "not too revealing" setting', () => {
    const w = checkGarment(crop, makeProfile({ modesty: 1 }), casual).find((x) => x.kind === 'modesty')
    expect(w?.severity).toBe('nudge')
  })

  it('escalates at the modest setting and always offers a way to keep the piece', () => {
    const w = checkGarment(crop, makeProfile({ modesty: 2 }), casual).find((x) => x.kind === 'modesty')
    expect(w?.severity).toBe('strong')
    expect(w?.suggestion).toMatch(/layer/i)
  })

  it('flags even moderate coverage at the strictest setting', () => {
    const tee = makeGarment('T-shirt') // moderate coverage
    const w = checkGarment(tee, makeProfile({ modesty: 3 }), casual)
    expect(w.some((x) => x.kind === 'modesty')).toBe(true)
  })
})

describe('checkGarment — occasion', () => {
  it('flags a revealing piece for a place of worship as a context problem', () => {
    const ctx = contextProfile(makePrefs({ contextNote: 'service at church' }))
    const w = checkGarment(makeGarment('Crop top'), makeProfile({ modesty: 0 }), ctx)
    expect(w.some((x) => x.kind === 'context')).toBe(true)
  })

  it('flags a bright piece for a funeral', () => {
    const ctx = contextProfile(makePrefs({ context: 'event', contextNote: 'funeral' }))
    const loud = makeGarment('Blouse', { colors: ['#e01b1b'] })
    const w = checkGarment(loud, makeProfile(), ctx)
    expect(w.some((x) => x.kind === 'context' && x.severity === 'strong')).toBe(true)
  })

  it('flags sweatpants for an interview but not for a normal day', () => {
    const interview = contextProfile(makePrefs({ context: 'work', contextNote: 'interview' }))
    const sweats = makeGarment('Sweatpants')
    expect(checkGarment(sweats, makeProfile(), interview).some((w) => w.kind === 'context')).toBe(true)
    expect(
      checkGarment(sweats, makeProfile(), contextProfile(makePrefs({ context: 'casual' }))).some(
        (w) => w.kind === 'context',
      ),
    ).toBe(false)
  })
})

describe('checkGarment — weather', () => {
  it('flags a puffer in a hot climate', () => {
    const w = checkGarment(makeGarment('Puffer coat'), makeProfile({ climate: 'hot' }), casual)
    expect(w.some((x) => x.kind === 'weather')).toBe(true)
  })

  it('flags sandals in a cold climate', () => {
    const w = checkGarment(makeGarment('Sandals'), makeProfile({ climate: 'cold' }), casual)
    expect(w.some((x) => x.kind === 'weather')).toBe(true)
  })

  it('gives shoes shoe advice rather than telling you to layer over them', () => {
    const w = checkGarment(makeGarment('Sandals'), makeProfile({ climate: 'cold' }), casual).find(
      (x) => x.kind === 'weather',
    )
    expect(w?.suggestion).toMatch(/shoe/i)
    expect(w?.suggestion).not.toMatch(/layer/i)
  })

  it('phrases warnings so plural garment names still read correctly', () => {
    const w = checkGarment(makeGarment('Sandals', { label: 'brown loafers' }), makeProfile({ climate: 'cold' }), casual)
    expect(w.some((x) => x.message.includes('loafers is'))).toBe(false)
    expect(w.some((x) => x.message.includes('brown loafers'))).toBe(true)
  })

  it('stays quiet when the weight matches', () => {
    const w = checkGarment(makeGarment('Jeans'), makeProfile({ climate: 'mild' }), casual)
    expect(w.some((x) => x.kind === 'weather')).toBe(false)
  })
})

describe('checkOutfit', () => {
  it('de-duplicates identical warnings across pieces', () => {
    const a = makeGarment('Tank top', { id: 'a', label: 'tank a' })
    const b = makeGarment('Tank top', { id: 'b', label: 'tank a' })
    const warnings = checkOutfit([a, b], makeProfile({ modesty: 2 }), casual)
    expect(warnings.filter((w) => w.kind === 'modesty')).toHaveLength(1)
  })

  it('adds a whole-outfit comfort warning when the look is too light for the climate', () => {
    const outfit = [makeGarment('Tank top'), makeGarment('Shorts'), makeGarment('Sandals')]
    const warnings = checkOutfit(outfit, makeProfile({ climate: 'cold', modesty: 0 }), casual)
    expect(warnings.some((w) => w.kind === 'comfort')).toBe(true)
  })

  it('warns when two revealing pieces are combined at the softest modesty setting', () => {
    const outfit = [makeGarment('Crop top'), makeGarment('Mini skirt'), makeGarment('Sneakers')]
    const warnings = checkOutfit(outfit, makeProfile({ modesty: 1, climate: 'warm' }), casual)
    expect(warnings.some((w) => w.kind === 'modesty' && w.message.includes('Two revealing'))).toBe(true)
  })
})

describe('strongest', () => {
  it('prefers a strong warning over a nudge, and returns null for none', () => {
    const nudge = { kind: 'weather', message: 'm', suggestion: 's', severity: 'nudge' } as const
    const strong = { kind: 'modesty', message: 'm2', suggestion: 's2', severity: 'strong' } as const
    expect(strongest([nudge, strong])).toBe(strong)
    expect(strongest([])).toBeNull()
  })
})
