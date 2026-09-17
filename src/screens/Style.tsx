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
import { LookTile, OutfitCard } from '../components/OutfitCard'
import { GarmentThumb, NudgeList, TopBar } from '../components/ui'
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState<Outfit | null>(null)
  const [opened, setOpened] = useState<Outfit | null>(null)

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
      headline: 'Your outfit of the day',
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

  if (opened) {
    return (
      <>
        <TopBar title="The look" onBack={() => setOpened(null)} />
        <div className="screen stack">
          <OutfitCard
            outfit={opened}
            garments={data.garments}
            onSave={() => {
              setConfirming(opened)
              setOpened(null)
            }}
            onShare={async () => {
              const result = await shareOutfit(opened, data.garments, opened.photoDataUrl)
              if (result === 'copied' || result === 'downloaded') toast('Caption copied')
            }}
          />
        </div>
        {toastNode}
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
        {/* The brief, as chips. One line, no paragraph. */}
        <div className="brief-row">
          <span className="brief-chip">{ctx.label}</span>
          {ctx.cues.map((c) => (
            <span className="brief-chip" key={c}>
              {c}
            </span>
          ))}
          <span className="brief-chip">
            {data.preferences.adventurousness > 66
              ? 'rule-breaking'
              : data.preferences.adventurousness > 33
                ? 'open to strange'
                : 'safe'}
          </span>
          {data.preferences.vibe.trim() ? (
            <span className="brief-chip accent">{data.preferences.vibe.trim()}</span>
          ) : null}
          <button
            className={`brief-chip toggle${data.preferences.guardrails ? ' on' : ''}`}
            onClick={() => setPreferences({ guardrails: !data.preferences.guardrails })}
            aria-pressed={data.preferences.guardrails}
          >
            nudges
          </button>
          <button className="brief-chip edit" onClick={() => navigate('/home')}>
            edit
          </button>
        </div>

        {/* Optional and collapsed, so the looks stay the hero of the screen. */}
        <div className="stack-sm">
          <button className="brief-chip edit" onClick={() => setPickerOpen((v) => !v)}>
            {pinned.length
              ? `Must include: ${pinned.length} piece${pinned.length === 1 ? '' : 's'}`
              : '+ insist on a piece'}
          </button>
          {pickerOpen ? (
            <div className="grid-3">
              {wearable.map((g) => (
                <div
                  key={g.id}
                  style={{
                    borderRadius: 11,
                    outline: pinned.includes(g.id) ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 1,
                  }}
                >
                  <GarmentThumb
                    garment={g}
                    onClick={() =>
                      setPinned((prev) =>
                        prev.includes(g.id) ? prev.filter((p) => p !== g.id) : [...prev, g.id],
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
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
            <h2>Nothing clears the bar</h2>
            <p className="muted">
              Loosen the occasion, turn the dial up, or unpin a piece.
            </p>
          </div>
        ) : (
          <div className="grid-looks">
            {outfits.map((o) => (
              <LookTile key={o.id} outfit={o} garments={data.garments} onClick={() => setOpened(o)} />
            ))}
          </div>
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
