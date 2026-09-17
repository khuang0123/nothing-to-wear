/**
 * Closet analysis.
 *
 * The product promise is "we only tell you to buy something if you genuinely
 * cannot style what you own". So the recommendation engine is marginal-gain
 * based: for each candidate piece we recompute how many wearable outfits the
 * closet would support with it, and rank by the difference. A piece that
 * unlocks nothing is never recommended, however fashionable.
 */

import type {
  Garment,
  GarmentCategory,
  ShoppingNeed,
  StylingContext,
  UserProfile,
  WardrobeReport,
} from '../types'
import { CLIMATE_WARMTH, contextProfile } from './context'
import { GARMENT_TYPES, type GarmentTypeInfo } from './fabrics'
import { colorName, isNeutral } from './color'

/** Contexts a closet should be able to dress, weighted by how often they come up. */
const LIFE_CONTEXTS: Array<{ context: StylingContext; weight: number }> = [
  { context: 'casual', weight: 3 },
  { context: 'work', weight: 3 },
  { context: 'date', weight: 2 },
  { context: 'event', weight: 1 },
]

const SLOT_CAP = 12

function wearableOnly(garments: Garment[]): Garment[] {
  return garments.filter((g) => g.origin !== 'predicted' || g.confirmed)
}

function byRole(garments: Garment[], role: GarmentCategory): Garment[] {
  return garments
    .filter((g) => g.category === role || g.alternateRoles.includes(role))
    .slice(0, SLOT_CAP)
}

/**
 * Number of combinations that are actually wearable: right formality band for
 * at least one life context, and not absurd for the climate.
 */
export function outfitCapacity(garments: Garment[], profile: UserProfile): number {
  const items = wearableOnly(garments)
  const tops = byRole(items, 'top')
  const bottoms = byRole(items, 'bottom')
  const dresses = items.filter((g) => g.category === 'dress').slice(0, SLOT_CAP)
  const shoes = byRole(items, 'shoes')
  if (shoes.length === 0) return 0

  const climate = CLIMATE_WARMTH[profile.climate]
  const profiles = LIFE_CONTEXTS.map(({ context }) =>
    contextProfile({ context, contextNote: '', adventurousness: 50, vibe: '', guardrails: true }),
  )

  const fits = (formality: number, warmth: number) =>
    profiles.some((p) => Math.abs(formality - p.targetFormality) <= p.tolerance + 0.6) &&
    Math.abs(warmth - climate) <= 1.8

  let count = 0
  for (const shoe of shoes) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        const formality = (top.formality + bottom.formality + shoe.formality * 0.7) / 2.7
        const warmth = (top.warmth + bottom.warmth + shoe.warmth * 0.7) / 2.7
        if (fits(formality, warmth)) count++
      }
    }
    for (const dress of dresses) {
      const formality = (dress.formality * 1.4 + shoe.formality * 0.7) / 2.1
      const warmth = (dress.warmth * 1.4 + shoe.warmth * 0.7) / 2.1
      if (fits(formality, warmth)) count++
    }
  }
  return count
}

/** 0-1 coverage of the slot x formality-band matrix a functioning closet needs. */
export function slotCoverage(garments: Garment[], profile: UserProfile): { coverage: number; gaps: string[] } {
  const items = wearableOnly(garments)
  const bands: Array<{ label: string; min: number; max: number }> = [
    { label: 'casual', min: 1, max: 2.5 },
    { label: 'smart', min: 2.5, max: 4 },
    { label: 'formal', min: 4, max: 5 },
  ]
  const slots: GarmentCategory[] = ['top', 'bottom', 'shoes']
  const cells: Array<{ key: string; filled: boolean }> = []

  for (const slot of slots) {
    for (const band of bands) {
      const filled = byRole(items, slot).some((g) => g.formality >= band.min && g.formality <= band.max)
      cells.push({ key: `${band.label} ${slot}`, filled })
    }
  }

  // Outerwear only counts as a required cell in climates that need it.
  if (CLIMATE_WARMTH[profile.climate] >= 3) {
    cells.push({
      key: 'a warm outer layer',
      filled: items.some((g) => g.category === 'outerwear' && g.warmth >= 3),
    })
  }

  const filled = cells.filter((c) => c.filled).length
  return {
    coverage: cells.length === 0 ? 0 : filled / cells.length,
    gaps: cells.filter((c) => !c.filled).map((c) => c.key),
  }
}

/** A colour that would slot into the existing closet rather than fight it. */
function suggestedColor(garments: Garment[]): { hex: string; name: string } {
  const items = wearableOnly(garments)
  const colors = items.flatMap((g) => g.colors)
  const neutrals = colors.filter(isNeutral).length
  // Closets break when they are all colour and no anchor, or all anchor and no joy.
  if (colors.length === 0 || neutrals / colors.length < 0.45) {
    return { hex: '#2e2e33', name: 'charcoal' }
  }
  if (neutrals === colors.length) {
    return { hex: '#8a4a3d', name: 'brick' }
  }
  const chromatic = colors.find((c) => !isNeutral(c)) ?? '#3d4a6b'
  return { hex: chromatic, name: colorName(chromatic) }
}

/** Templates worth considering as purchases: the workhorses, not the novelties. */
const CANDIDATE_LABELS = [
  'T-shirt',
  'Button-down shirt',
  'Knit sweater',
  'Blouse',
  'Jeans',
  'Tailored trousers',
  'Wide-leg trousers',
  'Midi skirt',
  'Shirt dress',
  'Blazer',
  'Overcoat',
  'Denim jacket',
  'Trench coat',
  'Sneakers',
  'Loafers',
  'Boots',
  'Heels',
]

function templateToGarment(t: GarmentTypeInfo, hex: string): Garment {
  return {
    id: `hypothetical_${t.label}`,
    label: t.label,
    category: t.category,
    colors: [hex],
    pattern: 'solid',
    formality: t.formality,
    warmth: t.warmth,
    coverage: t.coverage,
    fit: t.fit,
    fabric: t.fabric,
    origin: 'ai-suggested',
    alternateRoles: t.alternateRoles,
    tags: t.tags,
    createdAt: 0,
  }
}

export function shoppingNeeds(garments: Garment[], profile: UserProfile, max = 3): ShoppingNeed[] {
  const items = wearableOnly(garments)
  const baseline = outfitCapacity(items, profile)
  const { gaps } = slotCoverage(items, profile)
  const color = suggestedColor(items)

  const scored = CANDIDATE_LABELS.flatMap((label) => {
    const template = GARMENT_TYPES.find((t) => t.label === label)
    if (!template) return []
    // Don't suggest something they effectively already own.
    const alreadyOwned = items.some(
      (g) => g.category === template.category && Math.abs(g.formality - template.formality) < 1 && Math.abs(g.warmth - template.warmth) < 1.5,
    )
    if (alreadyOwned) return []

    const hypothetical = templateToGarment(template, color.hex)
    const unlocks = outfitCapacity([...items, hypothetical], profile) - baseline
    if (unlocks <= 0) return []

    const fillsGap = gaps.find(
      (g) => g.includes(template.category) || (g.includes('outer') && template.category === 'outerwear'),
    )
    return [
      {
        id: `need_${template.label.toLowerCase().replace(/\W+/g, '-')}`,
        query: `${color.name} ${template.label.toLowerCase()}`,
        category: template.category,
        formality: template.formality,
        warmth: template.warmth,
        reason: fillsGap
          ? `You have no ${fillsGap}. This one piece unlocks ${unlocks} new outfits from clothes you already own.`
          : `Unlocks ${unlocks} new outfits from clothes you already own — it is the missing connector, not a new direction.`,
        unlocks,
        priority: (fillsGap ? 'critical' : unlocks >= 6 ? 'high' : 'nice-to-have') as ShoppingNeed['priority'],
      } satisfies ShoppingNeed,
    ]
  })

  return scored
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, 'nice-to-have': 2 } as const
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority]
      return b.unlocks - a.unlocks
    })
    .slice(0, max)
}

export function analyseWardrobe(garments: Garment[], profile: UserProfile): WardrobeReport {
  const items = wearableOnly(garments)
  const capacity = outfitCapacity(items, profile)
  const { coverage, gaps } = slotCoverage(items, profile)
  const coreCount = items.filter((g) => ['top', 'bottom', 'dress', 'shoes', 'outerwear'].includes(g.category)).length

  const verdict: WardrobeReport['verdict'] =
    coreCount < 6 || capacity < 6 || coverage < 0.5 ? 'not-enough' : capacity < 24 || coverage < 0.8 ? 'workable' : 'rich'

  const needs = verdict === 'rich' ? [] : shoppingNeeds(items, profile, verdict === 'not-enough' ? 3 : 2)

  const summary =
    verdict === 'rich'
      ? `${capacity} wearable combinations from ${coreCount} pieces. You do not need to buy anything — you need to shuffle.`
      : verdict === 'workable'
        ? `${capacity} combinations from ${coreCount} pieces. Enough to work with; ${gaps.length ? `you are thin on ${gaps.slice(0, 2).join(' and ')}` : 'a couple of connectors would go a long way'}.`
        : `Only ${capacity} genuinely wearable combinations from ${coreCount} pieces. This is the case where shopping is the honest answer — second-hand first.`

  return { verdict, outfitCapacity: capacity, coverage, gaps, needs, summary }
}

/* ------------------------------------------------------------------ *
 * Predicting the rest of the closet
 * ------------------------------------------------------------------ */

interface PredictionRule {
  label: string
  when: (items: Garment[], profile: UserProfile) => boolean
  why: string
}

/**
 * Staples the user very likely owns but has not photographed yet. These are
 * inserted into the closet as `predicted` and must be confirmed before the
 * stylist will use them — the app guesses out loud rather than silently.
 */
const PREDICTION_RULES: PredictionRule[] = [
  {
    label: 'T-shirt',
    when: (items) => !items.some((g) => g.category === 'top' && g.formality <= 2),
    why: 'Almost every closet has a plain tee, and it is the base layer half your looks need.',
  },
  {
    label: 'Jeans',
    when: (items) => !items.some((g) => g.fabric.includes('denim') && g.category === 'bottom'),
    why: 'You have uploaded tops that all want a denim bottom.',
  },
  {
    label: 'Sneakers',
    when: (items) => !items.some((g) => g.category === 'shoes' && g.formality <= 2),
    why: 'Nothing you have uploaded can be worn casually without a flat shoe.',
  },
  {
    label: 'Overcoat',
    when: (items, profile) =>
      CLIMATE_WARMTH[profile.climate] >= 3.8 && !items.some((g) => g.category === 'outerwear' && g.warmth >= 4),
    why: 'Your location needs a real coat and none of your uploads is one.',
  },
  {
    label: 'Blazer',
    when: (items) =>
      items.some((g) => g.formality >= 4) && !items.some((g) => g.category === 'outerwear' && g.formality >= 4),
    why: 'You own formal pieces with nothing structured to layer over them.',
  },
  {
    label: 'Knit sweater',
    when: (items, profile) =>
      CLIMATE_WARMTH[profile.climate] >= 3 && !items.some((g) => g.warmth >= 4 && g.category === 'top'),
    why: 'A mid-weight knit is the piece that stretches a closet across two seasons.',
  },
  {
    label: 'Belt',
    when: (items) => !items.some((g) => g.tags.includes('waist')),
    why: 'Several of the looks we can build need a waist line.',
  },
]

export interface Prediction {
  garment: Garment
  why: string
}

export function predictWardrobe(garments: Garment[], profile: UserProfile, max = 4): Prediction[] {
  const items = wearableOnly(garments)
  const color = suggestedColor(items)
  const out: Prediction[] = []

  for (const rule of PREDICTION_RULES) {
    if (out.length >= max) break
    if (!rule.when(items, profile)) continue
    const template = GARMENT_TYPES.find((t) => t.label === rule.label)
    if (!template) continue
    out.push({
      garment: {
        ...templateToGarment(template, color.hex),
        id: `predicted_${template.label.toLowerCase().replace(/\W+/g, '-')}`,
        label: `${colorName(color.hex)} ${template.label.toLowerCase()}`,
        origin: 'predicted',
        confirmed: false,
        createdAt: Date.now(),
      },
      why: rule.why,
    })
  }
  return out
}
