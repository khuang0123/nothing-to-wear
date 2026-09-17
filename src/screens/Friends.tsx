import { useState } from 'react'
import { useApp } from '../state/AppState'
import { isValidPhone, normalisePhone, shareOutfit } from '../lib/share'
import { TopBar } from '../components/ui'
import { useToast } from '../components/useToast'

/**
 * Referral stage. Friends are added by phone number, the closet has one
 * visibility switch, and posting out goes through the OS share sheet — which is
 * the only way a web app can legitimately reach Instagram or Snapchat.
 */
export function Friends() {
  const { data, addFriend, removeFriend, updateProfile } = useApp()
  const { toast, node: toastNode } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  if (!data.profile) return null
  const profile = data.profile
  const latestFit = data.outfits[0]

  function submit() {
    if (!isValidPhone(phone)) {
      toast('That phone number does not look right')
      return
    }
    addFriend(name.trim() || normalisePhone(phone), normalisePhone(phone))
    setName('')
    setPhone('')
    toast('Invite queued')
  }

  return (
    <>
      <TopBar title="Friends" />
      <div className="screen stack">
        <div className="card stack-sm">
          <span className="eyebrow">Your closet is {profile.closetVisibility}</span>
          <p className="tiny">
            {profile.closetVisibility === 'private'
              ? 'Only you can see your pieces and saved fits.'
              : `Visible to your ${data.friends.length} added friend${data.friends.length === 1 ? '' : 's'}. They can see pieces and fits, not your demographics.`}
          </p>
          <label className="switch">
            <input
              type="checkbox"
              checked={profile.closetVisibility === 'friends'}
              onChange={(e) => updateProfile({ closetVisibility: e.target.checked ? 'friends' : 'private' })}
            />
            <span style={{ fontSize: 14 }}>Let added friends browse my closet</span>
          </label>
        </div>

        <div className="card stack-sm">
          <span className="eyebrow">Add by phone number</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0123"
          />
          <button className="btn btn-primary btn-block" onClick={submit} disabled={!phone.trim()}>
            Add friend
          </button>
          <p className="tiny">
            In this MVP the invite is stored locally — there is no server yet, so nothing is sent to
            that number.
          </p>
        </div>

        {data.friends.length ? (
          <div className="stack-sm">
            <span className="eyebrow">Added ({data.friends.length})</span>
            {data.friends.map((f) => (
              <div className="card row-between" key={f.id}>
                <div>
                  <div style={{ fontSize: 14 }}>{f.name}</div>
                  <p className="tiny">{f.phone}</p>
                </div>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeFriend(f.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="card stack-sm">
          <span className="eyebrow">Post an outfit</span>
          {latestFit ? (
            <>
              <p className="tiny">
                Sends your most recent saved fit to the share sheet, where Instagram and Snapchat
                appear alongside everything else installed.
              </p>
              <button
                className="btn btn-block"
                onClick={async () => {
                  const result = await shareOutfit(latestFit, data.garments, latestFit.photoDataUrl)
                  if (result === 'copied') toast('Caption copied to clipboard')
                  if (result === 'downloaded') toast('Image saved, caption copied')
                  if (result === 'unsupported') toast('Sharing is not available in this browser')
                }}
              >
                Share my latest fit
              </button>
            </>
          ) : (
            <p className="tiny">Save a fit first and it will show up here.</p>
          )}
        </div>
      </div>
      {toastNode}
    </>
  )
}
