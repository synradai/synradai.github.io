import { FORM_KINDS } from '../config/forms.js'
import { resolveForm } from '../lib/config.js'
import { rulesetMeta } from '../config/regulations.js'

export default function HseHome({ app }) {
  const counts = app.rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + 1
    return acc
  }, {})
  const ruleset = rulesetMeta(app.site.ruleset)
  return (
    <>
      <p className="eyebrow">HSE · working</p>
      <h1>{app.wording?.hseTitle || 'Capture'}</h1>
      <p className="lede">
        {app.wording?.hseIntro || 'Voice or typed.'} This site uses the {ruleset.label} ruleset ({ruleset.instrument}).
      </p>
      <div className="grid cards">
        <a className="card" href="#/hse/dashboard">
          <span className="tag live">Counts</span>
          <strong>Dashboard</strong>
          <span>Incidents, actions, injuries, inspections, leads, and training for a date range and site.</span>
        </a>
        <a className="card" href="#/hse/day">
          <span className="tag live">Today</span>
          <strong>Daily record</strong>
          <span>One timeline for incidents, hazards, Take 5s, meetings, prestarts and toolbox talks.</span>
        </a>
        {FORM_KINDS.map((kind) => {
          const form = resolveForm(kind.id, app.formsConfig)
          return (
          <a className="card" href={`#/hse/capture/${kind.id}`} key={kind.id}>
            <span className="tag live">Capture</span>
            <strong>{form?.label || kind.label}</strong>
            <span>{kind.blurb}</span>
          </a>
          )
        })}
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
        <a className="card" href="#/hse/inspections">
          <span className="tag live">Inspect</span>
          <strong>Inspections</strong>
          <span>Pass, fail, or N/A. Each failed item opens an action.</span>
        </a>
        <a className="card" href="#/hse/injury">
          <span className="tag live">Injury</span>
          <strong>Injury cases</strong>
          <span>One case per person, linked to the incident. The timeline shows the case ID.</span>
        </a>
        <a className="card" href="#/hse/actions">
          <span className="tag live">Actions</span>
          <strong>Actions register</strong>
          <span>Owner from the organisation, due date, overdue, and a daily reminder.</span>
        </a>
        <a className="card" href="#/hse/audit">
          <span className="tag live">Audit</span>
          <strong>Audit trail</strong>
          <span>Who changed a record, when, and a short before and after. Export the list.</span>
        </a>
        <a className="card" href="#/hse/register">
          <span className="tag live">Register</span>
          <strong>{app.wording?.registerTitle || 'All HSE records'}</strong>
          <span>{app.rows.length} on this device · {counts.incident || 0} incidents · {counts.hazard || 0} hazards · {counts.take5 || 0} Take 5s</span>
        </a>
      </div>
    </>
  )
}
