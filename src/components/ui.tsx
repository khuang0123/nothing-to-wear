import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Garment, GarmentOrigin, Guardrail } from '../types'

export function TopBar({
  title,
  back,
  right,
}: {
  title?: ReactNode
  back?: boolean | string
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      {back ? (
        <button
          className="back"
          aria-label="Go back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          ‹
        </button>
      ) : null}
      <div className="wordmark">{title ?? <>nothing to <span>wear</span></>}</div>
      <div className="spacer" />
      {right}
    </header>
  )
}

const ORIGIN_LABEL: Record<GarmentOrigin, { text: string; cls: string }> = {
  user: { text: 'Your photo', cls: 'mine' },
  predicted: { text: 'We guessed', cls: 'guess' },
  'ai-suggested': { text: 'AI image', cls: 'ai' },
}

export function OriginBadge({ origin }: { origin: GarmentOrigin }) {
  const { text, cls } = ORIGIN_LABEL[origin]
  return <span className={`badge ${cls}`}>{text}</span>
}

export function GarmentThumb({
  garment,
  onClick,
  showLabel = true,
  role,
}: {
  garment: Garment
  onClick?: () => void
  showLabel?: boolean
  role?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="thumb" onClick={onClick} type={onClick ? 'button' : undefined}>
      {garment.imageDataUrl ? (
        <img src={garment.imageDataUrl} alt={garment.label} />
      ) : (
        <div className="fallback">
          <div className="swatch-row">
            {garment.colors.slice(0, 3).map((c) => (
              <span className="swatch" key={c} style={{ background: c }} />
            ))}
          </div>
          <span>{garment.label}</span>
        </div>
      )}
      <span className="corner">
        <OriginBadge origin={garment.origin} />
      </span>
      {showLabel ? (
        <span className="caption">
          {garment.label}
          {role && role !== garment.category ? ` · as ${role}` : ''}
        </span>
      ) : null}
    </Tag>
  )
}

export function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <span style={{ width: 66 }}>{label}</span>
      <span className="track">
        <span className="fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="val">{Math.round(value * 100)}</span>
    </div>
  )
}

export function NudgeList({
  warnings,
  onOverride,
  onAdjust,
}: {
  warnings: Guardrail[]
  onOverride?: () => void
  onAdjust?: () => void
}) {
  if (warnings.length === 0) return null
  return (
    <div className="stack-sm">
      {warnings.map((w, i) => (
        <div className={`nudge ${w.severity === 'strong' ? 'strong' : ''}`} key={`${w.kind}-${i}`}>
          <div className="head">
            <span className="kind">{w.kind}</span>
            <span>{w.message}</span>
          </div>
          <p className="tiny">{w.suggestion}</p>
          {i === 0 && (onOverride || onAdjust) ? (
            <div className="row" style={{ marginTop: 4 }}>
              {onAdjust ? (
                <button className="btn btn-sm" onClick={onAdjust}>
                  Adjust it
                </button>
              ) : null}
              {onOverride ? (
                <button className="btn btn-sm btn-ghost" onClick={onOverride}>
                  Wear it anyway
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/**
 * The activation-stage demo reel. Built as an animated CSS sequence rather than
 * a video file so the repo stays light — swap in a real <video src> here when
 * there is footage.
 */
export function DemoReel() {
  const frames: Array<{ colors: string[]; label: string; sub: string }> = [
    {
      colors: ['#2e3a55', '#c9b28c', '#1d1c1a'],
      label: 'A midi skirt worn as a tube top',
      sub: 'Same two pieces. Different job.',
    },
    {
      colors: ['#7d2e24', '#d8cfc0', '#4a4b3f'],
      label: 'Brick over oatmeal, army boot',
      sub: 'One loud colour, two quiet ones.',
    },
    {
      colors: ['#1d1c1a', '#1d1c1a', '#8f7a3c'],
      label: 'Black on black, gold at the wrist',
      sub: 'The accessory is the outfit.',
    },
    {
      colors: ['#3f5d45', '#b0563f', '#cfc6b4'],
      label: 'Green and rust, deliberately',
      sub: 'It should clash. That is the point.',
    },
  ]
  return (
    <div className="reel">
      <span className="tag badge ai">Demo reel</span>
      {frames.map((f) => (
        <div className="frame" key={f.label}>
          <div>
            <div className="blocks">
              {f.colors.map((c, i) => (
                <i key={`${c}-${i}`} style={{ background: c }} />
              ))}
            </div>
            <div className="label">{f.label}</div>
            <div className="sub">{f.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="progress-dots">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i <= current ? 'on' : ''} />
      ))}
    </div>
  )
}
