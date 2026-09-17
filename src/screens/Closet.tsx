import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import type { Garment } from '../types'
import { localStylist } from '../lib/stylist'
import { shareOutfit } from '../lib/share'
import { LookTile, OutfitCard } from '../components/OutfitCard'
import { GarmentThumb, OriginBadge, TopBar } from '../components/ui'
import { useToast } from '../components/useToast'
import type { Outfit } from '../types'

/**
 * Engagement stage: the closet is the landing screen on every return visit.
 * Saved fits, the pieces themselves, and the pieces we think they own but have
 * not photographed — each labelled with where it came from.
 */
export function Closet() {
  const { data, report, predictions, confirmPrediction, dismissPrediction, removeGarment, removeOutfit, updateProfile } =
    useApp()
  const navigate = useNavigate()
  const { toast, node: toastNode } = useToast()
  const [tab, setTab] = useState<'fits' | 'pieces'>('fits')
  const [selected, setSelected] = useState<Garment | null>(null)
  const [opened, setOpened] = useState<Outfit | null>(null)

  const own = data.garments.filter((g) => g.origin === 'user')
  const guessed = data.garments.filter((g) => g.origin === 'predicted' && !g.confirmed)

  /**
   * Fits we think would work if the predicted pieces turn out to be real.
   * Explicitly flagged as suggestions so nothing masquerades as a worn outfit.
   */
  const suggested = useMemo(() => {
    if (!data.profile || predictions.length === 0 || own.length < 2) return []
    return localStylist.generate({
      garments: [...data.garments, ...predictions.map((p) => ({ ...p.garment, confirmed: true }))],
      profile: data.profile,
      prefs: data.preferences,
      history: data.outfits,
      limit: 2,
    })
  }, [data.profile, data.garments, data.preferences, data.outfits, predictions, own.length])

  if (!data.profile) return null

  if (opened) {
    const saved = data.outfits.some((o) => o.id === opened.id)
    return (
      <>
        <TopBar title="The look" onBack={() => setOpened(null)} />
        <div className="screen stack">
          <OutfitCard
            outfit={opened}
            garments={[...data.garments, ...predictions.map((p) => p.garment)]}
            onShare={async () => {
              const result = await shareOutfit(opened, data.garments, opened.photoDataUrl)
              if (result === 'copied' || result === 'downloaded') toast('Caption copied')
            }}
            onReject={
              saved
                ? () => {
                    removeOutfit(opened.id)
                    setOpened(null)
                    toast('Fit removed')
                  }
                : undefined
            }
          />
        </div>
        {toastNode}
      </>
    )
  }

  if (selected) {
    return (
      <>
        <TopBar title={selected.label} onBack={() => setSelected(null)} />
        <div className="screen stack">
          <GarmentThumb garment={selected} showLabel={false} />
          <div className="row">
            <OriginBadge origin={selected.origin} hasPhoto={Boolean(selected.imageDataUrl)} />
            <span className="badge">{selected.category}</span>
            <span className="badge">{selected.fit}</span>
            <span className="badge">{selected.pattern}</span>
          </div>
          <div className="card stack-sm">
            <span className="eyebrow">How we read it</span>
            <p className="tiny">
              Formality {selected.formality}/5 · warmth {selected.warmth}/5 · {selected.coverage} coverage ·{' '}
              {selected.fabric}
            </p>
            {selected.alternateRoles.length ? (
              <p className="tiny">
                Can also be styled as: {selected.alternateRoles.join(', ')}
              </p>
            ) : null}
            <div className="swatch-row">
              {selected.colors.map((c) => (
                <span key={c} className="swatch" style={{ background: c }} />
              ))}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-danger btn-block"
            onClick={() => {
              removeGarment(selected.id)
              setSelected(null)
              toast('Removed')
            }}
          >
            Remove from closet
          </button>
        </div>
        {toastNode}
      </>
    )
  }

  return (
    <>
      <TopBar
        title="Your closet"
        right={
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              updateProfile({
                closetVisibility: data.profile?.closetVisibility === 'private' ? 'friends' : 'private',
              })
            }
          >
            {data.profile.closetVisibility === 'private' ? '🔒 Private' : '👥 Friends'}
          </button>
        }
      />
      <div className="screen stack">
        {report ? (
          <div className={`card stack-sm ${report.verdict === 'not-enough' ? 'accent' : ''}`}>
            <div className="row-between">
              <span className="eyebrow">
                {report.verdict === 'rich'
                  ? 'Deep closet'
                  : report.verdict === 'workable'
                    ? 'Workable closet'
                    : 'Genuinely short on clothes'}
              </span>
              <span className="badge">{report.outfitCapacity} combinations</span>
            </div>
            <p style={{ fontSize: 14 }}>{report.summary}</p>
            {report.needs.length ? (
              <button className="btn btn-sm" onClick={() => navigate('/shop')}>
                See what would actually help
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="chips">
          <button className="chip" aria-pressed={tab === 'fits'} onClick={() => setTab('fits')}>
            Fits ({data.outfits.length})
          </button>
          <button className="chip" aria-pressed={tab === 'pieces'} onClick={() => setTab('pieces')}>
            Pieces ({data.garments.length})
          </button>
        </div>

        {tab === 'fits' ? (
          <>
            {data.outfits.length === 0 ? (
              <div className="empty">
                <span className="big">🪞</span>
                <h2>No saved fits yet</h2>
                <p className="muted">Style something and save it — this is where it lives.</p>
                <button className="btn btn-primary" onClick={() => navigate('/home')}>
                  Start styling
                </button>
              </div>
            ) : (
              <div className="grid-looks">
                {data.outfits.map((o) => (
                  <LookTile
                    key={o.id}
                    outfit={o}
                    garments={data.garments}
                    onClick={() => setOpened(o)}
                    badge={
                      <span className={`badge ${o.origin === 'ootd' ? 'mine' : 'ai'}`}>
                        {o.origin === 'ootd' ? 'yours' : 'ai'}
                      </span>
                    }
                  />
                ))}
              </div>
            )}

            {suggested.length ? (
              <div className="stack-sm">
                <span className="eyebrow">If our guesses are right</span>
                <div className="grid-looks">
                  {suggested.map((o) => (
                    <LookTile
                      key={o.id}
                      outfit={o}
                      garments={[...data.garments, ...predictions.map((p) => p.garment)]}
                      onClick={() => setOpened(o)}
                      badge={<span className="badge ai">idea</span>}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {guessed.length || predictions.length ? (
              <div className="card stack-sm">
                <span className="eyebrow">Do you also own these?</span>
                <p className="tiny">
                  Predicted from what you have uploaded. We will not style with them until you
                  confirm.
                </p>
                {predictions.map((p) => (
                  <div className="row-between" key={p.garment.id}>
                    <div className="row">
                      <span className="swatch" style={{ background: p.garment.colors[0] }} />
                      <div>
                        <div style={{ fontSize: 14 }}>{p.garment.label}</div>
                        <p className="tiny">{p.why}</p>
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          confirmPrediction(p.garment)
                          toast('Added — we will style with it')
                        }}
                      >
                        Yes
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => dismissPrediction(p.garment.id)}>
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {data.garments.length === 0 ? (
              <div className="empty">
                <span className="big">📷</span>
                <h2>Nothing in here yet</h2>
                <button className="btn btn-primary" onClick={() => navigate('/capture')}>
                  Add your first piece
                </button>
              </div>
            ) : (
              <div className="grid-2">
                {data.garments.map((g) => (
                  <GarmentThumb key={g.id} garment={g} onClick={() => setSelected(g)} />
                ))}
              </div>
            )}

            <button className="btn btn-block" onClick={() => navigate('/capture')}>
              Add more pieces
            </button>
          </>
        )}
      </div>
      {toastNode}
    </>
  )
}
