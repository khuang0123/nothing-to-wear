/**
 * Turns "why are you using the app today" plus the free-text note into numeric
 * targets, and turns geography into a warmth target.
 */

import type { Climate, Coverage, StylingContext, StylingPreferences } from '../types'

export interface ContextProfile {
  label: string
  /** 1-5, what the occasion actually asks for. */
  targetFormality: number
  /** How far from target is still fine. `shuffle` is deliberately loose. */
  tolerance: number
  /** Floor imposed by the occasion itself, before personal modesty. */
  minCoverage: Coverage | null
  /** Occasion-specific saturation ceiling (funerals), null when unconstrained. */
  maxSaturation: number | null
  /** Notes echoed back into the outfit rationale. */
  cues: string[]
}

const CONTEXT_BASE: Record<StylingContext, { label: string; formality: number; tolerance: number }> = {
  event: { label: 'an event', formality: 4.2, tolerance: 0.8 },
  work: { label: 'a workday', formality: 3.4, tolerance: 0.9 },
  date: { label: 'a date', formality: 3.1, tolerance: 1.1 },
  casual: { label: 'a normal day', formality: 2.1, tolerance: 1.1 },
  shuffle: { label: 'shuffling for inspiration', formality: 3, tolerance: 2.2 },
}

const COVERAGE_RANK: Record<Coverage, number> = { minimal: 0, moderate: 1, full: 2 }

export function coverageAtLeast(actual: Coverage, floor: Coverage): boolean {
  return COVERAGE_RANK[actual] >= COVERAGE_RANK[floor]
}

interface NoteRule {
  words: string[]
  formality?: number
  minCoverage?: Coverage
  maxSaturation?: number
  tolerance?: number
  cue: string
}

/**
 * Occasion keywords that change the brief more than the top-level context does.
 * A "black tie gala" and a "backyard birthday" are both `event`.
 */
const NOTE_RULES: NoteRule[] = [
  { words: ['black tie', 'gala', 'opera'], formality: 5, tolerance: 0.5, cue: 'black-tie level formality' },
  { words: ['wedding', 'reception'], formality: 4.5, minCoverage: 'moderate', cue: 'wedding dress code' },
  {
    words: ['funeral', 'memorial', 'wake'],
    formality: 4.2,
    minCoverage: 'full',
    maxSaturation: 0.2,
    cue: 'sombre, covered, low colour',
  },
  { words: ['interview', 'presentation', 'pitch', 'panel'], formality: 4.2, minCoverage: 'moderate', cue: 'you need to read as credible' },
  {
    words: ['church', 'temple', 'mosque', 'synagogue', 'shrine', 'service', 'prayer'],
    minCoverage: 'full',
    formality: 3.8,
    cue: 'place of worship coverage',
  },
  { words: ['club', 'party', 'night out', 'concert', 'rave'], formality: 3.2, tolerance: 1.5, cue: 'night-out energy' },
  { words: ['beach', 'pool', 'picnic', 'park', 'hike'], formality: 1.8, cue: 'outdoors and informal' },
  { words: ['dinner', 'restaurant'], formality: 3.6, cue: 'sit-down dinner' },
  { words: ['office', 'client', 'meeting', 'board'], formality: 3.9, cue: 'office-facing' },
  { words: ['wfh', 'home', 'remote'], formality: 1.8, cue: 'nobody is seeing your shoes' },
  { words: ['family', 'parents', 'grandparent', 'in-law'], minCoverage: 'moderate', cue: 'family-safe' },
  { words: ['first date'], formality: 3.2, tolerance: 1, cue: 'first impression' },
]

export function contextProfile(prefs: StylingPreferences): ContextProfile {
  const base = CONTEXT_BASE[prefs.context]
  const note = prefs.contextNote.toLowerCase()
  const profile: ContextProfile = {
    label: base.label,
    targetFormality: base.formality,
    tolerance: base.tolerance,
    minCoverage: null,
    maxSaturation: null,
    cues: [],
  }

  for (const rule of NOTE_RULES) {
    if (!rule.words.some((w) => note.includes(w))) continue
    if (rule.formality !== undefined) profile.targetFormality = rule.formality
    if (rule.tolerance !== undefined) profile.tolerance = rule.tolerance
    if (rule.minCoverage && (!profile.minCoverage || coverageAtLeast(rule.minCoverage, profile.minCoverage))) {
      profile.minCoverage = rule.minCoverage
    }
    if (rule.maxSaturation !== undefined) {
      profile.maxSaturation = Math.min(profile.maxSaturation ?? 1, rule.maxSaturation)
    }
    profile.cues.push(rule.cue)
  }

  return profile
}

/** Warmth (1-5) the climate is asking the outfit to deliver. */
export const CLIMATE_WARMTH: Record<Climate, number> = {
  hot: 1.3,
  warm: 2.1,
  mild: 3,
  cool: 3.9,
  cold: 4.7,
}

/**
 * Very rough climate guess from a free-text location so onboarding does not
 * need a geocoding service. The user can always override the dropdown.
 */
export function guessClimate(location: string): Climate | null {
  const l = location.toLowerCase()
  const table: Array<[string[], Climate]> = [
    [['singapore', 'bangkok', 'lagos', 'dubai', 'mumbai', 'jakarta', 'miami', 'manila', 'nairobi'], 'hot'],
    [['los angeles', 'madrid', 'lisbon', 'sydney', 'tel aviv', 'athens', 'rome', 'barcelona', 'texas'], 'warm'],
    [['london', 'paris', 'new york', 'tokyo', 'seoul', 'berlin', 'shanghai', 'vancouver', 'seattle'], 'mild'],
    [['chicago', 'boston', 'amsterdam', 'copenhagen', 'dublin', 'beijing', 'toronto'], 'cool'],
    [['moscow', 'reykjavik', 'helsinki', 'oslo', 'stockholm', 'harbin', 'edmonton', 'minneapolis'], 'cold'],
  ]
  for (const [cities, climate] of table) {
    if (cities.some((c) => l.includes(c))) return climate
  }
  return null
}

export const CONTEXT_OPTIONS: Array<{
  value: StylingContext
  title: string
  blurb: string
  icon: string
}> = [
  { value: 'event', title: 'An event', blurb: 'Wedding, gala, birthday, something with photos', icon: '✦' },
  { value: 'work', title: 'A workday', blurb: 'Office, campus, client-facing', icon: '▦' },
  { value: 'date', title: 'A date', blurb: 'First, fifth, or long-term', icon: '♡' },
  { value: 'casual', title: 'A normal day', blurb: 'Errands, coffee, nothing to prove', icon: '◦' },
  { value: 'shuffle', title: 'Just shuffling', blurb: 'Show me combinations I have never tried', icon: '⟳' },
]
