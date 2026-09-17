import { describe, expect, it } from 'vitest'
import { localStylist, outfitShape, silhouetteScore, explainVibe } from './stylist'
import { demoGarments } from './demoCloset'
import { makeGarment, makePrefs, makeProfile } from './testFixtures'
import type { Garment, Outfit } from '../types'

const closet = demoGarments(1_700_000_000_000)
const profile = makeProfile()

function styleWith(prefsPatch: Parameters<typeof makePrefs>[0], garments: Garment[] = closet, extra = {}) {
  return localStylist.generate({
    garments,
    profile,
    prefs: makePrefs(prefsPatch),
    ...extra,
  })
}

describe('localStylist.generate', () => {
  it('returns complete, distinct outfits from a normal closet', () => {
    const outfits = styleWith({})
    expect(outfits.length).toBeGreaterThan(1)
    for (const o of outfits) {
      expect(o.itemIds.length).toBeGreaterThanOrEqual(2)
      expect(new Set(o.itemIds).size).toBe(o.itemIds.length)
      expect(o.rationale.length).toBeGreaterThan(0)
      expect(o.palette.some((p) => p.role === 'accent')).toBe(true)
      expect(o.score).toBeGreaterThan(0)
      expect(o.score).toBeLessThanOrEqual(1)
    }
    const signatures = outfits.map((o) => [...o.itemIds].sort().join('|'))
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('always includes shoes and something covering the legs', () => {
    for (const o of styleWith({})) {
      const roles = Object.values(o.roles)
      expect(roles).toContain('shoes')
      expect(roles.some((r) => r === 'bottom' || r === 'dress')).toBe(true)
    }
  })

  it('returns nothing rather than a bad outfit when the closet is too thin', () => {
    expect(styleWith({}, [makeGarment('T-shirt')])).toEqual([])
  })

  it('dresses up for an event and down for a normal day', () => {
    const formality = (outfits: Outfit[]) => {
      const shapes = outfits.map((o) =>
        outfitShape(
          o.itemIds.map((id) => ({
            garment: closet.find((g) => g.id === id)!,
            role: o.roles[id],
          })),
        ),
      )
      return shapes.reduce((s, x) => s + x.formality, 0) / shapes.length
    }
    const event = formality(styleWith({ context: 'event', contextNote: 'black tie gala' }))
    const casual = formality(styleWith({ context: 'casual' }))
    expect(event).toBeGreaterThan(casual)
  })

  it('only reaches for role swaps once the personality dial is up', () => {
    const swaps = (outfits: Outfit[]) =>
      outfits.reduce(
        (n, o) =>
          n +
          o.itemIds.filter((id) => {
            const g = closet.find((x) => x.id === id)
            return g && o.roles[id] !== g.category
          }).length,
        0,
      )
    expect(swaps(styleWith({ adventurousness: 5 }))).toBe(0)
    expect(swaps(styleWith({ adventurousness: 95 }))).toBeGreaterThan(0)
  })

  it('explains how to execute a role swap', () => {
    const outfits = styleWith({ adventurousness: 95 })
    const swapped = outfits.find((o) => o.itemIds.some((id) => o.roles[id] !== closet.find((g) => g.id === id)?.category))
    expect(swapped).toBeDefined()
    expect(swapped!.moves.length).toBeGreaterThan(0)
    // The first move is the swap instruction, phrased as a physical action.
    expect(swapped!.moves[0]).toMatch(/pull|tuck|wear|leave|close/i)
  })

  it('keeps every piece of copy short enough to sit under a picture', () => {
    for (const o of styleWith({ adventurousness: 70 }).concat(styleWith({ adventurousness: 15 }))) {
      expect(o.headline.length, o.headline).toBeLessThanOrEqual(32)
      for (const m of o.moves) expect(m.length, m).toBeLessThanOrEqual(60)
      for (const a of o.accessories) expect(a.label.length, a.label).toBeLessThanOrEqual(48)
      // Rationale is behind a tap, so it gets more room, but only two lines.
      expect(o.rationale.length).toBeLessThanOrEqual(2)
    }
  })

  it('gives visually different looks distinct headlines', () => {
    const outfits = styleWith({ adventurousness: 85 })
    const headlines = outfits.map((o) => o.headline)
    expect(new Set(headlines).size).toBe(headlines.length)
  })

  it('does not return the same silhouette structure twice', () => {
    for (const daring of [10, 50, 90]) {
      const outfits = styleWith({ adventurousness: daring })
      const signatures = outfits.map((o) =>
        o.itemIds
          .map((id) => {
            const g = closet.find((x) => x.id === id)!
            return `${o.roles[id]}:${g.shape}`
          })
          .sort()
          .join('|'),
      )
      expect(new Set(signatures).size, `dial ${daring}`).toBe(signatures.length)
    }
  })

  it('never repeats the belt advice as both a move and an accessory', () => {
    for (const o of styleWith({ adventurousness: 30 }).concat(styleWith({ adventurousness: 80 }))) {
      const moveBelt = o.moves.some((m) => m.toLowerCase().includes('belt'))
      const accessoryBelt = o.accessories.some((a) => a.label.toLowerCase().includes('belt'))
      expect(moveBelt && accessoryBelt).toBe(false)
    }
  })

  it('admits it when the closet cannot reach the requested vibe', () => {
    // A closet of nothing but formalwear cannot deliver "cozy".
    const formalOnly = [
      makeGarment('Gown', { id: 'g1' }),
      makeGarment('Heels', { id: 'g2' }),
      makeGarment('Blazer', { id: 'g3' }),
      makeGarment('Tailored trousers', { id: 'g4' }),
      makeGarment('Blouse', { id: 'g5' }),
    ]
    const outfits = localStylist.generate({
      garments: formalOnly,
      profile,
      prefs: makePrefs({ vibe: 'cozy and comfy', context: 'casual' }),
    })
    expect(outfits.length).toBeGreaterThan(0)
    expect(outfits.some((o) => o.rationale.some((r) => r.includes('closest your closet gets')))).toBe(true)
  })

  it('honours a pinned piece', () => {
    const pin = closet.find((g) => g.category === 'dress')!
    const outfits = styleWith({}, closet, { pinnedIds: [pin.id] })
    expect(outfits.length).toBeGreaterThan(0)
    expect(outfits[0].itemIds).toContain(pin.id)
  })

  it('avoids repeating an outfit it has already suggested', () => {
    const first = styleWith({ context: 'shuffle' })
    const history = [first[0]]
    const again = styleWith({ context: 'shuffle' }, closet, { history })
    const repeated = again.find((o) => [...o.itemIds].sort().join() === [...first[0].itemIds].sort().join())
    expect(repeated).toBeUndefined()
  })

  it('keeps a strict-coverage user covered, and reports it when it cannot', () => {
    const covered = makeProfile({ modesty: 3 })
    const outfits = localStylist.generate({
      garments: closet,
      profile: covered,
      prefs: makePrefs({ vibe: 'sexy' }),
    })
    for (const o of outfits) {
      const revealing = o.itemIds
        .map((id) => closet.find((g) => g.id === id)!)
        .filter((g) => g.coverage !== 'full' && g.category !== 'shoes')
      // Anything less than full coverage must come with a visible nudge.
      if (revealing.length) expect(o.warnings.some((w) => w.kind === 'modesty')).toBe(true)
    }
  })

  it('drops the warnings when the user turns guardrails off', () => {
    const outfits = localStylist.generate({
      garments: closet,
      profile: makeProfile({ modesty: 3 }),
      prefs: makePrefs({ vibe: 'sexy', guardrails: false }),
    })
    expect(outfits.every((o) => o.warnings.length === 0)).toBe(true)
  })

  it('shifts coverage with the vibe', () => {
    const skin = (outfits: Outfit[]) => {
      const shapes = outfits.map((o) =>
        outfitShape(o.itemIds.map((id) => ({ garment: closet.find((g) => g.id === id)!, role: o.roles[id] }))),
      )
      return shapes.reduce((s, x) => s + x.skin, 0) / shapes.length
    }
    const bare = skin(
      localStylist.generate({ garments: closet, profile: makeProfile({ modesty: 0 }), prefs: makePrefs({ vibe: 'sexy' }) }),
    )
    const covered = skin(
      localStylist.generate({ garments: closet, profile: makeProfile({ modesty: 0 }), prefs: makePrefs({ vibe: 'modest and nerdy' }) }),
    )
    expect(bare).toBeGreaterThan(covered)
  })

  it('picks warmer looks in a cold climate', () => {
    const warmth = (climate: 'hot' | 'cold') => {
      const outfits = localStylist.generate({
        garments: closet,
        profile: makeProfile({ climate }),
        prefs: makePrefs(),
      })
      const shapes = outfits.map((o) =>
        outfitShape(o.itemIds.map((id) => ({ garment: closet.find((g) => g.id === id)!, role: o.roles[id] }))),
      )
      return shapes.reduce((s, x) => s + x.warmth, 0) / shapes.length
    }
    expect(warmth('cold')).toBeGreaterThan(warmth('hot'))
  })

  it('tailors jewellery advice to the undertone', () => {
    const [warm] = localStylist.generate({
      garments: closet,
      profile: makeProfile({ biometrics: { bodyShape: 'rectangle', undertone: 'warm' } }),
      prefs: makePrefs({ vibe: 'playful and colourful' }),
    })
    const [cool] = localStylist.generate({
      garments: closet,
      profile: makeProfile({ biometrics: { bodyShape: 'rectangle', undertone: 'cool' } }),
      prefs: makePrefs({ vibe: 'playful and colourful' }),
    })
    expect(warm.accessories.concat(cool.accessories).length).toBeGreaterThan(0)
    const text = (o: Outfit) => o.accessories.map((a) => a.label + a.why).join(' ')
    if (text(warm).includes('metal') || text(cool).includes('metal')) {
      expect(text(warm)).not.toBe(text(cool))
    }
  })
})

describe('outfitShape', () => {
  it('reads an all-neutral look as unsaturated', () => {
    const pieces = [
      { garment: makeGarment('T-shirt', { colors: ['#ffffff'] }), role: 'top' as const },
      { garment: makeGarment('Tailored trousers', { colors: ['#1a1a1a'] }), role: 'bottom' as const },
      { garment: makeGarment('Loafers', { colors: ['#2b2b2b'] }), role: 'shoes' as const },
    ]
    const shape = outfitShape(pieces)
    expect(shape.saturation).toBeLessThan(0.15)
    expect(shape.contrast).toBeGreaterThan(0.5)
  })

  it('counts a piece worn out of category as a role swap', () => {
    const skirt = makeGarment('Midi skirt')
    const shape = outfitShape([
      { garment: skirt, role: 'top' },
      { garment: makeGarment('Jeans'), role: 'bottom' },
      { garment: makeGarment('Boots'), role: 'shoes' },
    ])
    expect(shape.roleSwaps).toBe(1)
  })

  it('reads structure from fabric and fit', () => {
    const sharp = outfitShape([
      { garment: makeGarment('Blazer'), role: 'outerwear' },
      { garment: makeGarment('Tailored trousers'), role: 'bottom' },
      { garment: makeGarment('Loafers'), role: 'shoes' },
    ])
    const soft = outfitShape([
      { garment: makeGarment('Hoodie'), role: 'top' },
      { garment: makeGarment('Sweatpants'), role: 'bottom' },
      { garment: makeGarment('Sneakers'), role: 'shoes' },
    ])
    expect(sharp.structure).toBeGreaterThan(soft.structure)
    expect(sharp.polish).toBeGreaterThan(soft.polish)
  })
})

describe('silhouetteScore', () => {
  it('rewards contrasting volumes over matching ones', () => {
    const contrasted = outfitShape([
      { garment: makeGarment('Knit sweater', { fit: 'oversized' }), role: 'top' },
      { garment: makeGarment('Jeans', { fit: 'fitted' }), role: 'bottom' },
      { garment: makeGarment('Boots'), role: 'shoes' },
    ])
    const matched = outfitShape([
      { garment: makeGarment('Knit sweater', { fit: 'oversized' }), role: 'top' },
      { garment: makeGarment('Jeans', { fit: 'oversized' }), role: 'bottom' },
      { garment: makeGarment('Boots'), role: 'shoes' },
    ])
    const p = makeProfile({ biometrics: { bodyShape: 'unspecified', undertone: 'neutral' } })
    expect(silhouetteScore(contrasted, p)).toBeGreaterThan(silhouetteScore(matched, p))
  })

  it('rewards a defined waist for a rectangle frame', () => {
    const withWaist = outfitShape([
      { garment: makeGarment('Blouse', { fit: 'fitted' }), role: 'top' },
      { garment: makeGarment('Wide-leg trousers'), role: 'bottom' },
      { garment: makeGarment('Loafers'), role: 'shoes' },
    ])
    const without = outfitShape([
      { garment: makeGarment('Blouse', { fit: 'relaxed' }), role: 'top' },
      { garment: makeGarment('Wide-leg trousers'), role: 'bottom' },
      { garment: makeGarment('Loafers'), role: 'shoes' },
    ])
    const rect = makeProfile({ biometrics: { bodyShape: 'rectangle', undertone: 'neutral' } })
    expect(silhouetteScore(withWaist, rect)).toBeGreaterThan(silhouetteScore(without, rect))
  })
})

describe('explainVibe', () => {
  it('returns neutral axes for empty input without inventing matches', () => {
    const parsed = explainVibe('   ')
    expect(parsed.matched).toEqual([])
    expect(parsed.unmapped).toEqual([])
  })
})
