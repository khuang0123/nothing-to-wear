/**
 * Domain model for Nothing To Wear.
 *
 * Everything the stylist reasons about is expressed as numeric axes (1-5 scales)
 * plus a handful of enums, so the local rule engine and a future LLM-backed
 * engine can consume the exact same shapes.
 */

export type GarmentCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes'
  | 'bag'
  | 'accessory'

/** 1 = loungewear, 2 = casual, 3 = smart casual, 4 = business/cocktail, 5 = formal. */
export type Formality = 1 | 2 | 3 | 4 | 5

/** 1 = hot weather, 3 = mild, 5 = deep winter. */
export type Warmth = 1 | 2 | 3 | 4 | 5

export type Pattern =
  | 'solid'
  | 'stripe'
  | 'check'
  | 'floral'
  | 'graphic'
  | 'animal'
  | 'abstract'

/** How much skin the piece leaves out. Feeds the modesty guardrail. */
export type Coverage = 'minimal' | 'moderate' | 'full'

/** How the piece sits on the body. Drives proportion and silhouette scoring. */
export type Fit = 'fitted' | 'straight' | 'relaxed' | 'oversized'

/** How a garment entered the closet. Surfaced in the UI so AI guesses are never passed off as real. */
export type GarmentOrigin = 'user' | 'predicted' | 'ai-suggested'

export interface Garment {
  id: string
  label: string
  category: GarmentCategory
  /** Dominant colours as hex, most dominant first. */
  colors: string[]
  pattern: Pattern
  formality: Formality
  warmth: Warmth
  coverage: Coverage
  fit: Fit
  fabric: string
  origin: GarmentOrigin
  /** Alternative roles this piece can be styled in, e.g. a skirt worn as a tube top. */
  alternateRoles: GarmentCategory[]
  tags: string[]
  imageDataUrl?: string
  /** Set on `predicted` items once the user says "yes I own this". */
  confirmed?: boolean
  createdAt: number
}

export type StylingContext = 'event' | 'work' | 'date' | 'casual' | 'shuffle'

export interface StylingPreferences {
  context: StylingContext
  /** Free text detail for the occasion, e.g. "outdoor wedding, 2pm". */
  contextNote: string
  /** 0 = conservative / flattering-and-safe, 100 = avant-garde / rule-breaking. */
  adventurousness: number
  /** Natural language vibe, e.g. "sexy but smart". */
  vibe: string
  /** When true the app nudges on context / modesty / weather mismatches. */
  guardrails: boolean
}

export type Climate = 'hot' | 'warm' | 'mild' | 'cool' | 'cold'

export type BodyShape =
  | 'hourglass'
  | 'pear'
  | 'apple'
  | 'rectangle'
  | 'inverted-triangle'
  | 'unspecified'

export type Undertone = 'warm' | 'cool' | 'neutral' | 'unspecified'

export interface Biometrics {
  heightCm?: number
  bodyShape: BodyShape
  undertone: Undertone
  hairColor?: string
}

export interface UserProfile {
  id: string
  name: string
  phone: string
  age?: number
  pronouns: string
  /** Self-described, never inferred from name or biometrics. */
  genderExpression: 'feminine' | 'masculine' | 'androgynous' | 'fluid' | 'unspecified'
  religion?: string
  /** 0 = no coverage rules, 1 = prefers modest, 2 = modest, 3 = strict coverage. */
  modesty: 0 | 1 | 2 | 3
  location: string
  climate: Climate
  biometrics: Biometrics
  closetVisibility: 'private' | 'friends'
  createdAt: number
}

export type GuardrailKind = 'context' | 'modesty' | 'weather' | 'comfort'

export interface Guardrail {
  kind: GuardrailKind
  /** The piece that triggered it, when attributable. */
  garmentId?: string
  message: string
  /** What the app offers to do instead. */
  suggestion: string
  severity: 'nudge' | 'strong'
}

export interface AccessoryIdea {
  label: string
  /** Hex the idea is anchored to, for the swatch dot. */
  color: string
  why: string
}

export interface PaletteSwatch {
  hex: string
  role: 'anchor' | 'secondary' | 'accent'
  name: string
}

export interface ScoreBreakdown {
  context: number
  climate: number
  color: number
  vibe: number
  silhouette: number
  daring: number
}

export interface Outfit {
  id: string
  itemIds: string[]
  /** itemId -> the role it is worn in, which can differ from its category. */
  roles: Record<string, GarmentCategory>
  accessories: AccessoryIdea[]
  palette: PaletteSwatch[]
  score: number
  breakdown: ScoreBreakdown
  /** Concrete reasons this combination was picked, generated from the real scores. */
  rationale: string[]
  /** Styling instructions, e.g. "half-tuck the shirt". */
  moves: string[]
  vibeMatch: string[]
  warnings: Guardrail[]
  context: StylingContext
  origin: 'generated' | 'ootd'
  photoDataUrl?: string
  saved: boolean
  createdAt: number
}

export interface Friend {
  id: string
  name: string
  phone: string
  addedAt: number
}

export interface ShoppingNeed {
  id: string
  /** What to look for, phrased as a shopping query. */
  query: string
  category: GarmentCategory
  formality: Formality
  warmth: Warmth
  /** Why the closet needs it, in terms of the gap it unlocks. */
  reason: string
  /** How many extra outfits it would unlock. */
  unlocks: number
  priority: 'critical' | 'high' | 'nice-to-have'
}

export type ClosetVerdict = 'rich' | 'workable' | 'not-enough'

export interface WardrobeReport {
  verdict: ClosetVerdict
  outfitCapacity: number
  /** 0-1 coverage of the slot x formality x warmth matrix. */
  coverage: number
  gaps: string[]
  needs: ShoppingNeed[]
  summary: string
}

export interface AppData {
  version: number
  profile: UserProfile | null
  garments: Garment[]
  outfits: Outfit[]
  friends: Friend[]
  preferences: StylingPreferences
  /** Prediction ids the user said they do not own, so we stop asking. */
  dismissedPredictions: string[]
  /** Set once the user has been through activation, drives the "closet first" rule. */
  hasCompletedFirstSession: boolean
}
