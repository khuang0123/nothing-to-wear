import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import type { Coverage, Fit, Formality, Garment, Pattern, Warmth } from '../types'
import { GARMENT_TYPES, garmentType } from '../lib/fabrics'
import { extractColors, fileToDataUrl, frameFromVideo } from '../lib/imageColors'
import { colorName } from '../lib/color'
import { TopBar } from '../components/ui'
import { useToast } from '../components/useToast'

interface Shot {
  key: string
  dataUrl?: string
  colors: string[]
}

const PATTERNS: Pattern[] = ['solid', 'stripe', 'check', 'floral', 'graphic', 'animal', 'abstract']
const FITS: Fit[] = ['fitted', 'straight', 'relaxed', 'oversized']
const COVERAGES: Coverage[] = ['minimal', 'moderate', 'full']

/**
 * Activation stage: show the app your options like you are holding them up on a
 * video call. Shots go into a tray, then each gets tagged. Tagging is
 * pre-filled from the garment type so it is two taps in the common case.
 */
export function Capture() {
  const { addGarment, data } = useApp()
  const navigate = useNavigate()
  const { toast, node: toastNode } = useToast()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<'off' | 'on' | 'denied'>('off')
  const [shots, setShots] = useState<Shot[]>([])
  const [active, setActive] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraState('off')
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraState('on')
    } catch {
      setCameraState('denied')
    }
  }

  async function addShot(dataUrl: string) {
    setBusy(true)
    try {
      const colors = await extractColors(dataUrl, 3)
      const shot: Shot = { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dataUrl, colors }
      setShots((prev) => [...prev, shot])
      setActive(shot)
    } finally {
      setBusy(false)
    }
  }

  function snap() {
    if (!videoRef.current) return
    const frame = frameFromVideo(videoRef.current)
    if (frame) void addShot(frame)
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const dataUrl = await fileToDataUrl(file)
        const colors = await extractColors(dataUrl, 3)
        const shot: Shot = {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl,
          colors,
        }
        setShots((prev) => [...prev, shot])
        setActive((prev) => prev ?? shot)
      }
    } finally {
      setBusy(false)
    }
  }

  function onTagged(garment: Omit<Garment, 'id' | 'createdAt'>, key: string) {
    addGarment(garment)
    setShots((prev) => prev.filter((s) => s.key !== key))
    setActive(null)
    toast(`${garment.label} added to your closet`)
  }

  const tagged = data.garments.filter((g) => g.origin === 'user').length

  if (active) {
    return (
      <>
        <TopBar title="Tag this piece" />
        <TagForm
          shot={active}
          onCancel={() => {
            setShots((prev) => prev.filter((s) => s.key !== active.key))
            setActive(null)
          }}
          onSave={(g) => onTagged(g, active.key)}
        />
        {toastNode}
      </>
    )
  }

  return (
    <>
      <TopBar back="/home" title="Show us your options" />
      <div className="screen stack">
        <div className="viewfinder">
          <video ref={videoRef} playsInline muted style={{ display: cameraState === 'on' ? 'block' : 'none' }} />
          {cameraState !== 'on' ? (
            <p className="hint">
              Hold pieces up one at a time, like you are showing a friend on a call. We read the
              colours off each shot automatically.
              {cameraState === 'denied' ? (
                <>
                  <br />
                  <br />
                  Camera access was blocked — upload from your photos instead.
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          {cameraState === 'on' ? (
            <>
              <button className="shutter" onClick={snap} disabled={busy} aria-label="Take photo">
                ◉
              </button>
              <button className="btn btn-ghost btn-sm" onClick={stopCamera}>
                Stop
              </button>
            </>
          ) : (
            <button className="btn" onClick={startCamera}>
              Open camera
            </button>
          )}
          <label className="btn btn-ghost">
            From photos
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
        </div>

        {busy ? <p className="tiny" style={{ textAlign: 'center' }}>Reading colours…</p> : null}

        {shots.length ? (
          <div className="stack-sm">
            <span className="eyebrow">Waiting to be tagged ({shots.length})</span>
            <div className="grid-3">
              {shots.map((s) => (
                <button className="thumb" key={s.key} onClick={() => setActive(s)}>
                  {s.dataUrl ? <img src={s.dataUrl} alt="Captured piece" /> : null}
                  <span className="caption">Tag it</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card stack-sm">
          <span className="eyebrow">No camera handy?</span>
          <p className="tiny">Add a piece by describing it — you can photograph it later.</p>
          <button
            className="btn btn-sm"
            onClick={() => setActive({ key: `manual-${Date.now()}`, colors: ['#2e2e33'] })}
          >
            Add without a photo
          </button>
        </div>

        <div className="sticky-action stack-sm">
          <p className="tiny" style={{ textAlign: 'center' }}>
            {tagged} piece{tagged === 1 ? '' : 's'} in your closet
          </p>
          <button
            className="btn btn-primary btn-block"
            disabled={tagged === 0}
            onClick={() => {
              stopCamera()
              navigate('/style')
            }}
          >
            Mix and match these
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => navigate('/closet')}>
            Go to my closet
          </button>
        </div>
      </div>
      {toastNode}
    </>
  )
}

function TagForm({
  shot,
  onSave,
  onCancel,
}: {
  shot: Shot
  onSave: (garment: Omit<Garment, 'id' | 'createdAt'>) => void
  onCancel: () => void
}) {
  const [typeLabel, setTypeLabel] = useState<string>('')
  const [colors, setColors] = useState<string[]>(shot.colors.slice(0, 3))
  const [pattern, setPattern] = useState<Pattern>('solid')
  const [fit, setFit] = useState<Fit>('straight')
  const [coverage, setCoverage] = useState<Coverage>('moderate')
  const [formality, setFormality] = useState<Formality>(3)
  const [warmth, setWarmth] = useState<Warmth>(3)
  const [fineTune, setFineTune] = useState(false)

  function chooseType(label: string) {
    setTypeLabel(label)
    const t = garmentType(label)
    if (!t) return
    setFit(t.fit)
    setCoverage(t.coverage)
    setFormality(t.formality)
    setWarmth(t.warmth)
  }

  const type = garmentType(typeLabel)

  function save() {
    if (!type) return
    onSave({
      label: `${colorName(colors[0] ?? '#888')} ${type.label.toLowerCase()}`,
      category: type.category,
      shape: type.shape,
      colors,
      pattern,
      formality,
      warmth,
      coverage,
      fit,
      fabric: type.fabric,
      origin: 'user',
      alternateRoles: type.alternateRoles,
      tags: type.tags,
      imageDataUrl: shot.dataUrl,
    })
  }

  return (
    <div className="screen stack">
      {shot.dataUrl ? (
        <img
          src={shot.dataUrl}
          alt="Piece being tagged"
          style={{ width: '100%', borderRadius: 16, aspectRatio: '3 / 4', objectFit: 'cover' }}
        />
      ) : null}

      <div className="field">
        <span className="label">Colours we picked up — tap to correct</span>
        <div className="row">
          {colors.map((c, i) => (
            <label key={i} style={{ position: 'relative' }}>
              <span className="swatch lg" style={{ background: c, display: 'block' }} />
              <input
                type="color"
                value={c}
                onChange={(e) =>
                  setColors((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                }
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }}
              />
            </label>
          ))}
          {colors.length < 3 ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setColors((p) => [...p, '#8a8a8a'])}>
              + colour
            </button>
          ) : null}
          {colors.length > 1 ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setColors((p) => p.slice(0, -1))}>
              − colour
            </button>
          ) : null}
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>
          Reading as {colors.map(colorName).join(', ')}.
        </p>
      </div>

      <div className="field">
        <span className="label">What is it?</span>
        <div className="chips">
          {GARMENT_TYPES.map((t) => (
            <button
              key={t.label}
              className="chip"
              aria-pressed={typeLabel === t.label}
              onClick={() => chooseType(t.label)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type ? (
        <>
          <div className="field">
            <span className="label">Pattern</span>
            <div className="chips">
              {PATTERNS.map((p) => (
                <button key={p} className="chip" aria-pressed={pattern === p} onClick={() => setPattern(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">How it sits</span>
            <div className="chips">
              {FITS.map((f) => (
                <button key={f} className="chip" aria-pressed={fit === f} onClick={() => setFit(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {type.alternateRoles.length ? (
            <p className="tiny">
              Good news: this can also be styled as {type.alternateRoles.join(' or ')} when your
              personality dial is turned up.
            </p>
          ) : null}

          {fineTune ? (
            <div className="card stack-sm">
              <div className="field">
                <span className="label">Formality — {formality}/5</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={formality}
                  onChange={(e) => setFormality(Number(e.target.value) as Formality)}
                />
              </div>
              <div className="field">
                <span className="label">Warmth — {warmth}/5</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value) as Warmth)}
                />
              </div>
              <div className="field">
                <span className="label">Coverage</span>
                <div className="chips">
                  {COVERAGES.map((c) => (
                    <button
                      key={c}
                      className="chip"
                      aria-pressed={coverage === c}
                      onClick={() => setCoverage(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => setFineTune(true)}>
              Fine tune formality, warmth, coverage
            </button>
          )}
        </>
      ) : (
        <p className="tiny">Pick the type and we will fill in the rest.</p>
      )}

      <div className="sticky-action row">
        <button className="btn btn-ghost" onClick={onCancel}>
          Discard
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!type} onClick={save}>
          Add to closet
        </button>
      </div>
    </div>
  )
}
