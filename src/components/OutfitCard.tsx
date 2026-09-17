import { useState, type ReactNode } from 'react'
import type { Garment, Outfit } from '../types'
import { LookFigure, type LookPiece } from './LookFigure'
import { Meter } from './ui'

function piecesOf(outfit: Outfit, garments: Garment[]): LookPiece[] {
  return outfit.itemIds
    .map((id) => {
      const garment = garments.find((g) => g.id === id)
      return garment ? { garment, role: outfit.roles[id] ?? garment.category } : null
    })
    .filter((p): p is LookPiece => p !== null)
}

/**
 * A look as a tile: picture, three words, nothing else. Used in grids.
 */
export function LookTile({
  outfit,
  garments,
  onClick,
  badge,
}: {
  outfit: Outfit
  garments: Garment[]
  onClick?: () => void
  badge?: ReactNode
}) {
  const pieces = piecesOf(outfit, garments)
  return (
    <button className="look-tile" onClick={onClick} type="button">
      <span className="look-art">
        {outfit.photoDataUrl ? (
          <img src={outfit.photoDataUrl} alt="Outfit of the day" />
        ) : (
          <LookFigure pieces={pieces} className="figure" />
        )}
        {outfit.warnings.length ? <span className="look-flag" aria-label="Has a nudge" /> : null}
        {badge ? <span className="look-badge">{badge}</span> : null}
      </span>
      <span className="look-foot">
        <span className="look-headline">{outfit.headline}</span>
        <span className="palette-dots">
          {outfit.palette.map((p) => (
            <i key={p.hex + p.role} style={{ background: p.hex }} />
          ))}
        </span>
      </span>
    </button>
  )
}

/**
 * The full look: a large figure, a short caption, and everything else folded
 * away behind a tap. The picture is the recommendation; the words are notes.
 */
export function OutfitCard({
  outfit,
  garments,
  onSave,
  onShare,
  onReject,
  children,
}: {
  outfit: Outfit
  garments: Garment[]
  onSave?: () => void
  onShare?: () => void
  onReject?: () => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState<'why' | 'scores' | null>(null)
  const pieces = piecesOf(outfit, garments)
  const nudge = outfit.warnings[0]

  return (
    <article className="look-card">
      <div className="look-stage">
        {outfit.photoDataUrl ? (
          <img src={outfit.photoDataUrl} alt="Outfit of the day" className="look-photo" />
        ) : (
          <LookFigure pieces={pieces} className="figure" />
        )}
        <div className="look-swatches">
          {outfit.palette.map((p) => (
            <span key={p.hex + p.role} style={{ background: p.hex }} title={`${p.name} · ${p.role}`} />
          ))}
        </div>
        <span className="look-score">{Math.round(outfit.score * 100)}</span>
      </div>

      <h3 className="look-title">{outfit.headline}</h3>

      {/* The pieces, as chips rather than sentences. */}
      <div className="piece-row">
        {pieces.map((p) => (
          <span className="piece-chip" key={p.garment.id}>
            {p.garment.imageDataUrl ? (
              <img src={p.garment.imageDataUrl} alt="" />
            ) : (
              <i style={{ background: p.garment.colors[0] }} />
            )}
            {p.garment.label}
            {p.role !== p.garment.category ? <b> ⇄ {p.role}</b> : null}
          </span>
        ))}
      </div>

      {outfit.moves.length ? (
        <ol className="move-strip">
          {outfit.moves.map((m, i) => (
            <li key={m}>
              <span className="n">{i + 1}</span>
              {m}
            </li>
          ))}
        </ol>
      ) : null}

      {outfit.accessories.length ? (
        <div className="accessory-row">
          {outfit.accessories.map((a) => (
            <span className="accessory" key={a.label} title={a.why}>
              <i style={{ background: a.color }} />
              {a.label}
            </span>
          ))}
        </div>
      ) : null}

      {nudge ? (
        <div className={`nudge-slim ${nudge.severity === 'strong' ? 'strong' : ''}`}>
          <span className="dot" />
          <span>
            {nudge.message} <em>{nudge.suggestion}</em>
          </span>
        </div>
      ) : null}

      <div className="look-tools">
        <button className="tool" onClick={() => setOpen(open === 'why' ? null : 'why')}>
          Why
        </button>
        <button className="tool" onClick={() => setOpen(open === 'scores' ? null : 'scores')}>
          Scores
        </button>
        {onShare ? (
          <button className="tool" onClick={onShare}>
            Share
          </button>
        ) : null}
        {onReject ? (
          <button className="tool danger" onClick={onReject} aria-label="Remove outfit">
            Delete
          </button>
        ) : null}
      </div>

      {open === 'why' ? (
        <ul className="reasons">
          {outfit.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {open === 'scores' ? (
        <div className="stack-sm">
          <Meter label="context" value={outfit.breakdown.context} />
          <Meter label="vibe" value={outfit.breakdown.vibe} />
          <Meter label="colour" value={outfit.breakdown.color} />
          <Meter label="weather" value={outfit.breakdown.climate} />
          <Meter label="shape" value={outfit.breakdown.silhouette} />
          <Meter label="daring" value={outfit.breakdown.daring} />
        </div>
      ) : null}

      {children}

      {onSave ? (
        <button className="btn btn-primary btn-block" onClick={onSave}>
          {outfit.saved ? 'Saved' : 'Wear this'}
        </button>
      ) : null}
    </article>
  )
}
