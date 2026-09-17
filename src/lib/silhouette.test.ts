import { describe, expect, it } from 'vitest'
import {
  BODY_PATHS,
  FIGURE_VIEWBOX,
  SHAPE_NOUN,
  focusViewBox,
  geometryFor,
  shapeFor,
  shapeForRole,
} from './silhouette'
import { GARMENT_TYPES } from './fabrics'
import { makeGarment } from './testFixtures'
import type { GarmentShape } from '../types'

const ALL_SHAPES = Array.from(new Set(GARMENT_TYPES.map((t) => t.shape)))

describe('geometryFor', () => {
  it('produces valid, non-empty path data for every shape a garment can have', () => {
    for (const shape of ALL_SHAPES) {
      const geo = geometryFor(shape, 'straight')
      expect(geo.paths.length, shape).toBeGreaterThan(0)
      for (const path of geo.paths) {
        expect(path.startsWith('M'), `${shape}: ${path}`).toBe(true)
        expect(path, shape).not.toContain('NaN')
        expect(path, shape).not.toContain('undefined')
      }
    }
  })

  it('layers legwear under torsowear under outerwear under shoes', () => {
    const legs = geometryFor('trousers', 'straight').layer
    const torso = geometryFor('tee', 'straight').layer
    const outer = geometryFor('coat', 'straight').layer
    const shoes = geometryFor('boot', 'straight').layer
    expect(legs).toBeLessThan(torso)
    expect(torso).toBeLessThan(outer)
    expect(outer).toBeLessThan(shoes)
  })

  it('draws a wider garment for a looser fit', () => {
    const widthOf = (shape: GarmentShape, fit: 'fitted' | 'oversized') => {
      const xs = geometryFor(shape, fit)
        .paths.join(' ')
        .match(/-?\d+(\.\d+)?,/g)!
        .map((n) => Number.parseFloat(n))
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(widthOf('knit', 'oversized')).toBeGreaterThan(widthOf('knit', 'fitted'))
    expect(widthOf('trousers', 'oversized')).toBeGreaterThan(widthOf('trousers', 'fitted'))
  })

  it('draws a midi skirt longer than a mini skirt', () => {
    const lowestY = (shape: GarmentShape) => {
      const ys = geometryFor(shape, 'straight')
        .paths.join(' ')
        .match(/,-?\d+(\.\d+)?/g)!
        .map((n) => Number.parseFloat(n.slice(1)))
      return Math.max(...ys)
    }
    expect(lowestY('skirt-midi')).toBeGreaterThan(lowestY('skirt-mini'))
    expect(lowestY('gown')).toBeGreaterThan(lowestY('dress-short'))
    expect(lowestY('boot')).toBeGreaterThan(lowestY('loafer') - 1)
  })
})

describe('shapeFor', () => {
  it('uses the stored shape when there is one', () => {
    expect(shapeFor(makeGarment('Midi skirt'))).toBe('skirt-midi')
  })

  it('infers a sensible shape for garments saved before shapes existed', () => {
    const legacy = { ...makeGarment('Midi skirt'), shape: undefined }
    expect(shapeFor(legacy)).toBe('skirt-midi')

    const legacyTank = { ...makeGarment('Tank top'), shape: undefined }
    expect(['tank', 'crop']).toContain(shapeFor(legacyTank))

    const legacyCoat = { ...makeGarment('Puffer coat'), shape: undefined }
    expect(shapeFor(legacyCoat)).toBe('puffer')
  })

  it('never returns undefined for any garment type', () => {
    for (const t of GARMENT_TYPES) {
      const g = { ...makeGarment(t.label), shape: undefined }
      expect(shapeFor(g), t.label).toBeTruthy()
    }
  })
})

describe('shapeForRole', () => {
  it('draws a skirt worn as a top as a strapless band, not a skirt', () => {
    const skirt = makeGarment('Midi skirt')
    expect(shapeForRole(skirt, 'bottom')).toBe('skirt-midi')
    expect(shapeForRole(skirt, 'top')).toBe('band')
  })

  it('draws a slip dress worn as a top as a tank', () => {
    expect(shapeForRole(makeGarment('Slip dress'), 'top')).toBe('tank')
  })

  it('draws a shirt worn as outerwear as an open jacket', () => {
    expect(shapeForRole(makeGarment('Button-down shirt'), 'outerwear')).toBe('jacket')
  })

  it('draws a blazer worn as a top closed rather than open', () => {
    expect(shapeForRole(makeGarment('Blazer'), 'top')).toBe('shirt')
  })

  it('leaves a piece alone when it is worn in its own role', () => {
    for (const t of GARMENT_TYPES) {
      const g = makeGarment(t.label)
      expect(shapeForRole(g, g.category), t.label).toBe(t.shape)
    }
  })
})

describe('SHAPE_NOUN', () => {
  it('has a short human noun for every shape', () => {
    for (const shape of ALL_SHAPES) {
      expect(SHAPE_NOUN[shape], shape).toBeTruthy()
      expect(SHAPE_NOUN[shape].length, shape).toBeLessThanOrEqual(14)
    }
  })
})

describe('BODY_PATHS', () => {
  it('draws a complete mannequin with no malformed coordinates', () => {
    for (const [name, path] of Object.entries(BODY_PATHS)) {
      expect(path.startsWith('M'), name).toBe(true)
      expect(path, name).not.toContain('NaN')
    }
  })
})

describe('focusViewBox', () => {
  it('zooms to the torso for tops and to the feet for shoes', () => {
    const parse = (vb: string) => vb.split(' ').map(Number)
    const [, topY, , topH] = parse(focusViewBox('tee'))
    const [, shoeY, , shoeH] = parse(focusViewBox('loafer'))
    expect(topY).toBeLessThan(shoeY)
    expect(shoeH).toBeLessThan(topH)
  })

  it('keeps the whole figure for garments that span it', () => {
    for (const shape of ['gown', 'dress-long', 'coat'] as const) {
      expect(focusViewBox(shape), shape).toBe(FIGURE_VIEWBOX)
    }
  })

  it('returns four finite numbers for every shape', () => {
    for (const shape of ALL_SHAPES) {
      const parts = focusViewBox(shape).split(' ').map(Number)
      expect(parts, shape).toHaveLength(4)
      for (const n of parts) expect(Number.isFinite(n), shape).toBe(true)
    }
  })
})
