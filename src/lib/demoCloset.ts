/**
 * A sample closet, so the app can be evaluated without photographing fourteen
 * garments first. Loaded from a button in onboarding; every piece is marked
 * `user` origin because from the app's point of view these are real items.
 */

import type { Garment, UserProfile } from '../types'
import { GARMENT_TYPES } from './fabrics'
import { colorName } from './color'

interface Seed {
  type: string
  colors: string[]
  pattern?: Garment['pattern']
  fit?: Garment['fit']
}

const SEEDS: Seed[] = [
  { type: 'T-shirt', colors: ['#f2efe8'], fit: 'straight' },
  { type: 'T-shirt', colors: ['#1d1c1a'], fit: 'relaxed' },
  { type: 'Button-down shirt', colors: ['#c8d3e0'], pattern: 'stripe' },
  { type: 'Blouse', colors: ['#7d2e24'] },
  { type: 'Knit sweater', colors: ['#c9b28c'], fit: 'oversized' },
  { type: 'Jeans', colors: ['#3b4a63'], fit: 'straight' },
  { type: 'Tailored trousers', colors: ['#25242a'] },
  { type: 'Wide-leg trousers', colors: ['#4a4b3f'] },
  { type: 'Midi skirt', colors: ['#2e3a55'] },
  { type: 'Slip dress', colors: ['#6d4b58'] },
  { type: 'Blazer', colors: ['#1f1e21'] },
  { type: 'Leather jacket', colors: ['#141313'] },
  { type: 'Sneakers', colors: ['#e8e4dc'] },
  { type: 'Boots', colors: ['#2a211c'] },
  { type: 'Loafers', colors: ['#3a2b22'] },
  { type: 'Belt', colors: ['#2a211c'] },
]

export function demoGarments(now = Date.now()): Garment[] {
  return SEEDS.flatMap((seed, i) => {
    const t = GARMENT_TYPES.find((g) => g.label === seed.type)
    if (!t) return []
    return [
      {
        id: `demo_${i}`,
        label: `${colorName(seed.colors[0])} ${t.label.toLowerCase()}`,
        category: t.category,
        shape: t.shape,
        colors: seed.colors,
        pattern: seed.pattern ?? 'solid',
        formality: t.formality,
        warmth: t.warmth,
        coverage: t.coverage,
        fit: seed.fit ?? t.fit,
        fabric: t.fabric,
        origin: 'user' as const,
        alternateRoles: t.alternateRoles,
        tags: t.tags,
        createdAt: now - i * 1000,
      },
    ]
  })
}

export function demoProfile(): Omit<UserProfile, 'id' | 'createdAt'> {
  return {
    name: 'Sample',
    phone: '+15550000000',
    age: 27,
    pronouns: 'they/them',
    genderExpression: 'androgynous',
    modesty: 0,
    location: 'Chicago',
    climate: 'cool',
    biometrics: { heightCm: 172, bodyShape: 'rectangle', undertone: 'cool' },
    closetVisibility: 'private',
  }
}
