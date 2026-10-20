import { useMemo, useState } from 'react'
import { filterRecords, toCsv } from '../lib/csv.js'
import { formatWhen } from '../lib/time.js'
import { exportRegisterPdf } from '../lib/pdfExport.js'
import { Button } from './ui.jsx'

const KINDS = [
  ['all', 'All types'],
  ['incident', 'Incident'],
  ['hazard', 'Hazard'],
  ['take5', 'Take 5'],
  ['scene-check', 'Scene check'],
  ['meeting', 'Meeting'],
  ['prestart', 'Prestart'],
  ['toolbox', 'Toolbox talk'],
  ['action', 'Action'],
  ['inspection', 'Inspection'],
]

function download(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function Register({ app }) {
  const [query, setQuery] = useState({ kind: 'all', status: 'all', severity: 'all', search: '', from: '', to: '' })
  const rows = useMemo(() => filterRecords(app.rows, query), [app.rows, query])
  const set = (key) => (event) => setQuery((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <>
      <p className="eyebrow">HSE register</p>
      <h1>{app.wording?.registerTitle || 'All records'}</h1>
      <p className="lede">{rows.length} shown of {app.rows.length} on this device. Filters apply to the CSV and the PDF.</p>
      <div className="filters">
        <select aria-label="Type" value={query.kind} onChange={set('kind')}>
          {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Status" value={query.status} onChange={set('status')}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="investigation">Investigation</option>
          <option value="closed">Closed</option>
          <option value="filed">Filed</option>
        </select>
        <select aria-label="Severity" value={query.severity} onChange={set('severity')}>
          <option value="all">All severities</option>
          {[1, 2, 3, 4, 5].map((level) => <option key={level} value={String(level)}>{level}</option>)}
        </select>
        <input aria-label="Search" placeholder="Search" value={query.search} onChange={set('search')} />
        <input aria-label="From" type="date" value={query.from} onChange={set('from')} />
        <input aria-label="To" type="date" value={query.to} onChange={set('to')} />
      </div>
      <div className="actions" style={{ marginBottom: 12 }}>
        <Button type="button" kind="ghost" onClick={() => download('hse-register.csv', toCsv(rows), 'text/csv;charset=utf-8')}>Export CSV</Button>
        <Button type="button" kind="ghost" onClick={() => exportRegisterPdf(rows)}>Export PDF</Button>
      </div>
      {rows.length === 0 && <p className="muted">No records in this filter yet. Capture an incident, hazard, or Take 5 to start the register.</p>}
      <div className="grid">
        {rows.map((row) => (
          <a className="card record" href={`#/hse/record/${row.id}`} key={row.id}>
            <strong>{row.fields?.siteArea || row.kind} · {row.kind}</strong>
            <span>{formatWhen(row.fields?.occurredAt || row.createdAt)} · severity {row.severity || '—'} · {row.ruleset || 'general'} · {row.status}</span>
            <span>{row.fields?.description || row.fields?.task || row.fields?.note || 'No description'}</span>
          </a>
        ))}
      </div>
    </>
  )
}
