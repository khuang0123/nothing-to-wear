import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import { CONTEXT_OPTIONS } from '../lib/context'
import { VIBE_SUGGESTIONS } from '../lib/lexicon'
import { explainVibe } from '../lib/stylist'
import { styleDirections } from '../lib/directions'
import { DemoReel, TopBar } from '../components/ui'

const DIAL_LABELS = [
  'Play it straight — flatter me, fit the room',
  'Mostly safe, one surprise',
  'Open to strange',
  'Break the rules on purpose',
  'Nothing is a top, everything is a top',
]

function dialLabel(value: number) {
  return DIAL_LABELS[Math.min(DIAL_LABELS.length - 1, Math.floor(value / 20))]
}

/** Activation stage: the demo reel, the four preference dimensions, and directions. */
export function Home() {
  const { data, setPreferences } = useApp()
  const navigate = useNavigate()
  const prefs = data.preferences
  const [showDirections, setShowDirections] = useState(false)

  const vibe = useMemo(() => explainVibe(prefs.vibe), [prefs.vibe])
  const directions = useMemo(() => styleDirections(prefs, data.profile), [prefs, data.profile])
  const hasClothes = data.garments.some((g) => g.origin !== 'predicted' || g.confirmed)

  return (
    <>
      <TopBar
        right={
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/profile')}>
            {data.profile?.name ?? 'You'}
          </button>
        }
      />
      <div className="screen stack">
        <DemoReel />

        <div className="stack-sm">
          <h1>What are we dressing for?</h1>
          <p className="muted">Four questions. They change the maths, not just the copy.</p>
        </div>

        <div className="stack-sm">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="option"
              aria-pressed={prefs.context === opt.value}
              onClick={() => setPreferences({ context: opt.value })}
            >
              <span className="glyph">{opt.icon}</span>
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{opt.title}</span>
                <span className="tiny">{opt.blurb}</span>
              </span>
            </button>
          ))}
        </div>

        {prefs.context !== 'shuffle' ? (
          <label className="field">
            <span className="label">Anything specific? (optional)</span>
            <input
              value={prefs.contextNote}
              onChange={(e) => setPreferences({ contextNote: e.target.value })}
              placeholder="outdoor wedding, 2pm / first date / client pitch"
            />
            <p className="tiny" style={{ marginTop: 6 }}>
              Words like wedding, funeral, interview or mosque change the dress code we hold you to.
            </p>
          </label>
        ) : null}

        <div className="card stack-sm">
          <span className="eyebrow">Styling personality</span>
          <input
            type="range"
            min={0}
            max={100}
            value={prefs.adventurousness}
            onChange={(e) => setPreferences({ adventurousness: Number(e.target.value) })}
            aria-label="Styling personality, conservative to avant-garde"
          />
          <div className="row-between">
            <span className="tiny">conservative</span>
            <span className="tiny">avant-garde</span>
          </div>
          <p style={{ fontSize: 14 }}>{dialLabel(prefs.adventurousness)}</p>
        </div>

        <div className="stack-sm">
          <label className="field">
            <span className="label">What do you want to come across as?</span>
            <textarea
              value={prefs.vibe}
              onChange={(e) => setPreferences({ vibe: e.target.value })}
              placeholder="sexy but smart / fierce, not try-hard / quiet luxury"
            />
          </label>
          <div className="chips">
            {VIBE_SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => setPreferences({ vibe: s })}>
                {s}
              </button>
            ))}
          </div>
          {prefs.vibe.trim() ? (
            <div className="card stack-sm">
              <span className="eyebrow">What we heard</span>
              {vibe.matched.length ? (
                <p style={{ fontSize: 14 }}>{vibe.matched.join(' · ')}</p>
              ) : (
                <p className="tiny">
                  Nothing in that maps to our vocabulary yet — we will style neutral. Try a word
                  like sharp, soft, loud, covered or expensive.
                </p>
              )}
              {vibe.unmapped.length ? (
                <p className="tiny">Not understood: {vibe.unmapped.join(', ')}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <label className="switch card">
          <input
            type="checkbox"
            checked={prefs.guardrails}
            onChange={(e) => setPreferences({ guardrails: e.target.checked })}
          />
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
              Nudge me if something is wrong for the occasion
            </span>
            <span className="tiny">
              We will flag coverage, dress code and weather mismatches — and you can always wear it
              anyway.
            </span>
          </span>
        </label>

        {showDirections ? (
          <div className="stack-sm">
            <span className="eyebrow">Three directions for this brief</span>
            {directions.map((d) => (
              <div className="card stack-sm" key={d.title}>
                <div className="row-between">
                  <h3>{d.title}</h3>
                  <span className="swatch-row">
                    {d.palette.map((c) => (
                      <span key={c} className="swatch dot" style={{ background: c }} />
                    ))}
                  </span>
                </div>
                <p style={{ fontSize: 14 }}>{d.silhouette}</p>
                <p className="tiny">{d.hunt}</p>
              </div>
            ))}
          </div>
        ) : (
          <button className="btn btn-block" onClick={() => setShowDirections(true)}>
            Show me some potential styles
          </button>
        )}

        <div className="sticky-action stack-sm">
          <button className="btn btn-primary btn-block" onClick={() => navigate('/capture')}>
            Show me your clothes
          </button>
          {hasClothes ? (
            <button className="btn btn-ghost btn-block" onClick={() => navigate('/style')}>
              Style what is already in my closet
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}
