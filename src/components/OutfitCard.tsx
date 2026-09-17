import type { Garment, Outfit } from '../types'
import { Meter, NudgeList } from './ui'

/**
 * The outfit as the user sees it: the pieces laid out like a flat-lay board,
 * then why it works, then how to actually wear it.
 */
export function OutfitCard({
  outfit,
  garments,
  onSave,
  onShare,
  onReject,
  showScores = false,
  children,
}: {
  outfit: Outfit
  garments: Garment[]
  onSave?: () => void
  onShare?: () => void
  onReject?: () => void
  showScores?: boolean
  children?: React.ReactNode
}) {
  const pieces = outfit.itemIds
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g))

  return (
    <article className="card flush">
      {outfit.photoDataUrl ? (
        <img
          src={outfit.photoDataUrl}
          alt="Outfit of the day"
          style={{ width: '100%', display: 'block', aspectRatio: '3 / 4', objectFit: 'cover' }}
        />
      ) : (
        <div className="board">
          {pieces.map((g) => {
            const role = outfit.roles[g.id]
            return (
              <div className="slot" key={g.id}>
                {g.imageDataUrl ? (
                  <img src={g.imageDataUrl} alt={g.label} />
                ) : (
                  <span
                    style={{
                      width: '100%',
                      height: '100%',
                      background: `linear-gradient(140deg, ${g.colors[0] ?? '#555'}, ${
                        g.colors[1] ?? g.colors[0] ?? '#333'
                      })`,
                    }}
                  />
                )}
                <span className="role">{role ?? g.category}</span>
                {role && role !== g.category ? <span className="swap">swap</span> : null}
              </div>
            )
          })}
        </div>
      )}

      <div className="stack" style={{ padding: 16 }}>
        <div className="row-between">
          <div className="swatch-row">
            {outfit.palette.map((p) => (
              <span
                key={p.hex + p.role}
                className={`swatch${p.role === 'accent' ? '' : ' lg'}`}
                style={{ background: p.hex }}
                title={`${p.name} (${p.role})`}
              />
            ))}
          </div>
          <span className="badge">{Math.round(outfit.score * 100)}% match</span>
        </div>

        {outfit.rationale.length ? (
          <ul className="reasons">
            {outfit.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}

        {outfit.moves.length ? (
          <div className="stack-sm">
            <span className="eyebrow">How to wear it</span>
            <ul className="moves">
              {outfit.moves.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {outfit.accessories.length ? (
          <div className="stack-sm">
            <span className="eyebrow">Add on the side</span>
            {outfit.accessories.map((a) => (
              <div className="row" key={a.label} style={{ alignItems: 'flex-start' }}>
                <span className="swatch dot" style={{ background: a.color, marginTop: 5 }} />
                <div>
                  <div style={{ fontSize: 14 }}>{a.label}</div>
                  <p className="tiny">{a.why}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <NudgeList warnings={outfit.warnings} />

        {showScores ? (
          <div className="stack-sm">
            <span className="eyebrow">Why this scored where it did</span>
            <Meter label="context" value={outfit.breakdown.context} />
            <Meter label="vibe" value={outfit.breakdown.vibe} />
            <Meter label="colour" value={outfit.breakdown.color} />
            <Meter label="weather" value={outfit.breakdown.climate} />
            <Meter label="shape" value={outfit.breakdown.silhouette} />
            <Meter label="daring" value={outfit.breakdown.daring} />
          </div>
        ) : null}

        {children}

        {onSave || onShare || onReject ? (
          <div className="row">
            {onSave ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave}>
                {outfit.saved ? 'Saved' : 'Wear this'}
              </button>
            ) : null}
            {onShare ? (
              <button className="btn" onClick={onShare} aria-label="Share outfit">
                Share
              </button>
            ) : null}
            {onReject ? (
              <button className="btn btn-ghost btn-danger" onClick={onReject} aria-label="Remove outfit">
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
