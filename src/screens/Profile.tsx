import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import { TopBar } from '../components/ui'

export function Profile() {
  const { data, resetEverything } = useApp()
  const navigate = useNavigate()
  const profile = data.profile
  if (!profile) return null

  const MODESTY = ['no rules', 'not too revealing', 'modest', 'full coverage']

  return (
    <>
      <TopBar title="You" back />
      <div className="screen stack">
        <div className="card stack-sm">
          <h2>{profile.name}</h2>
          <p className="tiny">
            {[profile.pronouns, profile.age ? `${profile.age}` : null, profile.location]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <hr className="divider" />
          <p className="tiny">Dresses: {profile.genderExpression}</p>
          <p className="tiny">Climate: {profile.climate}</p>
          <p className="tiny">Coverage: {MODESTY[profile.modesty]}</p>
          {profile.religion ? <p className="tiny">Respecting: {profile.religion}</p> : null}
          <p className="tiny">
            Shape: {profile.biometrics.bodyShape} · undertone: {profile.biometrics.undertone}
            {profile.biometrics.heightCm ? ` · ${profile.biometrics.heightCm}cm` : ''}
          </p>
        </div>

        <button className="btn btn-block" onClick={() => navigate('/welcome')}>
          Edit my details
        </button>

        <div className="card stack-sm">
          <span className="eyebrow">Data</span>
          <p className="tiny">
            {data.garments.length} pieces, {data.outfits.length} saved fits and{' '}
            {data.friends.length} friends, all stored in this browser only. There is no account
            server in this MVP.
          </p>
          <button
            className="btn btn-ghost btn-danger btn-block"
            onClick={() => {
              if (confirm('Delete everything and start over?')) {
                resetEverything()
                navigate('/welcome', { replace: true })
              }
            }}
          >
            Delete all my data
          </button>
        </div>
      </div>
    </>
  )
}
