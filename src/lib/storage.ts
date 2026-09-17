/**
 * Local persistence. The MVP is deliberately device-local: demographics,
 * biometrics and closet photos never leave the phone, which is the right
 * default for the data this app asks for.
 */

import type { AppData, StylingPreferences } from '../types'

const KEY = 'ntw.data.v1'
const DATA_VERSION = 1

export const DEFAULT_PREFERENCES: StylingPreferences = {
  context: 'casual',
  contextNote: '',
  adventurousness: 45,
  vibe: '',
  guardrails: true,
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    profile: null,
    garments: [],
    outfits: [],
    friends: [],
    preferences: { ...DEFAULT_PREFERENCES },
    dismissedPredictions: [],
    hasCompletedFirstSession: false,
  }
}

export function loadData(): AppData {
  if (typeof localStorage === 'undefined') return emptyData()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    if (parsed.version !== DATA_VERSION) return emptyData()
    return { ...emptyData(), ...parsed, preferences: { ...DEFAULT_PREFERENCES, ...parsed.preferences } }
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Photo-heavy closets can exceed the quota. Drop the images rather than the
    // structure so the closet still functions.
    try {
      const lite: AppData = {
        ...data,
        garments: data.garments.map((g) => ({ ...g, imageDataUrl: undefined })),
        outfits: data.outfits.map((o) => ({ ...o, photoDataUrl: undefined })),
      }
      localStorage.setItem(KEY, JSON.stringify(lite))
    } catch {
      // Give up silently: the session still works in memory.
    }
  }
}

export function clearData(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}
