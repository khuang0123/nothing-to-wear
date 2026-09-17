import { useApp } from '../state/AppState'
import { CO2E_SAVED_PER_ITEM, sourcesFor } from '../lib/shopping'
import { TopBar } from '../components/ui'

/**
 * The only screen that suggests spending money — and it stays empty unless the
 * closet analysis says the closet genuinely cannot do the job.
 */
export function Shop() {
  const { report, data } = useApp()

  if (!report || !data.profile) return null

  return (
    <>
      <TopBar title="What you actually need" />
      <div className="screen stack">
        <div className="card stack-sm">
          <span className="eyebrow">Verdict</span>
          <p style={{ fontSize: 15 }}>{report.summary}</p>
          <div className="row">
            <span className="badge">{report.outfitCapacity} combinations</span>
            <span className="badge">{Math.round(report.coverage * 100)}% of the basics covered</span>
          </div>
        </div>

        {report.needs.length === 0 ? (
          <div className="empty">
            <span className="big">✋</span>
            <h2>Buy nothing.</h2>
            <p className="muted">
              Every gap we can find is one you can style around. Go shuffle your closet instead —
              that is the whole point of this app.
            </p>
          </div>
        ) : (
          <>
            <p className="muted">
              Ranked by how many new outfits each one unlocks from clothes you already own. Nothing
              here is a trend.
            </p>
            {report.needs.map((need) => (
              <div className="card stack-sm" key={need.id}>
                <div className="row-between">
                  <h3>{need.query}</h3>
                  <span className={`badge ${need.priority === 'critical' ? 'guess' : ''}`}>
                    {need.priority}
                  </span>
                </div>
                <p style={{ fontSize: 14 }}>{need.reason}</p>
                <p className="tiny">
                  Aim for formality {need.formality}/5 and warmth {need.warmth}/5 so it connects to
                  the most pieces.
                </p>
                <hr className="divider" />
                <span className="eyebrow">Second-hand first</span>
                <div className="source-list">
                  {sourcesFor(need).map((s) => (
                    <a
                      className={`source${s.kind === 'new' ? ' new-item' : ''}`}
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      <span className="tiny">{s.note}</span>
                      <span className="spacer" />
                      <span className="tiny">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <p className="tiny">
              Buying these {report.needs.length} second-hand rather than new keeps roughly{' '}
              {Math.round(report.needs.length * CO2E_SAVED_PER_ITEM)}kg CO₂e and the water for{' '}
              {report.needs.length} new garments out of the system. Rough industry averages, not a
              precise figure.
            </p>
          </>
        )}
      </div>
    </>
  )
}
