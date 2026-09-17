/**
 * The stylist: takes a closet plus the four preference dimensions and returns
 * scored outfits with the reasoning attached.
 *
 * Design notes
 * ------------
 * 1. Outfits are built from *skeletons* (slot lists), not from hardcoded pairs.
 *    A slot can require a role swap, which is how "skirt worn as a top" becomes
 *    a first-class outcome rather than a gimmick.
 * 2. Every outfit is reduced to the same numeric axes the vibe parser produces,
 *    so "sexy but smart" is compared against the clothes on equal terms.
 * 3. The adventurousness slider does not just add noise: it re-weights the
 *    scoring function. At the conservative end, body-shape and colour harmony
 *    dominate. At the avant-garde end, clash and role swaps are rewarded and
 *    flattery is mostly ignored.
 * 4. Rationale is generated from the scores that actually won, so it cannot
 *    drift into horoscope copy.
 */

import type {
  AccessoryIdea,
  Garment,
  GarmentCategory,
  Guardrail,
  Outfit,
  ScoreBreakdown,
  StylingPreferences,
  UserProfile,
} from '../types'
import {
  buildPalette,
  colorName,
  contrastRatio,
  hexToHsl,
  isNeutral,
  relationBetween,
} from './color'
import { CLIMATE_WARMTH, contextProfile, type ContextProfile } from './context'
import { FIT_VOLUME, fabricInfo } from './fabrics'
import { checkOutfit } from './guardrails'
import { NEUTRAL_VIBE, parseVibe, type ParsedVibe, type VibeAxes } from './lexicon'

export interface StylistInput {
  garments: Garment[]
  profile: UserProfile
  prefs: StylingPreferences
  /** Previously generated outfits, used to penalise repeats. */
  history?: Outfit[]
  /** Pieces the user insists on wearing today. */
  pinnedIds?: string[]
  limit?: number
}

/**
 * The seam for swapping in a hosted model later: an LLM engine would implement
 * the same interface and could reuse everything below for scoring/validation.
 */
export interface StylistEngine {
  name: string
  generate(input: StylistInput): Outfit[]
}

interface Slot {
  role: GarmentCategory
  /** Slot must be filled by a piece whose own category is different. */
  requireSwap?: boolean
  optional?: boolean
}

interface Skeleton {
  name: string
  slots: Slot[]
  /** How unconventional the structure itself is, 0-1. */
  daring: number
}

const SKELETONS: Skeleton[] = [
  { name: 'top-and-bottom', slots: [{ role: 'top' }, { role: 'bottom' }, { role: 'shoes' }], daring: 0 },
  {
    name: 'top-bottom-outer',
    slots: [{ role: 'top' }, { role: 'bottom' }, { role: 'shoes' }, { role: 'outerwear' }],
    daring: 0.1,
  },
  { name: 'dress', slots: [{ role: 'dress' }, { role: 'shoes' }], daring: 0.05 },
  {
    name: 'dress-and-outer',
    slots: [{ role: 'dress' }, { role: 'shoes' }, { role: 'outerwear' }],
    daring: 0.15,
  },
  {
    name: 'double-top',
    slots: [{ role: 'top' }, { role: 'top' }, { role: 'bottom' }, { role: 'shoes' }],
    daring: 0.45,
  },
  {
    name: 'swapped-top',
    slots: [{ role: 'top', requireSwap: true }, { role: 'bottom' }, { role: 'shoes' }],
    daring: 0.8,
  },
  {
    name: 'dress-over-trousers',
    slots: [{ role: 'dress' }, { role: 'bottom' }, { role: 'shoes' }],
    daring: 0.9,
  },
]

const COVERAGE_SKIN: Record<Garment['coverage'], number> = {
  minimal: 0.9,
  moderate: 0.5,
  full: 0.15,
}

const ROLE_WEIGHT: Partial<Record<GarmentCategory, number>> = {
  dress: 1.4,
  top: 1,
  bottom: 1,
  outerwear: 0.9,
  shoes: 0.7,
}

export interface OutfitPiece {
  garment: Garment
  role: GarmentCategory
}

function canPlay(g: Garment, slot: Slot): boolean {
  if (slot.requireSwap) return g.category !== slot.role && g.alternateRoles.includes(slot.role)
  return g.category === slot.role || g.alternateRoles.includes(slot.role)
}

/* ------------------------------------------------------------------ *
 * Reducing an outfit to the vibe axes
 * ------------------------------------------------------------------ */

export interface OutfitShape extends VibeAxes {
  warmth: number
  volumeTop: number
  volumeBottom: number
  roleSwaps: number
  patternCount: number
  waistDefined: boolean
  colors: string[]
}

export function outfitShape(pieces: OutfitPiece[]): OutfitShape {
  const core = pieces.filter((p) => p.role !== 'accessory' && p.role !== 'bag')
  const weightOf = (p: OutfitPiece) => ROLE_WEIGHT[p.role] ?? 0.8
  const totalWeight = core.reduce((s, p) => s + weightOf(p), 0) || 1

  const weighted = (fn: (p: OutfitPiece) => number) =>
    core.reduce((s, p) => s + fn(p) * weightOf(p), 0) / totalWeight

  const formality = weighted((p) => p.garment.formality)
  const warmth = weighted((p) => p.garment.warmth)

  const fabricStructure = weighted((p) => fabricInfo(p.garment.fabric).structure)
  const volumeTop = Math.max(
    0,
    ...core.filter((p) => p.role === 'top' || p.role === 'dress' || p.role === 'outerwear').map((p) => FIT_VOLUME[p.garment.fit]),
  )
  const volumeBottom = Math.max(
    0,
    ...core.filter((p) => p.role === 'bottom').map((p) => FIT_VOLUME[p.garment.fit]),
  )
  const avgVolume = weighted((p) => FIT_VOLUME[p.garment.fit])
  const structure = clamp01(0.7 * fabricStructure + 0.3 * (1 - avgVolume))

  const hasOversized = core.some((p) => p.garment.fit === 'oversized')
  const polish = clamp01(weighted((p) => fabricInfo(p.garment.fabric).polish) - (hasOversized ? 0.12 : 0))

  const colors = core.flatMap((p) => p.garment.colors.slice(0, 2))
  const chromatic = colors.filter((c) => !isNeutral(c))
  const saturation =
    chromatic.length === 0
      ? 0.08
      : clamp01(
          (chromatic.reduce((s, c) => s + hexToHsl(c).s / 100, 0) / chromatic.length) *
            (0.45 + 0.55 * (chromatic.length / Math.max(1, colors.length))),
        )

  let maxContrast = 1
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      maxContrast = Math.max(maxContrast, contrastRatio(colors[i], colors[j]))
    }
  }
  const contrast = clamp01((maxContrast - 1) / 11)

  const patterned = core.filter((p) => p.garment.pattern !== 'solid')
  const patternTypes = new Set(patterned.map((p) => p.garment.pattern))
  const texture = clamp01(
    (patterned.length / Math.max(1, core.length)) * 0.65 +
      (patternTypes.size > 1 ? 0.35 : 0) +
      (core.some((p) => ['velvet', 'lace', 'mesh', 'corduroy', 'tweed'].some((f) => p.garment.fabric.includes(f))) ? 0.15 : 0),
  )

  const skinPieces = core.filter((p) => p.role !== 'shoes' && p.role !== 'outerwear')
  const skin =
    skinPieces.length === 0
      ? 0.4
      : clamp01(skinPieces.reduce((s, p) => s + COVERAGE_SKIN[p.garment.coverage], 0) / skinPieces.length)

  const roleSwaps = pieces.filter((p) => p.garment.category !== p.role).length
  const statements = core.filter((p) => p.garment.tags.includes('statement')).length

  const boldness = clamp01(
    0.32 * saturation +
      0.22 * contrast +
      0.18 * texture +
      0.16 * Math.min(1, roleSwaps / 1.5) +
      0.12 * Math.min(1, statements / 2),
  )

  const waistDefined =
    pieces.some((p) => p.garment.tags.includes('waist')) ||
    core.some((p) => (p.role === 'top' || p.role === 'dress') && p.garment.fit === 'fitted')

  return {
    formality,
    warmth,
    boldness,
    skin,
    structure,
    saturation,
    contrast,
    texture,
    polish,
    volumeTop,
    volumeBottom,
    roleSwaps,
    patternCount: patterned.length,
    waistDefined,
    colors,
  }
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/** Proportion rules. Only weighted heavily for conservative users. */
export function silhouetteScore(shape: OutfitShape, profile: UserProfile): number {
  const spread = Math.abs(shape.volumeTop - shape.volumeBottom)
  // Volume contrast is the one rule almost every stylist agrees on.
  let score = 0.45 + 0.4 * Math.min(1, spread / 0.55)
  if (shape.volumeTop > 0.65 && shape.volumeBottom > 0.65) score -= 0.25

  switch (profile.biometrics.bodyShape) {
    case 'pear':
      if (shape.volumeTop >= 0.5 && shape.volumeBottom <= 0.5) score += 0.18
      break
    case 'inverted-triangle':
      if (shape.volumeBottom >= 0.6 && shape.volumeTop <= 0.45) score += 0.18
      break
    case 'rectangle':
      if (shape.waistDefined) score += 0.16
      break
    case 'apple':
      if (!shape.waistDefined && shape.volumeTop >= 0.35 && shape.volumeBottom <= 0.5) score += 0.14
      break
    case 'hourglass':
      if (shape.waistDefined) score += 0.18
      break
    case 'unspecified':
      break
  }
  return clamp01(score)
}

function colorScore(shape: OutfitShape, adventurousness: number, vibe: VibeAxes): number {
  const a = adventurousness / 100
  const pairs: number[] = []
  const relations: string[] = []
  for (let i = 0; i < shape.colors.length; i++) {
    for (let j = i + 1; j < shape.colors.length; j++) {
      const rel = relationBetween(shape.colors[i], shape.colors[j])
      relations.push(rel)
      pairs.push(
        rel === 'clash'
          ? 0.25
          : rel === 'triadic'
            ? 0.6
            : rel === 'monochrome'
              ? 0.82
              : rel === 'analogous'
                ? 0.9
                : rel === 'complementary'
                  ? 0.78
                  : 0.95,
      )
    }
  }
  const harmony = pairs.length ? pairs.reduce((x, y) => x + y, 0) / pairs.length : 0.7
  const hasClash = relations.includes('clash')
  // At the avant-garde end a clash is a decision, and a merely-pleasant palette
  // is the boring option.
  const daringView = hasClash ? 0.92 : harmony > 0.88 ? 0.55 : 0.7
  const relationFit = (1 - a) * harmony + a * daringView

  const contrastFit = 1 - Math.abs(shape.contrast - vibe.contrast)
  const saturationFit = 1 - Math.abs(shape.saturation - vibe.saturation)
  return clamp01(0.5 * relationFit + 0.25 * contrastFit + 0.25 * saturationFit)
}

const VIBE_AXIS_WEIGHTS: Record<keyof VibeAxes, number> = {
  formality: 1.1,
  boldness: 1,
  skin: 1.2,
  structure: 1,
  saturation: 0.7,
  contrast: 0.6,
  texture: 0.8,
  polish: 0.9,
}

function vibeScore(shape: OutfitShape, target: VibeAxes): number {
  let sum = 0
  let weight = 0
  for (const key of Object.keys(VIBE_AXIS_WEIGHTS) as Array<keyof VibeAxes>) {
    const w = VIBE_AXIS_WEIGHTS[key]
    const diff =
      key === 'formality'
        ? Math.abs(shape.formality - target.formality) / 4
        : Math.abs(shape[key] - target[key])
    sum += (1 - clamp01(diff)) * w
    weight += w
  }
  return sum / weight
}

function jaccard(a: string[], b: string[]): number {
  const setB = new Set(b)
  const inter = a.filter((x) => setB.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : inter / union
}

interface ScoredCandidate {
  pieces: OutfitPiece[]
  shape: OutfitShape
  score: number
  breakdown: ScoreBreakdown
  warnings: Guardrail[]
  skeleton: Skeleton
}

function scoreCandidate(
  pieces: OutfitPiece[],
  skeleton: Skeleton,
  input: StylistInput,
  ctx: ContextProfile,
  vibe: ParsedVibe,
): ScoredCandidate {
  const { profile, prefs } = input
  const a = prefs.adventurousness / 100
  const shape = outfitShape(pieces)

  const contextScore = clamp01(
    1 - Math.abs(shape.formality - ctx.targetFormality) / (ctx.tolerance + 1.8),
  )
  const climateScore = clamp01(1 - Math.abs(shape.warmth - CLIMATE_WARMTH[profile.climate]) / 2.6)
  const color = colorScore(shape, prefs.adventurousness, vibe.axes)
  const vibeFit = vibeScore(shape, vibe.axes)
  const silhouette = silhouetteScore(shape, profile)

  // How adventurous the look actually is, versus how adventurous they asked for.
  const actualDaring = clamp01(
    0.45 * skeleton.daring +
      0.25 * Math.min(1, shape.roleSwaps / 1.5) +
      0.2 * shape.texture +
      0.1 * shape.boldness,
  )
  const daring = 1 - Math.abs(actualDaring - a)

  const weights = {
    context: 0.26 * (1 - 0.35 * a) * (prefs.context === 'shuffle' ? 0.5 : 1),
    climate: 0.14,
    color: 0.18,
    vibe: 0.24,
    silhouette: 0.1 * (1 - 0.75 * a),
    daring: 0.08 * (1 + 2.2 * a) * (prefs.context === 'shuffle' ? 1.5 : 1),
  }
  const totalWeight = Object.values(weights).reduce((x, y) => x + y, 0)

  let score =
    (contextScore * weights.context +
      climateScore * weights.climate +
      color * weights.color +
      vibeFit * weights.vibe +
      silhouette * weights.silhouette +
      daring * weights.daring) /
    totalWeight

  const warnings = prefs.guardrails
    ? checkOutfit(
        pieces.map((p) => p.garment),
        profile,
        ctx,
      )
    : []
  const strongCount = warnings.filter((w) => w.severity === 'strong').length
  score -= Math.min(0.36, strongCount * 0.18) + warnings.filter((w) => w.severity === 'nudge').length * 0.025

  // Novelty: a closet you have already seen styled this way is not inspiration.
  const ids = pieces.map((p) => p.garment.id)
  const repeat = Math.max(
    0,
    ...(input.history ?? []).map((o) => jaccard(ids, o.itemIds)),
  )
  score -= repeat * (prefs.context === 'shuffle' ? 0.3 : 0.12)

  // A pinned piece the user asked for is worth honouring.
  const pinned = input.pinnedIds ?? []
  if (pinned.length) {
    const used = pinned.filter((id) => ids.includes(id)).length
    score += 0.25 * (used / pinned.length) - 0.25
  }

  return {
    pieces,
    shape,
    score: clamp01(score),
    breakdown: {
      context: contextScore,
      climate: climateScore,
      color,
      vibe: vibeFit,
      silhouette,
      daring,
    },
    warnings,
    skeleton,
  }
}

/* ------------------------------------------------------------------ *
 * Candidate enumeration
 * ------------------------------------------------------------------ */

const POOL_PER_SLOT = 7
const MAX_CANDIDATES = 2500

/** Cheap per-garment relevance so slot pools stay small. */
function garmentRelevance(g: Garment, ctx: ContextProfile, profile: UserProfile, vibe: VibeAxes): number {
  const formality = 1 - Math.abs(g.formality - ctx.targetFormality) / 4
  const warmth = 1 - Math.abs(g.warmth - CLIMATE_WARMTH[profile.climate]) / 4
  const skin = 1 - Math.abs(COVERAGE_SKIN[g.coverage] - vibe.skin)
  const structure = 1 - Math.abs(fabricInfo(g.fabric).structure - vibe.structure)
  return 0.4 * formality + 0.2 * warmth + 0.2 * skin + 0.2 * structure
}

function enumerate(
  skeleton: Skeleton,
  pools: Garment[][],
  onCandidate: (pieces: OutfitPiece[]) => void,
  budget: { left: number },
) {
  const acc: OutfitPiece[] = []
  const walk = (slotIndex: number, startAt: number) => {
    if (budget.left <= 0) return
    if (slotIndex === skeleton.slots.length) {
      budget.left--
      onCandidate([...acc])
      return
    }
    const slot = skeleton.slots[slotIndex]
    const pool = pools[slotIndex]
    // Repeated roles (double-top) iterate forward only, so we don't emit the
    // same pair twice in a different order.
    const sameRoleAsPrevious =
      slotIndex > 0 && skeleton.slots[slotIndex - 1].role === slot.role && !slot.requireSwap
    for (let i = sameRoleAsPrevious ? startAt : 0; i < pool.length; i++) {
      const g = pool[i]
      if (acc.some((p) => p.garment.id === g.id)) continue
      acc.push({ garment: g, role: slot.role })
      walk(slotIndex + 1, i + 1)
      acc.pop()
      if (budget.left <= 0) return
    }
  }
  walk(0, 0)
}

/* ------------------------------------------------------------------ *
 * Copy generation
 * ------------------------------------------------------------------ */

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function pick<T>(options: T[], seed: number): T {
  return options[seed % options.length]
}

const SWAP_HOWTO: Record<string, string> = {
  'bottom->top': 'step into it, pull it up to just under the arms and belt the waistband so it stays put',
  'dress->top': 'tuck the whole dress into the waistband so only the bodice reads as a top',
  'outerwear->top': 'wear it closed with nothing underneath and let the lapel be the neckline',
  'top->outerwear': 'leave it unbuttoned over the top as a shirt-jacket, sleeves pushed up',
  'bottom->dress': 'pull it up to the chest and let it fall as a column',
  'dress->outerwear': 'wear it open over the look like a duster',
}

function moveLines(pieces: OutfitPiece[], shape: OutfitShape, profile: UserProfile, seed: number): string[] {
  const moves: string[] = []
  for (const p of pieces) {
    if (p.garment.category === p.role) continue
    const how = SWAP_HOWTO[`${p.garment.category}->${p.role}`]
    moves.push(
      `Wear the ${p.garment.label.toLowerCase()} as a ${p.role}${how ? ` — ${how}` : ''}.`,
    )
  }

  const top = pieces.find((p) => p.role === 'top')
  const bottom = pieces.find((p) => p.role === 'bottom')
  const outer = pieces.find((p) => p.role === 'outerwear')
  const shoes = pieces.find((p) => p.role === 'shoes')

  if (top && bottom && top.garment.tags.includes('tuckable') && bottom.garment.formality >= 3) {
    moves.push(
      pick(
        [
          'Half-tuck the front hem only — it shortens the torso without looking fussy.',
          'Full tuck with the waistband showing; it is the difference between dressed and just wearing clothes.',
        ],
        seed,
      ),
    )
  }
  if (shape.volumeTop > 0.65 && shape.volumeBottom > 0.65) {
    moves.push('Cuff the sleeve once and the hem twice so the volume reads chosen, not borrowed.')
  }
  if (outer) {
    moves.push(
      shape.warmth > 3.8
        ? 'Close the coat and belt it so the silhouette stays deliberate.'
        : 'Wear the outer layer open — the vertical gap is what makes it look long.',
    )
  }
  if (shoes && bottom && bottom.garment.fit === 'relaxed') {
    moves.push(`Let the hem break on the ${shoes.garment.label.toLowerCase()}, not above them.`)
  }
  if (!shape.waistDefined && (profile.biometrics.bodyShape === 'rectangle' || profile.biometrics.bodyShape === 'hourglass')) {
    moves.push('Add a belt at the natural waist — it is the one line this look is missing.')
  }
  return moves.slice(0, 3)
}

function rationaleLines(
  c: ScoredCandidate,
  ctx: ContextProfile,
  vibe: ParsedVibe,
  profile: UserProfile,
  prefs: StylingPreferences,
  seed: number,
): string[] {
  const lines: Array<{ weight: number; text: string }> = []
  const { shape, breakdown } = c
  const colors = shape.colors.filter((c2, i, arr) => arr.indexOf(c2) === i)
  const [c1, c2] = colors
  const a = prefs.adventurousness / 100

  if (c1 && c2) {
    const rel = relationBetween(c1, c2)
    const n1 = colorName(c1)
    const n2 = colorName(c2)
    const text =
      rel === 'neutral-anchored'
        ? `The ${n1} sits on a ${n2} base, so nothing competes and the accent can be the only loud thing.`
        : rel === 'monochrome'
          ? `It is a tonal ${n1} column — one colour, three fabrics, which is why it reads expensive rather than lazy.`
          : rel === 'analogous'
            ? `${cap(n1)} and ${n2} are neighbours on the wheel: composed without being matchy.`
            : rel === 'complementary'
              ? `${cap(n1)} against ${n2} are opposites — that tension is doing most of the work here.`
              : rel === 'triadic'
                ? `${cap(n1)} and ${n2} are a wide interval, which keeps it lively without tipping into costume.`
                : a > 0.55
                  ? `${cap(n1)} next to ${n2} technically should not work. At your setting that is the entire point.`
                  : `${cap(n1)} and ${n2} are an unusual pairing — worth a look in the mirror before you commit.`
    lines.push({ weight: breakdown.color, text })
  }

  const cueText = ctx.cues.length ? ` (${ctx.cues.join(', ')})` : ''
  lines.push({
    weight: breakdown.context,
    text: `Lands at ${shape.formality.toFixed(1)}/5 formality, which is what ${ctx.label}${cueText} is asking for.`,
  })

  if (vibe.matched.length) {
    const skinWord = shape.skin > 0.6 ? 'skin on show' : shape.skin < 0.3 ? 'full coverage' : 'a bit of skin'
    const structureWord = shape.structure > 0.6 ? 'hard lines' : shape.structure < 0.35 ? 'soft drape' : 'a mix of soft and sharp'
    const delivered = `${structureWord} with ${skinWord}`
    lines.push({
      weight: breakdown.vibe,
      // Says so plainly when the closet cannot reach the brief, rather than
      // claiming a match it did not achieve.
      text:
        breakdown.vibe > 0.68
          ? `You asked for ${vibe.matched.join(' + ')}; you get ${delivered}.`
          : `You asked for ${vibe.matched.join(' + ')}. This is the closest your closet gets: ${delivered}.`,
    })
  }

  if (a < 0.5 && profile.biometrics.bodyShape !== 'unspecified') {
    const spread = Math.abs(shape.volumeTop - shape.volumeBottom)
    lines.push({
      weight: breakdown.silhouette,
      text:
        spread > 0.3
          ? `Volume on ${shape.volumeTop > shape.volumeBottom ? 'top' : 'the bottom'} with a cleaner line on the other half — the proportion trick that suits a ${profile.biometrics.bodyShape} frame.`
          : `Straight up-and-down proportions, which keeps a ${profile.biometrics.bodyShape} frame uncomplicated.`,
    })
  }

  if (shape.roleSwaps > 0) {
    lines.push({
      weight: breakdown.daring,
      text: pick(
        [
          'The role swap is the whole idea: one piece doing a job it was not sold for.',
          'Nobody else will read that piece the way you are wearing it, which is the point.',
        ],
        seed,
      ),
    })
  }

  if (breakdown.climate > 0.8) {
    lines.push({
      weight: breakdown.climate * 0.7,
      text: `Weight is right for ${profile.location || profile.climate} — you will not be carrying half of it.`,
    })
  }

  return lines
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 3)
    .map((l) => l.text)
}

function accessoryIdeas(
  shape: OutfitShape,
  palette: ReturnType<typeof buildPalette>,
  profile: UserProfile,
  prefs: StylingPreferences,
  ctx: ContextProfile,
): AccessoryIdea[] {
  const accent = palette.find((p) => p.role === 'accent') ?? palette[0]
  const metal = profile.biometrics.undertone === 'cool' ? 'silver' : profile.biometrics.undertone === 'warm' ? 'gold' : 'mixed-metal'
  const ideas: AccessoryIdea[] = []

  if (shape.saturation < 0.3) {
    ideas.push({
      label: `One ${accent.name} piece — bag, scarf or shoe`,
      color: accent.hex,
      why: 'The look is quiet, so a single saturated object reads as a decision rather than an accident.',
    })
  } else {
    ideas.push({
      label: `Keep metals to ${metal} only`,
      color: metal === 'silver' ? '#c9ced6' : '#c9a227',
      why: `There is already colour in the clothes; ${metal} suits your ${profile.biometrics.undertone === 'unspecified' ? 'skin' : `${profile.biometrics.undertone} undertone`} and stops it turning into a pile-on.`,
    })
  }

  if (!shape.waistDefined) {
    ideas.push({
      label: 'A belt worn at the natural waist',
      color: palette[0].hex,
      why: 'Adds the horizontal line the silhouette is missing and makes the tuck look intentional.',
    })
  }

  if (prefs.adventurousness > 60) {
    ideas.push({
      label: `${cap(accent.name)} socks pulled over the hem`,
      color: accent.hex,
      why: 'Cheapest way to break a clean outfit on purpose — and it is reversible mid-day.',
    })
  } else if (ctx.targetFormality >= 4) {
    ideas.push({
      label: 'A small structured bag, nothing slouchy',
      color: palette[0].hex,
      why: 'At this formality the bag is the piece people read first; structure keeps the whole look upright.',
    })
  } else {
    ideas.push({
      label: 'Sunglasses with a defined frame',
      color: '#2b2b2f',
      why: 'Finishes the look without adding another colour to manage.',
    })
  }

  if (shape.warmth < CLIMATE_WARMTH[profile.climate] - 0.8) {
    ideas.push({
      label: 'A scarf you can actually take off',
      color: palette[1]?.hex ?? palette[0].hex,
      why: `${cap(profile.climate)} weather: a scarf adds the warmth without changing the silhouette you just built.`,
    })
  }

  return ideas.slice(0, 3)
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

export const localStylist: StylistEngine = {
  name: 'local-rules-v1',
  generate(input: StylistInput): Outfit[] {
    const { garments, profile, prefs } = input
    const limit = input.limit ?? 4
    const ctx = contextProfile(prefs)
    const vibe = parseVibe(prefs.vibe)
    const wearable = garments.filter((g) => g.origin !== 'predicted' || g.confirmed)
    const pinned = new Set(input.pinnedIds ?? [])

    const scored: ScoredCandidate[] = []
    const budget = { left: MAX_CANDIDATES }

    for (const skeleton of SKELETONS) {
      // Skip structurally daring skeletons for users who asked for safe.
      if (skeleton.daring > 0.35 && prefs.adventurousness < 30) continue
      const pools = skeleton.slots.map((slot) => {
        const eligible = wearable.filter((g) => canPlay(g, slot))
        return eligible
          .sort((a, b) => {
            const pinBias = (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0)
            if (pinBias !== 0) return pinBias
            return (
              garmentRelevance(b, ctx, profile, vibe.axes) - garmentRelevance(a, ctx, profile, vibe.axes)
            )
          })
          .slice(0, POOL_PER_SLOT)
      })
      if (pools.some((p) => p.length === 0)) continue
      enumerate(
        skeleton,
        pools,
        (pieces) => scored.push(scoreCandidate(pieces, skeleton, input, ctx, vibe)),
        budget,
      )
      if (budget.left <= 0) break
    }

    scored.sort((a, b) => b.score - a.score)

    // Diversify: no two suggestions may share more than half their pieces.
    const chosen: ScoredCandidate[] = []
    for (const candidate of scored) {
      const ids = candidate.pieces.map((p) => p.garment.id)
      if (chosen.some((c) => jaccard(ids, c.pieces.map((p) => p.garment.id)) > 0.5)) continue
      chosen.push(candidate)
      if (chosen.length >= limit) break
    }

    const now = Date.now()
    return chosen.map((c, index) => {
      const id = `fit_${now.toString(36)}_${index}`
      const seed = hash(id + c.pieces.map((p) => p.garment.id).join('|'))
      const palette = buildPalette(c.shape.colors, prefs.adventurousness)
      const moves = moveLines(c.pieces, c.shape, profile, seed)
      // Don't say the same thing twice: a styling move about the waist makes
      // the belt accessory idea redundant.
      const accessories = accessoryIdeas(c.shape, palette, profile, prefs, ctx).filter(
        (a) => !(a.label.toLowerCase().includes('belt') && moves.some((m) => m.toLowerCase().includes('belt'))),
      )
      return {
        id,
        itemIds: c.pieces.map((p) => p.garment.id),
        roles: Object.fromEntries(c.pieces.map((p) => [p.garment.id, p.role])),
        accessories,
        palette,
        score: Math.round(c.score * 100) / 100,
        breakdown: c.breakdown,
        rationale: rationaleLines(c, ctx, vibe, profile, prefs, seed),
        moves,
        vibeMatch: vibe.matched,
        warnings: c.warnings,
        context: prefs.context,
        origin: 'generated',
        saved: false,
        createdAt: now + index,
      } satisfies Outfit
    })
  },
}

/** Exported for the UI: what the app understood from the vibe box. */
export function explainVibe(text: string): ParsedVibe {
  return text.trim() ? parseVibe(text) : { axes: { ...NEUTRAL_VIBE }, matched: [], unmapped: [] }
}
