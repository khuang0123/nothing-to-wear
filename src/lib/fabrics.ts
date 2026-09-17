/**
 * Fabric and garment-type knowledge. Two jobs:
 *  - give the stylist structure/polish values it cannot see in a photo
 *  - let the capture screen pre-fill sensible formality/warmth/coverage so
 *    tagging a piece is two taps rather than six fields
 */

import type { Coverage, Fit, Formality, GarmentCategory, Warmth } from '../types'

export interface FabricInfo {
  name: string
  /** 0 fluid and soft - 1 sharp and architectural. */
  structure: number
  /** 0 rumpled - 1 pristine. */
  polish: number
  warmth: Warmth
  /** Nudge applied to the garment type's base formality. */
  formalityShift: number
}

export const FABRICS: FabricInfo[] = [
  { name: 'cotton', structure: 0.5, polish: 0.6, warmth: 2, formalityShift: 0 },
  { name: 'jersey', structure: 0.2, polish: 0.4, warmth: 2, formalityShift: -0.5 },
  { name: 'linen', structure: 0.35, polish: 0.35, warmth: 1, formalityShift: 0 },
  { name: 'silk', structure: 0.25, polish: 0.9, warmth: 2, formalityShift: 0.7 },
  { name: 'satin', structure: 0.3, polish: 0.9, warmth: 2, formalityShift: 0.8 },
  { name: 'chiffon', structure: 0.15, polish: 0.8, warmth: 1, formalityShift: 0.6 },
  { name: 'wool', structure: 0.8, polish: 0.85, warmth: 4, formalityShift: 0.6 },
  { name: 'suiting', structure: 0.95, polish: 0.95, warmth: 3, formalityShift: 1.2 },
  { name: 'tweed', structure: 0.85, polish: 0.8, warmth: 4, formalityShift: 0.7 },
  { name: 'knit', structure: 0.3, polish: 0.55, warmth: 3, formalityShift: -0.2 },
  { name: 'cashmere', structure: 0.35, polish: 0.85, warmth: 4, formalityShift: 0.4 },
  { name: 'denim', structure: 0.75, polish: 0.5, warmth: 3, formalityShift: -0.4 },
  { name: 'leather', structure: 0.85, polish: 0.7, warmth: 3, formalityShift: 0.2 },
  { name: 'corduroy', structure: 0.7, polish: 0.55, warmth: 4, formalityShift: -0.1 },
  { name: 'canvas', structure: 0.7, polish: 0.45, warmth: 2, formalityShift: -0.5 },
  { name: 'fleece', structure: 0.25, polish: 0.2, warmth: 4, formalityShift: -1.2 },
  { name: 'velvet', structure: 0.55, polish: 0.8, warmth: 3, formalityShift: 0.8 },
  { name: 'nylon', structure: 0.6, polish: 0.6, warmth: 2, formalityShift: -0.3 },
  { name: 'down', structure: 0.5, polish: 0.4, warmth: 5, formalityShift: -0.8 },
  { name: 'lace', structure: 0.3, polish: 0.75, warmth: 1, formalityShift: 0.5 },
  { name: 'mesh', structure: 0.35, polish: 0.5, warmth: 1, formalityShift: -0.2 },
  { name: 'other', structure: 0.5, polish: 0.5, warmth: 3, formalityShift: 0 },
]

export function fabricInfo(name: string): FabricInfo {
  const lower = name.toLowerCase()
  return FABRICS.find((f) => lower.includes(f.name)) ?? FABRICS[FABRICS.length - 1]
}

export interface GarmentTypeInfo {
  label: string
  category: GarmentCategory
  formality: Formality
  warmth: Warmth
  coverage: Coverage
  fit: Fit
  fabric: string
  /** Roles this type can plausibly be worn in beyond its own category. */
  alternateRoles: GarmentCategory[]
  tags: string[]
}

/**
 * Common garment types offered as quick-picks after a photo is taken. The
 * `alternateRoles` here are what make the avant-garde end of the personality
 * slider possible: a slip dress that can be a top, a skirt that can be a top.
 */
export const GARMENT_TYPES: GarmentTypeInfo[] = [
  { label: 'T-shirt', category: 'top', formality: 2, warmth: 2, coverage: 'moderate', fit: 'straight', fabric: 'jersey', alternateRoles: [], tags: ['layerable'] },
  { label: 'Tank top', category: 'top', formality: 2, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'jersey', alternateRoles: [], tags: ['layerable'] },
  { label: 'Button-down shirt', category: 'top', formality: 4, warmth: 2, coverage: 'full', fit: 'straight', fabric: 'cotton', alternateRoles: ['outerwear'], tags: ['tuckable', 'layerable'] },
  { label: 'Blouse', category: 'top', formality: 4, warmth: 2, coverage: 'moderate', fit: 'relaxed', fabric: 'silk', alternateRoles: [], tags: ['tuckable'] },
  { label: 'Knit sweater', category: 'top', formality: 3, warmth: 4, coverage: 'full', fit: 'relaxed', fabric: 'knit', alternateRoles: [], tags: ['layerable'] },
  { label: 'Hoodie', category: 'top', formality: 1, warmth: 4, coverage: 'full', fit: 'oversized', fabric: 'fleece', alternateRoles: ['outerwear'], tags: [] },
  { label: 'Crop top', category: 'top', formality: 2, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'jersey', alternateRoles: [], tags: [] },
  { label: 'Corset / bustier', category: 'top', formality: 3, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'satin', alternateRoles: [], tags: ['statement'] },
  { label: 'Jeans', category: 'bottom', formality: 2, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'denim', alternateRoles: [], tags: [] },
  { label: 'Tailored trousers', category: 'bottom', formality: 4, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'suiting', alternateRoles: [], tags: ['sharp'] },
  { label: 'Wide-leg trousers', category: 'bottom', formality: 3, warmth: 3, coverage: 'full', fit: 'relaxed', fabric: 'wool', alternateRoles: [], tags: ['volume'] },
  { label: 'Mini skirt', category: 'bottom', formality: 3, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'cotton', alternateRoles: ['top'], tags: [] },
  { label: 'Midi skirt', category: 'bottom', formality: 3, warmth: 2, coverage: 'full', fit: 'relaxed', fabric: 'silk', alternateRoles: ['top', 'dress'], tags: ['volume'] },
  { label: 'Shorts', category: 'bottom', formality: 2, warmth: 1, coverage: 'minimal', fit: 'straight', fabric: 'cotton', alternateRoles: [], tags: [] },
  { label: 'Sweatpants', category: 'bottom', formality: 1, warmth: 4, coverage: 'full', fit: 'relaxed', fabric: 'fleece', alternateRoles: [], tags: [] },
  { label: 'Slip dress', category: 'dress', formality: 4, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'satin', alternateRoles: ['top'], tags: ['statement'] },
  { label: 'Shirt dress', category: 'dress', formality: 3, warmth: 2, coverage: 'full', fit: 'relaxed', fabric: 'cotton', alternateRoles: ['outerwear'], tags: ['layerable'] },
  { label: 'Knit dress', category: 'dress', formality: 3, warmth: 4, coverage: 'full', fit: 'fitted', fabric: 'knit', alternateRoles: [], tags: [] },
  { label: 'Gown', category: 'dress', formality: 5, warmth: 2, coverage: 'moderate', fit: 'fitted', fabric: 'satin', alternateRoles: [], tags: ['statement'] },
  { label: 'Blazer', category: 'outerwear', formality: 4, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'suiting', alternateRoles: ['top'], tags: ['sharp'] },
  { label: 'Denim jacket', category: 'outerwear', formality: 2, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'denim', alternateRoles: [], tags: [] },
  { label: 'Leather jacket', category: 'outerwear', formality: 3, warmth: 3, coverage: 'full', fit: 'fitted', fabric: 'leather', alternateRoles: [], tags: ['statement'] },
  { label: 'Trench coat', category: 'outerwear', formality: 4, warmth: 3, coverage: 'full', fit: 'relaxed', fabric: 'canvas', alternateRoles: [], tags: ['volume'] },
  { label: 'Puffer coat', category: 'outerwear', formality: 2, warmth: 5, coverage: 'full', fit: 'oversized', fabric: 'down', alternateRoles: [], tags: ['volume'] },
  { label: 'Overcoat', category: 'outerwear', formality: 4, warmth: 5, coverage: 'full', fit: 'straight', fabric: 'wool', alternateRoles: [], tags: [] },
  { label: 'Sneakers', category: 'shoes', formality: 2, warmth: 2, coverage: 'full', fit: 'straight', fabric: 'canvas', alternateRoles: [], tags: [] },
  { label: 'Loafers', category: 'shoes', formality: 4, warmth: 2, coverage: 'full', fit: 'straight', fabric: 'leather', alternateRoles: [], tags: ['sharp'] },
  { label: 'Boots', category: 'shoes', formality: 3, warmth: 4, coverage: 'full', fit: 'straight', fabric: 'leather', alternateRoles: [], tags: ['statement'] },
  { label: 'Heels', category: 'shoes', formality: 5, warmth: 1, coverage: 'minimal', fit: 'fitted', fabric: 'leather', alternateRoles: [], tags: ['statement'] },
  { label: 'Sandals', category: 'shoes', formality: 2, warmth: 1, coverage: 'minimal', fit: 'straight', fabric: 'leather', alternateRoles: [], tags: [] },
  { label: 'Bag', category: 'bag', formality: 3, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'leather', alternateRoles: [], tags: [] },
  { label: 'Belt', category: 'accessory', formality: 3, warmth: 3, coverage: 'full', fit: 'fitted', fabric: 'leather', alternateRoles: [], tags: ['waist'] },
  { label: 'Scarf', category: 'accessory', formality: 3, warmth: 4, coverage: 'full', fit: 'relaxed', fabric: 'wool', alternateRoles: [], tags: [] },
  { label: 'Jewellery', category: 'accessory', formality: 3, warmth: 3, coverage: 'full', fit: 'fitted', fabric: 'other', alternateRoles: [], tags: [] },
  { label: 'Hat', category: 'accessory', formality: 3, warmth: 3, coverage: 'full', fit: 'straight', fabric: 'wool', alternateRoles: [], tags: ['statement'] },
]

export function garmentType(label: string): GarmentTypeInfo | undefined {
  return GARMENT_TYPES.find((t) => t.label === label)
}

export const FIT_VOLUME: Record<Fit, number> = {
  fitted: 0,
  straight: 0.35,
  relaxed: 0.7,
  oversized: 1,
}
