/**
 * Natural-language vibe parsing.
 *
 * The user types something like "sexy but smart, not try-hard". We turn that
 * into numeric targets on the axes the stylist scores against. This is a local
 * semantic lexicon rather than an LLM call so the MVP works offline and
 * deterministically; `parseVibe` is the seam an LLM-backed parser would
 * implement (see `StylistEngine` in stylist.ts).
 */

export interface VibeAxes {
  /** 1 loungewear - 5 formal. */
  formality: number
  /** 0 quiet - 1 look-at-me. */
  boldness: number
  /** 0 covered - 1 skin-forward. */
  skin: number
  /** 0 soft and draped - 1 sharp and tailored. */
  structure: number
  /** 0 muted - 1 saturated. */
  saturation: number
  /** 0 tonal - 1 high contrast. */
  contrast: number
  /** 0 flat and plain - 1 pattern and texture play. */
  texture: number
  /** 0 deliberately undone - 1 crisp and neat. */
  polish: number
}

export const NEUTRAL_VIBE: VibeAxes = {
  formality: 3,
  boldness: 0.5,
  skin: 0.5,
  structure: 0.5,
  saturation: 0.5,
  contrast: 0.5,
  texture: 0.5,
  polish: 0.5,
}

interface VibeTerm {
  /** Synonyms and near-misses that should hit this entry. */
  words: string[]
  axes: Partial<VibeAxes>
  /** Shown back to the user so they can see what the app understood. */
  reading: string
}

/**
 * Hand-tuned vibe vocabulary. Entries are matched as substrings so
 * "flirty-ish" and "flirtier" both land on "flirt".
 */
export const VIBE_TERMS: VibeTerm[] = [
  {
    words: ['sexy', 'hot', 'seductive', 'sultry', 'flirt', 'alluring'],
    axes: { skin: 0.85, boldness: 0.75, structure: 0.6, contrast: 0.6, polish: 0.6 },
    reading: 'skin-forward and body-conscious',
  },
  {
    words: ['smart', 'sharp', 'professional', 'polished', 'put together', 'business'],
    axes: { formality: 4, structure: 0.85, polish: 0.9, boldness: 0.4, skin: 0.25 },
    reading: 'tailored and crisp',
  },
  {
    words: ['fierce', 'powerful', 'commanding', 'boss', 'dominant', 'strong'],
    axes: { boldness: 0.9, structure: 0.85, contrast: 0.8, formality: 4, polish: 0.75 },
    reading: 'high-impact with hard lines',
  },
  {
    words: ['soft', 'gentle', 'romantic', 'dreamy', 'tender', 'delicate'],
    axes: { structure: 0.2, saturation: 0.35, contrast: 0.25, texture: 0.6, polish: 0.55 },
    reading: 'draped and low-contrast',
  },
  {
    words: ['cozy', 'comfy', 'comfortable', 'snug', 'relaxed', 'lazy'],
    axes: { formality: 2, structure: 0.2, polish: 0.3, texture: 0.65, skin: 0.25 },
    reading: 'unstructured and easy',
  },
  {
    words: ['minimal', 'clean', 'quiet', 'understated', 'simple', 'stealth'],
    axes: { boldness: 0.2, saturation: 0.2, texture: 0.2, contrast: 0.35, polish: 0.85 },
    reading: 'stripped back, no noise',
  },
  {
    words: ['maximal', 'loud', 'extra', 'more is more', 'clashy', 'chaotic'],
    axes: { boldness: 0.95, saturation: 0.85, texture: 0.95, contrast: 0.85 },
    reading: 'layered, loud and pattern-heavy',
  },
  {
    words: ['edgy', 'grunge', 'punk', 'rock', 'moody', 'dark'],
    axes: { boldness: 0.8, saturation: 0.3, contrast: 0.8, polish: 0.25, texture: 0.7 },
    reading: 'dark, roughed-up, high contrast',
  },
  {
    words: ['expensive', 'luxury', 'rich', 'elegant', 'refined', 'classy', 'old money'],
    axes: { formality: 4, saturation: 0.25, texture: 0.4, polish: 0.95, structure: 0.7, boldness: 0.3 },
    reading: 'quiet-luxury restraint',
  },
  {
    words: ['playful', 'fun', 'cute', 'bubbly', 'silly', 'joyful', 'colourful', 'colorful'],
    axes: { saturation: 0.85, boldness: 0.7, texture: 0.7, formality: 2, polish: 0.45 },
    reading: 'bright and unserious',
  },
  {
    words: ['artsy', 'artistic', 'avant', 'creative', 'weird', 'experimental', 'sculptural'],
    axes: { boldness: 0.9, structure: 0.7, texture: 0.85, contrast: 0.7, polish: 0.4 },
    reading: 'shape-led and experimental',
  },
  {
    words: ['sporty', 'athletic', 'sport', 'gym', 'active'],
    axes: { formality: 2, structure: 0.5, polish: 0.5, saturation: 0.6, texture: 0.4 },
    reading: 'athletic and functional',
  },
  {
    words: ['nerdy', 'geeky', 'academic', 'preppy', 'librarian', 'dark academia'],
    axes: { formality: 3, structure: 0.7, texture: 0.7, polish: 0.8, saturation: 0.3, skin: 0.2 },
    reading: 'bookish layering',
  },
  {
    words: ['mysterious', 'enigmatic', 'aloof', 'cold'],
    axes: { saturation: 0.2, contrast: 0.7, skin: 0.25, polish: 0.7, boldness: 0.55 },
    reading: 'closed-off and monochrome',
  },
  {
    words: ['approachable', 'friendly', 'warm', 'kind', 'easy'],
    axes: { saturation: 0.6, contrast: 0.35, boldness: 0.35, structure: 0.35, polish: 0.55 },
    reading: 'warm and unintimidating',
  },
  {
    words: ['nonchalant', 'effortless', 'undone', 'casual', 'thrown together', 'lowkey', 'low key'],
    axes: { formality: 2, polish: 0.2, structure: 0.35, boldness: 0.35 },
    reading: 'deliberately undone',
  },
  {
    words: ['retro', 'vintage', 'y2k', '70s', '90s', 'seventies', 'nineties', 'throwback'],
    axes: { texture: 0.8, saturation: 0.65, boldness: 0.65, polish: 0.45 },
    reading: 'period-referencing',
  },
  {
    words: ['futuristic', 'techno', 'cyber', 'space', 'metallic'],
    axes: { structure: 0.85, saturation: 0.3, contrast: 0.75, texture: 0.8, boldness: 0.8 },
    reading: 'hard-surfaced and technical',
  },
  {
    words: ['androgynous', 'genderless', 'masc', 'butch', 'menswear'],
    axes: { structure: 0.8, skin: 0.2, saturation: 0.3, polish: 0.7 },
    reading: 'menswear-leaning lines',
  },
  {
    words: ['femme', 'feminine', 'girly', 'pretty'],
    axes: { structure: 0.35, saturation: 0.6, texture: 0.7, skin: 0.6 },
    reading: 'femme-leaning shapes',
  },
  {
    words: ['modest', 'covered', 'conservative', 'respectful'],
    axes: { skin: 0.08, polish: 0.75, formality: 3.5 },
    reading: 'fully covered',
  },
]

const INTENSIFIERS = ['very', 'super', 'really', 'extremely', 'so', 'mad', 'hella']
const SOFTENERS = ['slightly', 'a bit', 'kinda', 'kind of', 'a little', 'lowkey', 'somewhat']
const NEGATORS = ['not', 'no', "n't", 'less', 'without', 'avoid', 'anti', 'nothing']

export interface ParsedVibe {
  axes: VibeAxes
  /** Human-readable readings for the terms that matched, in input order. */
  matched: string[]
  /** Words we could not map — shown to the user so the app never bluffs. */
  unmapped: string[]
}

/** True when `word` is negated by the words immediately before it in `text`. */
function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 22), index)
  return NEGATORS.some((n) => before.includes(n))
}

function modifierFor(text: string, index: number): number {
  const before = text.slice(Math.max(0, index - 18), index)
  if (INTENSIFIERS.some((w) => before.includes(w))) return 1.6
  if (SOFTENERS.some((w) => before.includes(w))) return 0.55
  return 1
}

/**
 * Parse free text into vibe axes. Multiple terms are blended by weight rather
 * than the last one winning, so "sexy but smart" lands between the two instead
 * of collapsing onto "smart".
 */
export function parseVibe(input: string): ParsedVibe {
  const text = input.toLowerCase()
  const totals: Partial<Record<keyof VibeAxes, { sum: number; weight: number }>> = {}
  const matched: string[] = []

  for (const term of VIBE_TERMS) {
    let hitIndex = -1
    for (const w of term.words) {
      const i = text.indexOf(w)
      if (i >= 0 && (hitIndex < 0 || i < hitIndex)) hitIndex = i
    }
    if (hitIndex < 0) continue

    const negated = isNegated(text, hitIndex)
    const weight = modifierFor(text, hitIndex)
    matched.push(negated ? `not ${term.reading}` : term.reading)

    for (const [key, target] of Object.entries(term.axes) as Array<
      [keyof VibeAxes, number]
    >) {
      const neutral = NEUTRAL_VIBE[key]
      // Negation mirrors the term across neutral instead of zeroing it, so
      // "not sexy" means covered-up rather than "no opinion".
      const value = negated ? neutral - (target - neutral) : target
      const bucket = (totals[key] ??= { sum: 0, weight: 0 })
      bucket.sum += value * weight
      bucket.weight += weight
    }
  }

  const axes: VibeAxes = { ...NEUTRAL_VIBE }
  for (const [key, bucket] of Object.entries(totals) as Array<
    [keyof VibeAxes, { sum: number; weight: number }]
  >) {
    const raw = bucket.sum / bucket.weight
    axes[key] = key === 'formality' ? clamp(raw, 1, 5) : clamp(raw, 0, 1)
  }

  const known = new Set(VIBE_TERMS.flatMap((t) => t.words.flatMap((w) => w.split(' '))))
  const stop = new Set([
    ...INTENSIFIERS,
    ...SOFTENERS,
    ...NEGATORS,
    'but',
    'and',
    'or',
    'a',
    'an',
    'the',
    'too',
    'ish',
    'vibe',
    'vibes',
    'look',
    'feel',
    'feeling',
    'want',
    'wanna',
    'be',
    'im',
    "i'm",
    'i',
    'to',
    'of',
    'with',
    'more',
  ])
  const unmapped = Array.from(
    new Set(
      text
        .split(/[^a-z']+/)
        .filter((w) => w.length > 2 && !stop.has(w) && !known.has(w)),
    ),
  )

  return { axes, matched, unmapped }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Suggestion chips for the vibe field. */
export const VIBE_SUGGESTIONS = [
  'sexy but smart',
  'fierce, not try-hard',
  'quiet luxury',
  'artsy and a bit weird',
  'cozy but expensive',
  'nonchalant, lowkey',
  'dark academia',
  'playful and colourful',
]
