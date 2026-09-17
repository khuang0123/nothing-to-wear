import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import type { BodyShape, Climate, UserProfile, Undertone } from '../types'
import { guessClimate } from '../lib/context'
import { ProgressDots, TopBar } from '../components/ui'
import { isValidPhone, normalisePhone } from '../lib/share'

const CLIMATES: Array<{ value: Climate; label: string }> = [
  { value: 'hot', label: 'Hot all year' },
  { value: 'warm', label: 'Warm' },
  { value: 'mild', label: 'Four mild seasons' },
  { value: 'cool', label: 'Cool' },
  { value: 'cold', label: 'Properly cold winters' },
]

const SHAPES: Array<{ value: BodyShape; label: string }> = [
  { value: 'unspecified', label: 'Rather not say' },
  { value: 'rectangle', label: 'Straight up and down' },
  { value: 'hourglass', label: 'Waist narrower than both' },
  { value: 'pear', label: 'Hips wider than shoulders' },
  { value: 'inverted-triangle', label: 'Shoulders wider than hips' },
  { value: 'apple', label: 'Weight around the middle' },
]

const UNDERTONES: Array<{ value: Undertone; label: string }> = [
  { value: 'unspecified', label: 'Not sure' },
  { value: 'warm', label: 'Gold suits me' },
  { value: 'cool', label: 'Silver suits me' },
  { value: 'neutral', label: 'Both work' },
]

const GENDER_EXPRESSIONS: Array<UserProfile['genderExpression']> = [
  'feminine',
  'masculine',
  'androgynous',
  'fluid',
  'unspecified',
]

const MODESTY_LABELS = [
  'No coverage rules — style me however',
  'Prefer not too revealing',
  'Keep me modest',
  'Full coverage, always',
]

const STEPS = 4

export function Onboarding() {
  const { data, saveProfile, loadSampleCloset } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const existing = data.profile

  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [age, setAge] = useState(existing?.age ? String(existing.age) : '')
  const [pronouns, setPronouns] = useState(existing?.pronouns ?? '')
  const [genderExpression, setGenderExpression] = useState<UserProfile['genderExpression']>(
    existing?.genderExpression ?? 'unspecified',
  )
  const [religion, setReligion] = useState(existing?.religion ?? '')
  const [modesty, setModesty] = useState<UserProfile['modesty']>(existing?.modesty ?? 0)
  const [location, setLocation] = useState(existing?.location ?? '')
  const [climate, setClimate] = useState<Climate>(existing?.climate ?? 'mild')
  const [climateTouched, setClimateTouched] = useState(false)
  const [heightCm, setHeightCm] = useState(existing?.biometrics.heightCm ? String(existing.biometrics.heightCm) : '')
  const [bodyShape, setBodyShape] = useState<BodyShape>(existing?.biometrics.bodyShape ?? 'unspecified')
  const [undertone, setUndertone] = useState<Undertone>(existing?.biometrics.undertone ?? 'unspecified')

  const canContinue =
    step === 0 ? name.trim().length > 0 && isValidPhone(phone) : true

  function onLocationChange(value: string) {
    setLocation(value)
    if (climateTouched) return
    const guess = guessClimate(value)
    if (guess) setClimate(guess)
  }

  function finish() {
    saveProfile({
      name: name.trim(),
      phone: normalisePhone(phone),
      age: age ? Number(age) : undefined,
      pronouns: pronouns.trim(),
      genderExpression,
      religion: religion.trim() || undefined,
      modesty,
      location: location.trim(),
      climate,
      biometrics: {
        heightCm: heightCm ? Number(heightCm) : undefined,
        bodyShape,
        undertone,
      },
      closetVisibility: existing?.closetVisibility ?? 'private',
    })
    navigate('/home', { replace: true })
  }

  return (
    <>
      <TopBar right={<ProgressDots total={STEPS} current={step} />} />
      <div className="screen no-tabs stack">
        {step === 0 ? (
          <>
            <h1>
              You own more outfits
              <br />
              than you think.
            </h1>
            <p className="muted">
              This app remembers every piece you own and styles them against your taste — not a
              catalogue's. Nothing gets bought until we prove your closet genuinely cannot do it.
            </p>
            <label className="field">
              <span className="label">What should we call you</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name or handle" />
            </label>
            <label className="field">
              <span className="label">Phone number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0123"
              />
              <p className="tiny" style={{ marginTop: 6 }}>
                Only used so friends can find your closet later. Stored on this device.
              </p>
            </label>
            <div className="card stack-sm">
              <span className="eyebrow">Just looking?</span>
              <p className="tiny">
                Load a sample closet of 16 pieces and skip straight to the styling engine.
              </p>
              <button
                className="btn btn-sm"
                onClick={() => {
                  loadSampleCloset()
                  navigate('/home', { replace: true })
                }}
              >
                Load sample closet
              </button>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>A bit about you.</h1>
            <p className="muted">
              This shapes the rules, not the ceiling. Everything here is optional except the
              coverage setting, which is the one we never override without asking.
            </p>
            <div className="two-col">
              <label className="field">
                <span className="label">Age</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="24"
                />
              </label>
              <label className="field">
                <span className="label">Pronouns</span>
                <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="they/them" />
              </label>
            </div>
            <div className="field">
              <span className="label">How you like to dress</span>
              <div className="chips">
                {GENDER_EXPRESSIONS.map((g) => (
                  <button
                    key={g}
                    className="chip"
                    aria-pressed={genderExpression === g}
                    onClick={() => setGenderExpression(g)}
                  >
                    {g === 'unspecified' ? 'no label' : g}
                  </button>
                ))}
              </div>
              <p className="tiny" style={{ marginTop: 6 }}>
                We never infer this from your name or your body. It only biases silhouette
                suggestions, and the personality dial can override it.
              </p>
            </div>
            <label className="field">
              <span className="label">Religion or culture we should respect (optional)</span>
              <input
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                placeholder="e.g. Muslim, Sikh, Orthodox Jewish"
              />
            </label>
            <div className="field">
              <span className="label">Coverage: {MODESTY_LABELS[modesty]}</span>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={modesty}
                onChange={(e) => setModesty(Number(e.target.value) as UserProfile['modesty'])}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>Where are you dressing?</h1>
            <p className="muted">Weather is half of why an outfit fails in real life.</p>
            <label className="field">
              <span className="label">City</span>
              <input
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                placeholder="Chicago"
              />
            </label>
            <div className="field">
              <span className="label">Climate</span>
              <div className="chips">
                {CLIMATES.map((c) => (
                  <button
                    key={c.value}
                    className="chip"
                    aria-pressed={climate === c.value}
                    onClick={() => {
                      setClimate(c.value)
                      setClimateTouched(true)
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>Fit and colour.</h1>
            <p className="muted">
              Used for proportion advice at the conservative end of the dial. Turn the dial up and
              the app stops caring about flattering you.
            </p>
            <label className="field">
              <span className="label">Height (cm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
              />
            </label>
            <div className="field">
              <span className="label">Shape, roughly</span>
              <div className="chips">
                {SHAPES.map((s) => (
                  <button
                    key={s.value}
                    className="chip"
                    aria-pressed={bodyShape === s.value}
                    onClick={() => setBodyShape(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label">Jewellery that suits your skin</span>
              <div className="chips">
                {UNDERTONES.map((u) => (
                  <button
                    key={u.value}
                    className="chip"
                    aria-pressed={undertone === u.value}
                    onClick={() => setUndertone(u.value)}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="tiny">
              All of this stays in this browser's local storage. There is no server in this MVP.
            </p>
          </>
        ) : null}

        <div className="sticky-action row">
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={!canContinue}
            onClick={() => (step === STEPS - 1 ? finish() : setStep(step + 1))}
          >
            {step === STEPS - 1 ? 'Open the app' : 'Continue'}
          </button>
        </div>
      </div>
    </>
  )
}
