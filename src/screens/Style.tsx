import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import type { Garment, Outfit } from '../types'
import { localStylist } from '../lib/stylist'
import { contextProfile } from '../lib/context'
import { checkGarment } from '../lib/guardrails'
import { fileToDataUrl } from '../lib/imageColors'
import { shareOutfit } from '../lib/share'
import { newId } from '../lib/storage'
import { OutfitCard } from '../components/OutfitCard'
import { NudgeList, TopBar } from '../components/ui'
import { useToast } from '../components/useToast'

/**
 * The mix-and-match result screen. Everything here is recomputed from the
 * closet, so turning the personality dial and coming back gives genuinely
 * different structures, not a reshuffled list.
 */
export function Style() {
  const { data, saveOutfit, setPreferences, markFirstSessionDone } = useApp()
  const navigate = useNavigate()
  const { toast, node: toastNode } = useToast()

  const [pinned, setPinned] = useState<string[]>([])
  const [nonce, setNonce] = useState(0)
  const [showAllPieces, setShowAllPieces] = useState(false)
  const [confirming, setConfirming] = useState<Outfit | null>(null)
  const [detail, setDetail] = useState<string | null>(null)

  const wearable = useMemo(
    () => data.garments.filter((g) => g.origin !== 'predicted' || g.confirmed),
    [data.garments],
  )

  const ctx = useMemo(() => contextProfile(data.preferences), [data.preferences])

  // Derived during render: turning the dial or pinning a piece re-styles
  // immediately, and `nonce` is what the Shuffle button bumps.
  const outfits = useMemo(() => {
    if (!data.profile) return []
    void nonce
    return localStylist.generate({
      garments: data.garments,
      profile: data.profile,
      prefs: data.preferences,
      history: data.outfits,
      pinnedIds: pinned,
      limit: 4,
    })
  }, [data.garments, data.profile, data.preferences, data.outfits, pinned, nonce])

  const pinnedWarnings = useMemo(() => {
    if (!data.profile || !data.preferences.guardrails) return []
    return pinned
      .map((id) => wearable.find((g) => g.id === id))
      .filter((g): g is Garment => Boolean(g))
      .flatMap((g) => checkGarment(g, data.profile!, ctx))
  }, [pinned, wearable, data.profile, data.preferences.guardrails, ctx])

  async function onOotd(files: FileList | null) {
    if (!files?.length || !data.profile) return
    const dataUrl = await fileToDataUrl(files[0])
    const ootd: Outfit = {
      id: newId('ootd'),
      itemIds: pinned,
      roles: {},
      accessories: [],
      palette: [],
      score: 1,
      breakdown: { context: 1, climate: 1, color: 1, vibe: 1, silhouette: 1, daring: 1 },
      rationale: ['Your own outfit of the day.'],
      moves: [],
      vibeMatch: [],
      warnings: [],
      context: data.preferences.context,
      origin: 'ootd',
      photoDataUrl: dataUrl,
      saved: false,
      createdAt: Date.now(),
    }
    setConfirming(ootd)
  }

  if (!data.profile) return null

  if (wearable.length < 3) {
    return (
      <>
        <TopBar back="/home" title="Mix and match" />
        <div className="screen">
          <div className="empty">
            <span className="big">👚</span>
            <h2>We need a few more pieces</h2>
            <p className="muted">
              Three items is the floor for an outfit. Show us {3 - wearable.length} more and we can
              start.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/capture')}>
              Add clothes
            </button>
          </div>
        </div>
      </>
    )
  }

  if (confirming) {
    return (
      <>
        <TopBar title="Keep this one?" />
        <div className="screen stack">
          <OutfitCard outfit={confirming} garments={data.garments} />
          <div className="card stack-sm">
            <h3>Store this in your virtual closet?</h3>
            <p className="tiny">
              We remember the fit and every piece in it, so next time we can build on it instead of
              starting over.
            </p>
            <div className="row">
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  saveOutfit(confirming)
                  setConfirming(null)
                  navigate('/closet')
                }}
              >
                Yes, save it
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  markFirstSessionDone()
                  setConfirming(null)
                  toast('Not saved — wear it well')
                }}
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
        {toastNode}
      </>
    )
  }

  return (
    <>
      <TopBar
        back="/home"
        title="Mix and match"
        right={
          <button className="btn btn-sm" onClick={() => setNonce((n) => n + 1)}>
            Shuffle
          </button>
        }
      />
      <div className="screen stack">
        <div className="card stack-sm">
          <span className="eyebrow">Today's brief</span>
          <p style={{ fontSize: 14 }}>
            {ctx.label}
            {ctx.cues.length ? ` — ${ctx.cues.join(', ')}` : ''} ·{' '}
            {data.preferences.adventurousness > 66
              ? 'rule-breaking'
              : data.preferences.adventurousness > 33
                ? 'open to strange'
                : 'flattering and safe'}
            {data.preferences.vibe.trim() ? ` · "${data.preferences.vibe.trim()}"` : ''}
          </p>
          <div className="row">
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/home')}>
              Change the brief
            </button>
            <label className="switch" style={{ marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={data.preferences.guardrails}
                onChange={(e) => setPreferences({ guardrails: e.target.checked })}
              />
              <span className="tiny">nudges</span>
            </label>
          </div>
        </div>

        <div className="stack-sm">
          <div className="row-between">
            <span className="eyebrow">Insist on a piece (optional)</span>
            {wearable.length > 9 ? (
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAllPieces((v) => !v)}>
                {showAllPieces ? 'Show fewer' : `All ${wearable.length}`}
              </button>
            ) : null}
          </div>
          <div className="grid-3">
            {(showAllPieces ? wearable : wearable.slice(0, 9)).map((g) => (
              <div key={g.id} style={{ position: 'relative' }}>
                <button
                  className="thumb"
                  style={{
                    outline: pinned.includes(g.id) ? '2px solid var(--accent)' : undefined,
                    outlineOffset: 1,
                  }}
                  onClick={() =>
                    setPinned((prev) =>
                      prev.includes(g.id) ? prev.filter((p) => p !== g.id) : [...prev, g.id],
                    )
                  }
                >
                  {g.imageDataUrl ? (
                    <img src={g.imageDataUrl} alt={g.label} />
                  ) : (
                    <span
                      style={{
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(140deg, ${g.colors[0]}, ${g.colors[1] ?? g.colors[0]})`,
                      }}
                    />
                  )}
                  <span className="caption">{g.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {pinnedWarnings.length ? (
          <NudgeList
            warnings={pinnedWarnings}
            onAdjust={() => setPinned([])}
            onOverride={() => toast('Noted — styling around it')}
          />
        ) : null}

        {outfits.length === 0 ? (
          <div className="empty">
            <span className="big">🤔</span>
            <h2>Nothing clears the bar for this brief</h2>
            <p className="muted">
              Either loosen the occasion, turn the personality dial up so role swaps are allowed, or
              unpin a piece.
            </p>
          </div>
        ) : (
          outfits.map((o) => (
            <div className="stack-sm" key={o.id}>
              <OutfitCard
                outfit={o}
                garments={data.garments}
                showScores={detail === o.id}
                onSave={() => setConfirming(o)}
                onShare={async () => {
                  const result = await shareOutfit(o, data.garments, o.photoDataUrl)
                  if (result === 'copied' || result === 'downloaded') toast('Caption copied')
                }}
              />
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setDetail(detail === o.id ? null : o.id)}
              >
                {detail === o.id ? 'Hide the scoring' : 'Why did this win?'}
              </button>
            </div>
          ))
        )}

        <div className="sticky-action stack-sm">
          <label className="btn btn-block">
            I wore something else — snap my OOTD
            <input type="file" accept="image/*" hidden onChange={(e) => void onOotd(e.target.files)} />
          </label>
        </div>
      </div>
      {toastNode}
    </>
  )
}
