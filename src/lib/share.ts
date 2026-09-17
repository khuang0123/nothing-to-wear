/**
 * One-tap sharing.
 *
 * On a phone, `navigator.share` with a file attached is what actually surfaces
 * Instagram and Snapchat in the OS share sheet — neither platform allows a web
 * page to post on the user's behalf, so the share sheet is the real one-click
 * path rather than a fake in-app "Post to Instagram" button. Desktop and
 * unsupported browsers fall back to download + copied caption.
 */

import type { Garment, Outfit } from '../types'

export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return null
  const [, mime, b64] = match
  const bytes = atob(b64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new File([buf], filename, { type: mime })
}

export function captionFor(outfit: Outfit, garments: Garment[]): string {
  const names = outfit.itemIds
    .map((id) => garments.find((g) => g.id === id)?.label)
    .filter(Boolean)
    .join(' · ')
  const vibe = outfit.vibeMatch.length ? ` — ${outfit.vibeMatch[0]}` : ''
  return `${names}${vibe}\nStyled from clothes I already own. #nothingtowear #wornagain`
}

export type ShareResult = 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'unsupported'

export async function shareOutfit(
  outfit: Outfit,
  garments: Garment[],
  imageDataUrl?: string,
): Promise<ShareResult> {
  const text = captionFor(outfit, garments)
  const file = imageDataUrl ? dataUrlToFile(imageDataUrl, `ootd-${outfit.id}.jpg`) : null

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const canFiles =
        file && navigator.canShare ? navigator.canShare({ files: [file] }) : false
      await navigator.share(canFiles && file ? { text, files: [file] } : { text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  if (imageDataUrl) {
    const a = document.createElement('a')
    a.href = imageDataUrl
    a.download = `ootd-${outfit.id}.jpg`
    a.click()
    await copy(text)
    return 'downloaded'
  }
  return (await copy(text)) ? 'copied' : 'unsupported'
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Normalise a phone number for friend matching. Keeps digits and a leading +. */
export function normalisePhone(input: string): string {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function isValidPhone(input: string): boolean {
  const digits = normalisePhone(input).replace('+', '')
  return digits.length >= 7 && digits.length <= 15
}
