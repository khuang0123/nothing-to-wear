/**
 * Garment silhouettes, as SVG path geometry on a shared figure.
 *
 * This is what makes a recommendation legible at a glance: every piece is drawn
 * in the right shape, in its real colour, in the position it is actually worn —
 * including when it is worn in a role it was not made for. If the user
 * photographed the piece, the photo is clipped into the same path, so the look
 * is built from their actual fabric rather than a flat swatch.
 *
 * All coordinates are in the figure's viewBox space (see FIGURE_W/H).
 */

import type { Fit, Garment, GarmentCategory, GarmentShape } from '../types'

export const FIGURE_W = 200
export const FIGURE_H = 320
/** Cropped to the drawn content so the figure is not swimming in dead space. */
export const FIGURE_VIEWBOX = '0 -6 200 310'

const CX = 100
const NECK_Y = 48
const SHOULDER_Y = 54
const UNDERARM_Y = 96
const WAIST_Y = 142
const LEG_OFFSET = 14
const ANKLE_Y = 278

/* ------------------------------------------------------------------ *
 * Path helpers
 * ------------------------------------------------------------------ */

function poly(points: Array<[number, number]>): string {
  return `M ${points.map(([x, y]) => `${round(x)},${round(y)}`).join(' L ')} Z`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M ${round(x + rr)},${round(y)}`,
    `H ${round(x + w - rr)}`,
    `A ${rr} ${rr} 0 0 1 ${round(x + w)},${round(y + rr)}`,
    `V ${round(y + h - rr)}`,
    `A ${rr} ${rr} 0 0 1 ${round(x + w - rr)},${round(y + h)}`,
    `H ${round(x + rr)}`,
    `A ${rr} ${rr} 0 0 1 ${round(x)},${round(y + h - rr)}`,
    `V ${round(y + rr)}`,
    `A ${rr} ${rr} 0 0 1 ${round(x + rr)},${round(y)}`,
    'Z',
  ].join(' ')
}

function circle(cx: number, cy: number, r: number): string {
  return `M ${round(cx - r)},${round(cy)} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z`
}

/** How much wider a fit makes a garment sit. */
export const FIT_SCALE: Record<Fit, number> = {
  fitted: 0.9,
  straight: 1,
  relaxed: 1.12,
  oversized: 1.26,
}

/* ------------------------------------------------------------------ *
 * Torso garments
 * ------------------------------------------------------------------ */

type Sleeve = 'none' | 'strap' | 'short' | 'long'

interface TopSpec {
  shoulderHW: number
  hemHW: number
  hemY: number
  sleeve: Sleeve
  neckHW?: number
  /** Strapless pieces start below the shoulder. */
  topY?: number
}

function sleevePaths(shoulderHW: number, sleeve: Sleeve): string[] {
  if (sleeve === 'none') return []
  if (sleeve === 'strap') {
    return [
      poly([
        [CX - shoulderHW - 5, NECK_Y - 1],
        [CX - shoulderHW, SHOULDER_Y + 6],
        [CX - shoulderHW + 6, SHOULDER_Y + 6],
        [CX - shoulderHW + 2, NECK_Y - 1],
      ]),
      poly([
        [CX + shoulderHW + 5, NECK_Y - 1],
        [CX + shoulderHW, SHOULDER_Y + 6],
        [CX + shoulderHW - 6, SHOULDER_Y + 6],
        [CX + shoulderHW - 2, NECK_Y - 1],
      ]),
    ]
  }
  // Arms hang outward, so a sleeve is a tapering band following that line.
  const endY = sleeve === 'short' ? SHOULDER_Y + 44 : SHOULDER_Y + 96
  const drift = sleeve === 'short' ? 11 : 15
  const width = sleeve === 'short' ? 11 : 9
  return [
    poly([
      [CX - shoulderHW + 1, SHOULDER_Y],
      [CX - shoulderHW - drift, endY],
      [CX - shoulderHW - drift + width, endY + 5],
      [CX - shoulderHW + 9, SHOULDER_Y + 10],
    ]),
    poly([
      [CX + shoulderHW - 1, SHOULDER_Y],
      [CX + shoulderHW + drift, endY],
      [CX + shoulderHW + drift - width, endY + 5],
      [CX + shoulderHW - 9, SHOULDER_Y + 10],
    ]),
  ]
}

function topPaths(spec: TopSpec, scale: number): string[] {
  const sh = spec.shoulderHW * scale
  const hem = spec.hemHW * scale
  const neck = spec.neckHW ?? 13

  if (spec.topY !== undefined) {
    // Strapless band: no shoulders, no neckline.
    return [
      poly([
        [CX - sh, spec.topY],
        [CX + sh, spec.topY],
        [CX + hem, spec.hemY],
        [CX - hem, spec.hemY],
      ]),
    ]
  }

  const body =
    `M ${round(CX - neck)},${NECK_Y} ` +
    `L ${round(CX - sh)},${SHOULDER_Y} ` +
    `L ${round(CX - sh + 2)},${UNDERARM_Y} ` +
    `L ${round(CX - hem)},${round(spec.hemY)} ` +
    `L ${round(CX + hem)},${round(spec.hemY)} ` +
    `L ${round(CX + sh - 2)},${UNDERARM_Y} ` +
    `L ${round(CX + sh)},${SHOULDER_Y} ` +
    `L ${round(CX + neck)},${NECK_Y} ` +
    `Q ${CX},${NECK_Y + 10} ${round(CX - neck)},${NECK_Y} Z`

  return [body, ...sleevePaths(sh, spec.sleeve)]
}

/* ------------------------------------------------------------------ *
 * Leg garments
 * ------------------------------------------------------------------ */

function trouserPaths(ankleHW: number, hemY: number, scale: number): string[] {
  const waistHW = 30 * Math.min(scale, 1.1)
  const a = ankleHW * scale
  return [
    poly([
      [CX - waistHW, WAIST_Y],
      [CX - 2, WAIST_Y],
      [CX - LEG_OFFSET + a, hemY],
      [CX - LEG_OFFSET - a, hemY],
    ]),
    poly([
      [CX + 2, WAIST_Y],
      [CX + waistHW, WAIST_Y],
      [CX + LEG_OFFSET + a, hemY],
      [CX + LEG_OFFSET - a, hemY],
    ]),
  ]
}

function skirtPaths(hemHW: number, hemY: number, scale: number): string[] {
  return [
    poly([
      [CX - 29, WAIST_Y],
      [CX + 29, WAIST_Y],
      [CX + hemHW * scale, hemY],
      [CX - hemHW * scale, hemY],
    ]),
  ]
}

/* ------------------------------------------------------------------ *
 * Outerwear — drawn open, so the layer underneath still reads
 * ------------------------------------------------------------------ */

function outerPaths(hemY: number, outerHW: number, scale: number): string[] {
  const sh = 40 * scale
  const hem = outerHW * scale
  const left = poly([
    [CX - 13, NECK_Y + 2],
    [CX - sh, SHOULDER_Y],
    [CX - sh - 3, UNDERARM_Y],
    [CX - hem, hemY],
    [CX - 17, hemY],
    [CX - 15, UNDERARM_Y],
  ])
  const right = poly([
    [CX + 13, NECK_Y + 2],
    [CX + sh, SHOULDER_Y],
    [CX + sh + 3, UNDERARM_Y],
    [CX + hem, hemY],
    [CX + 17, hemY],
    [CX + 15, UNDERARM_Y],
  ])
  // Lapels give the eye the "this is a jacket" cue at thumbnail size.
  const lapels = poly([
    [CX - 14, NECK_Y + 2],
    [CX - 2, NECK_Y + 4],
    [CX - 12, UNDERARM_Y - 18],
  ])
  const lapelR = poly([
    [CX + 14, NECK_Y + 2],
    [CX + 2, NECK_Y + 4],
    [CX + 12, UNDERARM_Y - 18],
  ])
  return [left, right, lapels, lapelR, ...sleevePaths(sh, 'long')]
}

/* ------------------------------------------------------------------ *
 * Shoes
 * ------------------------------------------------------------------ */

function shoePaths(shape: GarmentShape): string[] {
  const L = CX - LEG_OFFSET - 12
  const R = CX + LEG_OFFSET - 12
  switch (shape) {
    case 'boot':
      return [roundRect(L, 236, 24, 60, 6), roundRect(R, 236, 24, 60, 6)]
    case 'loafer':
      return [roundRect(L, 280, 24, 16, 7), roundRect(R, 280, 24, 16, 7)]
    case 'heel':
      return [
        poly([
          [L, 292],
          [L + 22, 276],
          [L + 25, 281],
          [L + 8, 296],
        ]),
        roundRect(L + 1, 290, 7, 6, 2),
        poly([
          [R + 24, 292],
          [R + 2, 276],
          [R - 1, 281],
          [R + 16, 296],
        ]),
        roundRect(R + 16, 290, 7, 6, 2),
      ]
    case 'sandal':
      return [
        roundRect(L, 284, 24, 4, 2),
        roundRect(L, 292, 24, 4, 2),
        roundRect(R, 284, 24, 4, 2),
        roundRect(R, 292, 24, 4, 2),
      ]
    default:
      return [roundRect(L, 276, 24, 20, 7), roundRect(R, 276, 24, 20, 7)]
  }
}

/* ------------------------------------------------------------------ *
 * Shape resolution
 * ------------------------------------------------------------------ */

/** Best guess for saved garments from before shapes were stored. */
export function shapeFor(garment: Garment): GarmentShape {
  if (garment.shape) return garment.shape
  switch (garment.category) {
    case 'top':
      if (garment.coverage === 'minimal') return garment.fit === 'fitted' ? 'crop' : 'tank'
      return garment.warmth >= 4 ? 'knit' : garment.formality >= 4 ? 'shirt' : 'tee'
    case 'bottom':
      // A bottom that can double as a top or a dress is a skirt — trousers
      // cannot do that, so this is the one reliable signal in legacy data.
      if (garment.alternateRoles.includes('top') || garment.alternateRoles.includes('dress')) {
        return garment.coverage === 'minimal' ? 'skirt-mini' : 'skirt-midi'
      }
      if (garment.coverage === 'minimal') return 'shorts'
      return garment.fit === 'relaxed' || garment.fit === 'oversized' ? 'wide-trousers' : 'trousers'
    case 'dress':
      return garment.formality >= 5 ? 'gown' : garment.coverage === 'full' ? 'dress-short' : 'dress-long'
    case 'outerwear':
      return garment.warmth >= 5 ? 'puffer' : garment.formality >= 4 ? 'coat' : 'jacket'
    case 'shoes':
      if (garment.formality >= 5) return 'heel'
      if (garment.warmth >= 4) return 'boot'
      return garment.coverage === 'minimal' ? 'sandal' : 'sneaker'
    case 'bag':
      return 'bag'
    case 'accessory':
      if (garment.tags.includes('waist')) return 'belt'
      return garment.warmth >= 4 ? 'scarf' : 'jewellery'
  }
}

const TORSO_SHAPES: GarmentShape[] = ['tee', 'shirt', 'knit', 'tank', 'crop', 'band', 'hoodie']
const LEG_SHAPES: GarmentShape[] = ['trousers', 'wide-trousers', 'shorts', 'skirt-mini', 'skirt-midi']
const DRESS_SHAPES: GarmentShape[] = ['dress-short', 'dress-long', 'gown']
const OUTER_SHAPES: GarmentShape[] = ['jacket', 'coat', 'puffer']

/**
 * The shape to draw given the role the piece is actually being worn in.
 * A midi skirt pulled up as a top becomes a strapless band; a slip dress
 * tucked into trousers becomes a tank. This is what makes a role swap
 * something you can see rather than something you have to read about.
 */
export function shapeForRole(garment: Garment, role: GarmentCategory): GarmentShape {
  const own = shapeFor(garment)
  if (role === garment.category) return own

  if (role === 'top') {
    if (LEG_SHAPES.includes(own)) return 'band'
    if (DRESS_SHAPES.includes(own)) return 'tank'
    if (OUTER_SHAPES.includes(own)) return 'shirt'
    return own
  }
  if (role === 'outerwear') {
    if (TORSO_SHAPES.includes(own)) return 'jacket'
    if (DRESS_SHAPES.includes(own)) return 'coat'
    return own
  }
  if (role === 'bottom') {
    if (DRESS_SHAPES.includes(own)) return 'skirt-midi'
    return own
  }
  if (role === 'dress') {
    if (own === 'skirt-midi' || own === 'skirt-mini') return 'dress-long'
    return own
  }
  return own
}

/* ------------------------------------------------------------------ *
 * Geometry per shape
 * ------------------------------------------------------------------ */

export interface ShapeGeometry {
  paths: string[]
  /** Painting order. Higher is nearer the viewer. */
  layer: number
}

export function geometryFor(shape: GarmentShape, fit: Fit): ShapeGeometry {
  const s = FIT_SCALE[fit]
  switch (shape) {
    case 'tee':
      return { paths: topPaths({ shoulderHW: 34, hemHW: 32, hemY: 152, sleeve: 'short' }, s), layer: 20 }
    case 'shirt':
      return { paths: topPaths({ shoulderHW: 34, hemHW: 33, hemY: 158, sleeve: 'long', neckHW: 11 }, s), layer: 20 }
    case 'knit':
      return { paths: topPaths({ shoulderHW: 38, hemHW: 36, hemY: 156, sleeve: 'long' }, s), layer: 20 }
    case 'hoodie':
      return {
        paths: [
          ...topPaths({ shoulderHW: 42, hemHW: 42, hemY: 164, sleeve: 'long' }, s),
          // Hood collar behind the neck.
          poly([
            [CX - 20, NECK_Y + 2],
            [CX + 20, NECK_Y + 2],
            [CX + 14, NECK_Y - 10],
            [CX - 14, NECK_Y - 10],
          ]),
        ],
        layer: 20,
      }
    case 'tank':
      return { paths: topPaths({ shoulderHW: 22, hemHW: 27, hemY: 150, sleeve: 'strap', neckHW: 9 }, s), layer: 20 }
    case 'crop':
      return { paths: topPaths({ shoulderHW: 32, hemHW: 29, hemY: 110, sleeve: 'short' }, s), layer: 20 }
    case 'band':
      return { paths: topPaths({ shoulderHW: 29, hemHW: 25, hemY: 134, sleeve: 'none', topY: 72 }, s), layer: 20 }

    case 'trousers':
      return { paths: trouserPaths(12, ANKLE_Y, s), layer: 10 }
    case 'wide-trousers':
      return { paths: trouserPaths(21, ANKLE_Y, s), layer: 10 }
    case 'shorts':
      return { paths: trouserPaths(17, 198, s), layer: 10 }
    case 'skirt-mini':
      return { paths: skirtPaths(40, 188, s), layer: 10 }
    case 'skirt-midi':
      return { paths: skirtPaths(46, 240, s), layer: 10 }

    case 'dress-short':
      return { paths: topPaths({ shoulderHW: 33, hemHW: 42, hemY: 202, sleeve: 'short' }, s), layer: 15 }
    case 'dress-long':
      return { paths: topPaths({ shoulderHW: 22, hemHW: 44, hemY: 252, sleeve: 'strap', neckHW: 9 }, s), layer: 15 }
    case 'gown':
      return { paths: topPaths({ shoulderHW: 24, hemHW: 54, hemY: 296, sleeve: 'strap', neckHW: 9 }, s), layer: 15 }

    case 'jacket':
      return { paths: outerPaths(168, 44, s), layer: 30 }
    case 'coat':
      return { paths: outerPaths(218, 48, s), layer: 30 }
    case 'puffer':
      return {
        paths: [
          ...outerPaths(186, 52, s),
          // Quilt lines read as "puffer" instantly.
          roundRect(CX - 52 * s, 112, 104 * s, 2, 1),
          roundRect(CX - 52 * s, 140, 104 * s, 2, 1),
        ],
        layer: 30,
      }

    case 'sneaker':
    case 'loafer':
    case 'boot':
    case 'heel':
    case 'sandal':
      return { paths: shoePaths(shape), layer: 40 }

    case 'belt':
      return { paths: [roundRect(CX - 31, 136, 62, 10, 3)], layer: 25 }
    case 'bag':
      return {
        paths: [
          roundRect(140, 150, 30, 26, 6),
          poly([
            [143, 152],
            [147, 152],
            [163, 124],
            [159, 124],
          ]),
        ],
        layer: 45,
      }
    case 'scarf':
      return {
        paths: [
          roundRect(CX - 19, 42, 38, 15, 7),
          roundRect(CX + 4, 54, 11, 40, 5),
        ],
        layer: 35,
      }
    case 'hat':
      return {
        paths: [
          roundRect(CX - 34, 14, 68, 7, 3),
          poly([
            [CX - 21, 14],
            [CX + 21, 14],
            [CX + 16, -4],
            [CX - 16, -4],
          ]),
        ],
        layer: 50,
      }
    case 'jewellery':
      return { paths: [circle(CX - 9, 46, 3.2), circle(CX + 9, 46, 3.2), circle(CX, 52, 3.6)], layer: 50 }
  }
}

/**
 * Zoomed viewBox for showing one garment on its own, so a t-shirt thumbnail is
 * a t-shirt rather than a full mannequin with a small t-shirt on it.
 */
export function focusViewBox(shape: GarmentShape): string {
  switch (shape) {
    case 'tee':
    case 'shirt':
    case 'knit':
    case 'tank':
    case 'crop':
    case 'band':
    case 'hoodie':
      return '24 12 152 176'
    case 'trousers':
    case 'wide-trousers':
    case 'shorts':
    case 'skirt-mini':
    case 'skirt-midi':
      return '30 124 140 186'
    case 'sneaker':
    case 'loafer':
    case 'heel':
    case 'sandal':
      return '56 262 88 44'
    case 'boot':
      return '56 226 88 80'
    case 'belt':
      return '46 112 108 62'
    case 'bag':
      return '116 108 84 82'
    case 'scarf':
      return '52 26 96 82'
    case 'hat':
    case 'jewellery':
      return '52 -8 96 76'
    default:
      // Dresses, coats and gowns need the whole figure to read.
      return FIGURE_VIEWBOX
  }
}

/** Short nouns for headline copy, keyed by silhouette. */
export const SHAPE_NOUN: Record<GarmentShape, string> = {
  tee: 'tee',
  shirt: 'shirt',
  knit: 'knit',
  tank: 'tank',
  crop: 'crop top',
  band: 'bandeau',
  hoodie: 'hoodie',
  trousers: 'trousers',
  'wide-trousers': 'wide leg',
  shorts: 'shorts',
  'skirt-mini': 'mini skirt',
  'skirt-midi': 'midi skirt',
  'dress-short': 'dress',
  'dress-long': 'slip dress',
  gown: 'gown',
  jacket: 'jacket',
  coat: 'coat',
  puffer: 'puffer',
  sneaker: 'sneakers',
  loafer: 'loafers',
  boot: 'boots',
  heel: 'heels',
  sandal: 'sandals',
  bag: 'bag',
  belt: 'belt',
  scarf: 'scarf',
  hat: 'hat',
  jewellery: 'jewellery',
}

/** The mannequin the clothes hang on. */
export const BODY_PATHS = {
  head: circle(CX, 24, 14),
  neck: roundRect(CX - 7, 34, 14, 18, 3),
  torso: poly([
    [CX - 30, SHOULDER_Y],
    [CX + 30, SHOULDER_Y],
    [CX + 26, WAIST_Y],
    [CX + 28, 164],
    [CX - 28, 164],
    [CX - 26, WAIST_Y],
  ]),
  armL: poly([
    [CX - 30, SHOULDER_Y + 2],
    [CX - 22, SHOULDER_Y + 4],
    [CX - 34, 150],
    [CX - 42, 148],
  ]),
  armR: poly([
    [CX + 30, SHOULDER_Y + 2],
    [CX + 22, SHOULDER_Y + 4],
    [CX + 34, 150],
    [CX + 42, 148],
  ]),
  legL: poly([
    [CX - 27, 160],
    [CX - 3, 160],
    [CX - LEG_OFFSET + 8, ANKLE_Y + 4],
    [CX - LEG_OFFSET - 8, ANKLE_Y + 4],
  ]),
  legR: poly([
    [CX + 3, 160],
    [CX + 27, 160],
    [CX + LEG_OFFSET + 8, ANKLE_Y + 4],
    [CX + LEG_OFFSET - 8, ANKLE_Y + 4],
  ]),
}
