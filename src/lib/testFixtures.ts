/** Shared builders for the unit tests. Not imported by the app. */

import type { Garment, StylingPreferences, UserProfile } from '../types'
import { garmentType } from './fabrics'
import { demoProfile } from './demoCloset'

export function makeProfile(patch: Partial<UserProfile> = {}): UserProfile {
  return {
    ...demoProfile(),
    id: 'user_test',
    createdAt: 0,
    ...patch,
    biometrics: { ...demoProfile().biometrics, ...patch.biometrics },
  }
}

export function makePrefs(patch: Partial<StylingPreferences> = {}): StylingPreferences {
  return {
    context: 'casual',
    contextNote: '',
    adventurousness: 50,
    vibe: '',
    guardrails: true,
    ...patch,
  }
}

/** Build a garment from a known type label, overriding whatever the test cares about. */
export function makeGarment(typeLabel: string, patch: Partial<Garment> = {}): Garment {
  const t = garmentType(typeLabel)
  if (!t) throw new Error(`Unknown garment type in fixture: ${typeLabel}`)
  return {
    id: patch.id ?? `item_${typeLabel.replace(/\W+/g, '_')}`,
    label: patch.label ?? typeLabel.toLowerCase(),
    category: t.category,
    colors: ['#2e2e33'],
    pattern: 'solid',
    formality: t.formality,
    warmth: t.warmth,
    coverage: t.coverage,
    fit: t.fit,
    fabric: t.fabric,
    origin: 'user',
    alternateRoles: t.alternateRoles,
    tags: t.tags,
    createdAt: 0,
    ...patch,
  }
}
