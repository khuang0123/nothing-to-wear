/**
 * Guardrails: the app never blocks a choice, it nudges and offers a concrete
 * swap. The user always gets the final say (see `guardrails` in preferences,
 * which turns the whole system off).
 */

import type { Coverage, Garment, Guardrail, UserProfile } from '../types'
import { CLIMATE_WARMTH, coverageAtLeast, type ContextProfile } from './context'
import { hexToHsl, isNeutral } from './color'

/** Coverage floor the user's own modesty setting implies. */
function modestyFloor(modesty: UserProfile['modesty']): { floor: Coverage; severity: Guardrail['severity'] } | null {
  switch (modesty) {
    case 0:
      return null
    case 1:
      return { floor: 'moderate', severity: 'nudge' }
    case 2:
      return { floor: 'moderate', severity: 'strong' }
    case 3:
      return { floor: 'full', severity: 'strong' }
  }
}

const COVER_UPS: Partial<Record<Garment['category'], string>> = {
  top: 'a long-sleeve layer or a slip underneath',
  bottom: 'a longer-length alternative or opaque tights',
  dress: 'a knit or blazer over the top',
}

/**
 * Check a single piece against the brief. Used both when the user taps a
 * garment to force it into a look and when scoring generated outfits.
 */
export function checkGarment(
  garment: Garment,
  profile: UserProfile,
  ctx: ContextProfile,
): Guardrail[] {
  const out: Guardrail[] = []

  const occasionFloor = ctx.minCoverage
  const personal = modestyFloor(profile.modesty)
  const floors: Array<{ floor: Coverage; severity: Guardrail['severity']; why: string }> = []
  if (occasionFloor) {
    floors.push({ floor: occasionFloor, severity: 'strong', why: ctx.cues.join(', ') || ctx.label })
  }
  if (personal) {
    floors.push({ floor: personal.floor, severity: personal.severity, why: 'your coverage preference' })
  }

  for (const f of floors) {
    if (!coverageAtLeast(garment.coverage, f.floor)) {
      out.push({
        kind: occasionFloor && f.why !== 'your coverage preference' ? 'context' : 'modesty',
        garmentId: garment.id,
        message: `More open than ${f.why} usually allows: ${garment.label}.`,
        suggestion: `Keep it and layer with ${COVER_UPS[garment.category] ?? 'something over the top'}, or swap for a more covered piece.`,
        severity: f.severity,
      })
      break
    }
  }

  const formalityGap = garment.formality - ctx.targetFormality
  if (Math.abs(formalityGap) > 1.6) {
    out.push({
      kind: 'context',
      garmentId: garment.id,
      message:
        formalityGap > 0
          ? `Dressier than ${ctx.label} calls for: ${garment.label}.`
          : `More casual than ${ctx.label} calls for: ${garment.label}.`,
      suggestion:
        formalityGap > 0
          ? 'Break it down with a flatter shoe or a casual knit so it looks deliberate.'
          : 'Dress it up with a structured layer, or pick something sharper.',
      severity: 'nudge',
    })
  }

  const climateTarget = CLIMATE_WARMTH[profile.climate]
  const place = profile.location || profile.climate
  // Phrased without a verb that has to agree in number, because labels are a
  // mix of singular and plural ("a blazer", "jeans", "loafers").
  if (garment.warmth - climateTarget > 2) {
    out.push({
      kind: 'weather',
      garmentId: garment.id,
      message: `Too heavy for ${place} right now: ${garment.label}.`,
      suggestion:
        garment.category === 'outerwear'
          ? 'Go a weight lighter, or plan to carry it rather than wear it.'
          : 'Swap for a lighter weight in the same colour and the look survives.',
      severity: 'nudge',
    })
  } else if (climateTarget - garment.warmth > 2.2) {
    out.push({
      kind: 'weather',
      garmentId: garment.id,
      message: `Too thin for ${place}: ${garment.label}.`,
      suggestion:
        garment.category === 'shoes'
          ? 'Pick a closed, heavier shoe — cold feet end an outfit faster than anything else.'
          : garment.category === 'accessory' || garment.category === 'bag'
            ? 'Fine indoors; just do not rely on it for warmth.'
            : 'Layer something with weight over it so the look still works outdoors.',
      severity: 'nudge',
    })
  }

  if (ctx.maxSaturation !== null) {
    const loud = garment.colors.find(
      (c) => !isNeutral(c) && hexToHsl(c).s / 100 > (ctx.maxSaturation as number) + 0.35,
    )
    if (loud) {
      out.push({
        kind: 'context',
        garmentId: garment.id,
        message: `Bright for an occasion that wants ${ctx.cues.join(', ')}: ${garment.label}.`,
        suggestion: 'Keep the shape, take the colour down — or save this piece for another day.',
        severity: 'strong',
      })
    }
  }

  return out
}

/** Whole-outfit checks that only make sense once pieces are combined. */
export function checkOutfit(
  garments: Garment[],
  profile: UserProfile,
  ctx: ContextProfile,
): Guardrail[] {
  const out: Guardrail[] = []
  const seen = new Set<string>()
  for (const g of garments) {
    for (const warning of checkGarment(g, profile, ctx)) {
      const key = `${warning.kind}:${warning.message}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(warning)
    }
  }

  const core = garments.filter((g) => g.category !== 'accessory' && g.category !== 'bag')
  if (core.length > 0) {
    const avgWarmth = core.reduce((s, g) => s + g.warmth, 0) / core.length
    const target = CLIMATE_WARMTH[profile.climate]
    if (target - avgWarmth > 1.5) {
      out.push({
        kind: 'comfort',
        message: `As a whole this look is under-dressed for ${profile.climate} weather.`,
        suggestion: 'Add outerwear, or swap the lightest piece for something with weight.',
        severity: 'nudge',
      })
    } else if (avgWarmth - target > 1.5) {
      out.push({
        kind: 'comfort',
        message: `This will run hot for ${profile.climate} weather.`,
        suggestion: 'Drop a layer, or pick the lighter of the two tops.',
        severity: 'nudge',
      })
    }

    const minimalCount = core.filter((g) => g.coverage === 'minimal').length
    if (profile.modesty === 1 && minimalCount > 1) {
      out.push({
        kind: 'modesty',
        message: 'Two revealing pieces at once is further than you usually go.',
        suggestion: 'Pick one to be the statement and cover the other.',
        severity: 'nudge',
      })
    }
  }

  return out
}

export function strongest(warnings: Guardrail[]): Guardrail | null {
  return warnings.find((w) => w.severity === 'strong') ?? warnings[0] ?? null
}
