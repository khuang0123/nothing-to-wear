import { useId } from 'react'
import type { Garment, GarmentCategory, Pattern } from '../types'
import {
  BODY_PATHS,
  FIGURE_H,
  FIGURE_VIEWBOX,
  FIGURE_W,
  focusViewBox,
  geometryFor,
  shapeForRole,
} from '../lib/silhouette'
import { hexToHsl, hslToHex } from '../lib/color'

export interface LookPiece {
  garment: Garment
  role: GarmentCategory
}

/**
 * Draws an outfit on a figure: every piece in its real shape, real colour and
 * real position, with the user's own photo clipped into the garment path when
 * there is one. This is the primary output of the app — the text is secondary.
 */
export function LookFigure({
  pieces,
  className,
  showSwapMarks = true,
  focus = false,
}: {
  pieces: LookPiece[]
  className?: string
  /** Small dot on a piece being worn out of its own category. */
  showSwapMarks?: boolean
  /** Zoom to the single garment instead of showing the whole figure. */
  focus?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const resolved = pieces.map((p, index) => {
    const shape = shapeForRole(p.garment, p.role)
    return { ...p, shape, geo: geometryFor(shape, p.garment.fit), index }
  })

  // Two pieces in the same role are layered in real life, so draw the outer one
  // open — otherwise the second simply paints over the first and the look
  // appears to be missing a garment.
  const stacked = resolved.filter((d) => d.role === 'top')
  if (stacked.length > 1) {
    const innerFirst = [...stacked].sort((a, b) => a.garment.warmth - b.garment.warmth)
    innerFirst.slice(1).forEach((d, i) => {
      d.shape = 'jacket'
      d.geo = { ...geometryFor('jacket', d.garment.fit), layer: 28 + i }
    })
  }

  const drawn = resolved.sort((a, b) => a.geo.layer - b.geo.layer)
  const viewBox = focus && drawn.length === 1 ? focusViewBox(drawn[0].shape) : FIGURE_VIEWBOX

  return (
    <svg
      className={className}
      viewBox={viewBox}
      role="img"
      aria-label={pieces.map((p) => `${p.garment.label} as ${p.role}`).join(', ')}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {drawn.map((d) => (
          <Fill key={d.garment.id} uid={uid} index={d.index} garment={d.garment} paths={d.geo.paths} />
        ))}
      </defs>

      <ellipse cx={100} cy={299} rx={42} ry={7} fill="rgb(0 0 0 / 45%)" />

      {/* Mannequin, so bare arms and legs read as skin rather than holes. */}
      <g fill="var(--figure-body)">
        <path d={BODY_PATHS.head} />
        <path d={BODY_PATHS.neck} />
        <path d={BODY_PATHS.torso} />
        <path d={BODY_PATHS.armL} />
        <path d={BODY_PATHS.armR} />
        <path d={BODY_PATHS.legL} />
        <path d={BODY_PATHS.legR} />
      </g>

      {drawn.map((d) => {
        const base = d.garment.colors[0] ?? '#8a8a8a'
        const fill = d.garment.imageDataUrl
          ? `url(#${uid}-img-${d.index})`
          : d.garment.pattern === 'solid'
            ? base
            : `url(#${uid}-pat-${d.index})`
        return (
          <g key={d.garment.id}>
            {d.geo.paths.map((path, i) => (
              <path
                key={i}
                d={path}
                fill={fill}
                stroke={edgeColor(base)}
                strokeWidth={0.8}
                strokeLinejoin="round"
              />
            ))}
          </g>
        )
      })}

      {showSwapMarks
        ? drawn
            .filter((d) => d.role !== d.garment.category)
            .map((d) => <SwapMark key={`swap-${d.garment.id}`} role={d.role} />)
        : null}
    </svg>
  )
}

/** A hairline slightly darker than the garment, so adjacent pieces separate. */
function edgeColor(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex({ h, s: Math.max(0, s - 6), l: l > 50 ? Math.max(0, l - 22) : Math.min(100, l + 16) })
}

/** Photo clip or pattern definition for one garment. */
function Fill({
  uid,
  index,
  garment,
  paths,
}: {
  uid: string
  index: number
  garment: Garment
  paths: string[]
}) {
  if (garment.imageDataUrl) {
    return (
      <>
        <clipPath id={`${uid}-clip-${index}`}>
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <pattern
          id={`${uid}-img-${index}`}
          patternUnits="userSpaceOnUse"
          width={FIGURE_W}
          height={FIGURE_H}
        >
          {/* The photo is zoomed to the garment box so fabric, not background, fills the shape. */}
          <image
            href={garment.imageDataUrl}
            x={0}
            y={0}
            width={FIGURE_W}
            height={FIGURE_H}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      </>
    )
  }
  if (garment.pattern === 'solid') return null
  return (
    <PatternDef
      id={`${uid}-pat-${index}`}
      pattern={garment.pattern}
      base={garment.colors[0] ?? '#8a8a8a'}
      accent={garment.colors[1] ?? edgeColor(garment.colors[0] ?? '#8a8a8a')}
    />
  )
}

/** Geometric stand-ins for the pattern families, readable at thumbnail size. */
function PatternDef({
  id,
  pattern,
  base,
  accent,
}: {
  id: string
  pattern: Pattern
  base: string
  accent: string
}) {
  const common = { id, patternUnits: 'userSpaceOnUse' as const }
  switch (pattern) {
    case 'stripe':
      return (
        <pattern {...common} width={8} height={8}>
          <rect width={8} height={8} fill={base} />
          <rect width={3.5} height={8} fill={accent} />
        </pattern>
      )
    case 'check':
      return (
        <pattern {...common} width={10} height={10}>
          <rect width={10} height={10} fill={base} />
          <rect width={10} height={3} fill={accent} />
          <rect width={3} height={10} fill={accent} />
        </pattern>
      )
    case 'floral':
      return (
        <pattern {...common} width={14} height={14}>
          <rect width={14} height={14} fill={base} />
          <circle cx={4} cy={4} r={2.4} fill={accent} />
          <circle cx={11} cy={10} r={1.8} fill={accent} />
          <circle cx={7.5} cy={7.5} r={1} fill={accent} />
        </pattern>
      )
    case 'animal':
      return (
        <pattern {...common} width={16} height={16}>
          <rect width={16} height={16} fill={base} />
          <ellipse cx={5} cy={5} rx={3} ry={2} fill={accent} />
          <ellipse cx={12} cy={11} rx={2.4} ry={3} fill={accent} />
        </pattern>
      )
    case 'graphic':
      return (
        <pattern {...common} width={22} height={22}>
          <rect width={22} height={22} fill={base} />
          <rect x={5} y={5} width={12} height={12} rx={2} fill={accent} />
        </pattern>
      )
    case 'abstract':
      return (
        <pattern {...common} width={14} height={14} patternTransform="rotate(38)">
          <rect width={14} height={14} fill={base} />
          <rect width={14} height={5} fill={accent} />
        </pattern>
      )
    case 'solid':
      return null
  }
}

/** Marks the spot where a piece is doing a job it was not made for. */
function SwapMark({ role }: { role: GarmentCategory }) {
  const y = role === 'top' ? 88 : role === 'outerwear' ? 96 : role === 'bottom' ? 180 : 200
  return (
    <g>
      <circle cx={168} cy={y} r={9} fill="var(--accent)" />
      <text x={168} y={y + 3.6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1a0d08">
        ⇄
      </text>
    </g>
  )
}
