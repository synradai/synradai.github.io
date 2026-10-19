import { reportingFor } from '../config/regulations.js'

export default function Reporting({ ruleset, forced }) {
  const flow = reportingFor(ruleset || 'general')
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <p className="eyebrow">{flow.name} · {flow.within}</p>
      <h2>{forced ? 'WorkSafe flow' : 'Notifiable check'}</h2>
      <p className="lede">Possible breach, verify. This app does not notify {flow.name}.</p>
      <ul>
        {flow.steps.map((step) => <li key={step}>{step}</li>)}
      </ul>
      {flow.unverified.map((note) => <p className="note" key={note}>{note}</p>)}
    </div>
  )
}
