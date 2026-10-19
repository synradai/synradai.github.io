import { FORM_KINDS } from '../config/forms.js'

export default function HseHome({ app }) {
  const counts = app.rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + 1
    return acc
  }, {})
  return (
    <>
      <p className="eyebrow">HSE · working</p>
      <h1>Capture</h1>
      <p className="lede">
        Voice or typed. {app.site.mine ? 'Mine-site flags include the WHS (Mines) Regulations 2022.' : 'General WHS flags are on. Turn the mine question on in site setup if this is a mine.'}
        {' '}Field list lives in beta/config/forms.js.
      </p>
      <div className="grid cards">
        {FORM_KINDS.map((kind) => (
          <a className="card" href={`#/hse/capture/${kind.id}`} key={kind.id}>
            <span className="tag live">Capture</span>
            <strong>{kind.label}</strong>
            <span>{kind.blurb}</span>
          </a>
        ))}
        <a className="card" href="#/hse/scan">
          <span className="tag live">Vision</span>
          <strong>Scan a paper form</strong>
          <span>Photo in, fields out, then you review before it is filed.</span>
        </a>
        <a className="card" href="#/hse/scene">
          <span className="tag live">Vision</span>
          <strong>Scene photo check</strong>
          <span>Grok looks for missed hazards and possible breach areas.</span>
        </a>
        <a className="card" href="#/hse/register">
          <span className="tag live">Register</span>
          <strong>All HSE records</strong>
          <span>{app.rows.length} on this device · {counts.incident || 0} incidents · {counts.hazard || 0} hazards · {counts.take5 || 0} Take 5s</span>
        </a>
      </div>
    </>
  )
}
