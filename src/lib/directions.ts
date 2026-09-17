/**
 * "Potential styles" shown at the activation stage, before the user has
 * photographed anything. These are directions, not outfits: a palette, a
 * silhouette and what to go looking for in your own closet. They are derived
 * from the same axes the stylist uses, so what you see here is what you get.
 */

import type { StylingPreferences, UserProfile } from '../types'
import { contextProfile } from './context'
import { hslToHex } from './color'
import { parseVibe, type VibeAxes } from './lexicon'

export interface StyleDirection {
  title: string
  palette: string[]
  silhouette: string
  hunt: string
}

function palette(axes: VibeAxes, hueSeed: number, shift: number): string[] {
  const sat = Math.round(18 + axes.saturation * 62)
  const light = axes.contrast > 0.6 ? 20 : 42
  return [
    hslToHex({ h: hueSeed, s: sat, l: light }),
    hslToHex({ h: (hueSeed + shift) % 360, s: Math.max(8, sat - 26), l: 78 - axes.contrast * 18 }),
    hslToHex({ h: (hueSeed + 180) % 360, s: Math.min(92, sat + 20), l: 48 }),
  ]
}

export function styleDirections(prefs: StylingPreferences, profile: UserProfile | null): StyleDirection[] {
  const { axes } = parseVibe(prefs.vibe)
  const ctx = contextProfile(prefs)
  const daring = prefs.adventurousness / 100
  const covered = (profile?.modesty ?? 0) >= 2 || axes.skin < 0.3

  const structured: StyleDirection = {
    title: axes.structure > 0.55 ? 'Hard shoulder, soft everything else' : 'One sharp piece, rest relaxed',
    palette: palette(axes, 215, 30),
    silhouette:
      axes.structure > 0.55
        ? 'Tailored top half, fluid bottom. Volume goes below the waist.'
        : 'Relaxed top, clean narrow leg. The shoe finishes the line.',
    hunt: 'Look for your most structured jacket or shirt and the softest bottom you own.',
  }

  const tonal: StyleDirection = {
    title: ctx.targetFormality >= 4 ? 'Tonal column, one metal' : 'Three shades of one colour',
    palette: palette(axes, 28, 14),
    silhouette: 'Same colour family top to toe, broken only by texture and the shoe.',
    hunt: 'Pull every piece in your closet in one colour, even if the fabrics clash.',
  }

  const daringDirection: StyleDirection = {
    title: daring > 0.6 ? 'Wrong-role dressing' : 'One unexpected object',
    palette: palette(axes, 348, 42),
    silhouette:
      daring > 0.6
        ? 'A piece worn in a role it was not made for — skirt as top, dress over trousers.'
        : 'A conventional base plus exactly one thing nobody expects.',
    hunt: daring > 0.6 ? 'Find a skirt or slip dress that could work as a top.' : 'Find your loudest accessory.',
  }

  const modestDirection: StyleDirection = {
    title: 'Covered, not hidden',
    palette: palette(axes, 168, 22),
    silhouette: 'Long over long, with the waist marked so full coverage still has a shape.',
    hunt: 'Look for a long layer you can belt, and a high neckline in a good fabric.',
  }

  const list = [structured, tonal, daringDirection]
  if (covered) list.splice(1, 0, modestDirection)
  return list.slice(0, 3)
}
