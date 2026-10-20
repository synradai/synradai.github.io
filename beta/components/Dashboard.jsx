import { useState } from 'react'
import { buildHoursRecord, dashboardSummary, hoursError, siteOptions } from '../lib/dashboard.js'
import { perthDate } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

function Bars({ items }) {
  if (!items.length) return <p className="muted">None in this range.</p>
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <ul className="flags">
      {items.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong>
          <div className="bar" style={{ marginTop: '0.35rem' }}><span style={{ width: `${Math.round((item.count / max) * 100)}%` }} /></div>
          <span>{item.count}</span>
        </li>
      ))}
    </ul>
  )
}

function RecordLinks({ rows }) {
  if (!rows?.length) return null
  return (
    <div className="link-row">
      {rows.slice(0, 8).map((row) => (
        <a key={row.id} href={`#/hse/record/${row.id}`}>{row.fields?.title || row.fields?.incidentType || row.fields?.siteArea || 'Open record'}</a>
      ))}
    </div>
  )
}

export default function Dashboard({ app }) {
  const today = perthDate()
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`)
  const [to, setTo] = useState(today)
  const [site, setSite] = useState('')
  const [hoursFrom, setHoursFrom] = useState(`${today.slice(0, 8)}01`)
  const [hoursTo, setHoursTo] = useState(today)
  const [hours, setHours] = useState('')
  const [hoursSite, setHoursSite] = useState('')
  const [error, setError] = useState('')
  const summary = dashboardSummary(app.rows, app.injuryCases, {
    from, to, site, today, columns: app.trainingMatrix?.columns || [],
  })
  const sites = siteOptions(app.rows)

  const saveHours = (event) => {
    event.preventDefault()
    const fields = { from: hoursFrom, to: hoursTo, hours, siteArea: hoursSite }
    const problem = hoursError(fields)
    if (problem) { setError(problem); return }
    app.addRecord(buildHoursRecord({ ruleset: app.site.ruleset || 'general', fields }))
    setHours('')
    setError('')
  }

  return (
    <>
      <p className="eyebrow">HSE</p>
      <h1>Dashboard</h1>
      <p className="lede">Counts from the records already filed. LTIFR is lost-time cases × 1,000,000 ÷ hours. TRIFR adds medical and restricted cases. Rates stay blank until hours are entered.</p>
      <form className="filters">
        <Field label="From">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="Site">
          <select value={site} onChange={(event) => setSite(event.target.value)}>
            <option value="">All sites</option>
            {sites.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
      </form>

      <div className="grid cards">
        <article className="card">
          <span className="tag live">Incidents</span>
          <strong>{summary.incidents.total}</strong>
          <span>By type</span>
          <Bars items={summary.incidents.byType} />
          <span>By severity</span>
          <Bars items={summary.incidents.bySeverity} />
          <span>By site</span>
          <Bars items={summary.incidents.bySite} />
          <span>By month</span>
          <Bars items={summary.incidents.byMonth} />
          <RecordLinks rows={summary.incidents.rows} />
        </article>
        <article className="card">
          <span className="tag live">Actions</span>
          <strong>{summary.actions.open} open · {summary.actions.closed} closed · {summary.actions.overdue} overdue</strong>
          <a href="#/hse/actions">Open the actions register</a>
          <RecordLinks rows={summary.actions.rows} />
        </article>
        <article className="card">
          <span className="tag live">Injuries</span>
          <strong>{summary.injury.LTI} LTI · {summary.injury.MTI} MTI · {summary.injury.FAI} FAI · {summary.injury.RWI} RWI</strong>
          <span>{summary.injury.daysLost} days lost. Hours worked: {summary.injury.hours || 'not entered'}.</span>
          <span>LTIFR {summary.injury.ltifr == null ? '—' : summary.injury.ltifr} · TRIFR {summary.injury.trifr == null ? '—' : summary.injury.trifr}</span>
          <div className="link-row">
            {summary.injury.rows.map((item) => (
              <a key={item.id} href={`#/hse/injury/${item.id}`}>{item.caseCode || 'Case'} · {item.classification}</a>
            ))}
          </div>
        </article>
        <article className="card">
          <span className="tag live">Inspections</span>
          <strong>{summary.inspections.done} done · {summary.inspections.planned} planned</strong>
          <span>Planned is the weekly inspection target stretched across this date range.</span>
          <a href="#/hse/inspections">File an inspection</a>
          <RecordLinks rows={summary.inspections.rows} />
        </article>
        <article className="card">
          <span className="tag live">Lead indicators</span>
          {summary.leads.map((item) => (
            <span key={item.id}>{item.label}: {item.count} of {item.target}{item.met ? '' : ' — short'}</span>
          ))}
          <a href="#/kpis">Weekly lead counts</a>
        </article>
        <article className="card">
          <span className="tag live">Training</span>
          <strong>{summary.training.current} current · {summary.training.expiring} expiring · {summary.training.expired} expired · {summary.training.missing} missing</strong>
          <span>Missing is a required course with nobody current in that role. Tickets are not split by site.</span>
          <a href="#/training">Open the training matrix</a>
        </article>
      </div>

      <form className="panel" onSubmit={saveHours}>
        <h2>Hours worked</h2>
        <p className="muted">Enter hours for a site and a date range. They are saved with the other HSE records.</p>
        <div className="filters">
          <Field label="From">
            <input type="date" value={hoursFrom} onChange={(event) => setHoursFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={hoursTo} onChange={(event) => setHoursTo(event.target.value)} />
          </Field>
          <Field label="Hours">
            <input inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
          </Field>
          <Field label="Site">
            <input value={hoursSite} onChange={(event) => setHoursSite(event.target.value)} placeholder="Optional" />
          </Field>
        </div>
        {error && <p className="note">{error}</p>}
        <Button type="submit">Save hours</Button>
      </form>
    </>
  )
}
