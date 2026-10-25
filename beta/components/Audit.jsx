import { useEffect, useMemo, useState } from 'react'
import { auditToCsv, filterAudit } from '../lib/audit.js'
import { brandFrom, exportReportPdf } from '../lib/reportPdf.js'
import { supabase } from '../lib/supabase.js'
import { formatWhen, perthDate } from '../lib/time.js'
import { Button } from './ui.jsx'

const ACTIONS = [
  ['all', 'All actions'],
  ['create', 'Created'],
  ['update', 'Updated'],
  ['delete', 'Deleted'],
  ['export', 'Exported'],
]

const ENTITIES = [
  ['all', 'All types'],
  ['hse_records', 'Records'],
  ['injury_cases', 'Injury cases'],
  ['app_config', 'Configuration'],
  ['audit_events', 'Audit export'],
  ['sites', 'Sites'],
  ['people', 'People'],
]

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function Audit({ app }) {
  const [events, setEvents] = useState([])
  const [names, setNames] = useState({})
  const [note, setNote] = useState('')
  const [query, setQuery] = useState({ day: '', action: 'all', entity: 'all' })
  const rows = useMemo(() => filterAudit(events, query), [events, query])

  const load = async () => {
    if (!supabase || app.user?.local) {
      setNote('Audit events are written in the beta project. This device-only session has no cloud trail.')
      return
    }
    const [{ data, error }, profiles] = await Promise.all([
      supabase.from('audit_events').select('id,actor_id,action,entity,entity_id,summary,before,after,created_at').order('created_at', { ascending: false }).limit(400),
      supabase.from('profiles').select('id, full_name'),
    ])
    if (error) {
      setNote('The audit trail is not available yet. Apply the beta audit migration if this project does not have it.')
      return
    }
    setEvents(data || [])
    const map = {}
    for (const profile of profiles.data || []) map[profile.id] = profile.full_name || ''
    setNames(map)
    setNote('')
  }

  useEffect(() => { load() }, [app.user?.id])

  const who = (event) => names[event.actor_id] || (event.actor_id ? 'Signed-in user' : 'System')

  const exportRows = async (format) => {
    if (format === 'csv') download(`audit-${query.day || perthDate()}.csv`, auditToCsv(rows))
    else {
      await exportReportPdf({
        filename: `safe-intelligence-audit-${query.day || perthDate()}.pdf`,
        title: 'Audit trail',
        dateLabel: query.day || 'All loaded days',
        advisor: 'Safe Intelligence beta',
        ...brandFrom(app.site),
        blocks: [{
          type: 'section',
          heading: `${rows.length} event${rows.length === 1 ? '' : 's'}`,
          body: rows.map((event) => `${formatWhen(event.created_at)} · ${event.action} · ${who(event)}\n${event.summary || event.entity}`).join('\n\n') || 'No events in this filter.',
        }],
      })
    }
    try {
      await app.logExport({
        entity: 'audit_events',
        entityId: query.day || 'all',
        summary: `Exported ${rows.length} audit events as ${format.toUpperCase()}`,
        detail: { format, count: rows.length, day: query.day, action: query.action, entity: query.entity },
      })
      load()
    } catch {
      setNote('The file downloaded. The export itself could not be written to the audit trail.')
    }
  }

  return (
    <>
      <p className="eyebrow">Audit</p>
      <h1>What changed</h1>
      <p className="lede">Creates, edits and deletes on HSE records are appended here, with who, when, and a short before and after. This list does not include record bodies.</p>
      {note && <p className="note">{note}</p>}
      <div className="filters">
        <input aria-label="Day" type="date" value={query.day} onChange={(event) => setQuery((prev) => ({ ...prev, day: event.target.value }))} />
        <select aria-label="Action" value={query.action} onChange={(event) => setQuery((prev) => ({ ...prev, action: event.target.value }))}>
          {ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Type" value={query.entity} onChange={(event) => setQuery((prev) => ({ ...prev, entity: event.target.value }))}>
          {ENTITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="button" kind="ghost" onClick={() => setQuery({ day: '', action: 'all', entity: 'all' })}>Clear</Button>
      </div>
      <div className="actions" style={{ marginBottom: 12 }}>
        <Button type="button" kind="ghost" onClick={() => exportRows('csv')}>Export CSV</Button>
        <Button type="button" kind="ghost" onClick={() => exportRows('pdf')}>Export PDF</Button>
      </div>
      <p className="muted">{rows.length} shown of {events.length} loaded.</p>
      {rows.length === 0 && <p className="muted">No audit events in this filter yet. File or edit a record while signed in to the beta project.</p>}
      <div className="grid">
        {rows.map((event) => (
          <article className="card" key={event.id}>
            <span className="tag live">{event.action}</span>
            <strong>{event.summary || event.entity}</strong>
            <span>{formatWhen(event.created_at)} · {who(event)} · {event.entity} {event.entity_id || ''}</span>
            {(event.before || event.after) && (
              <span>Before {brief(event.before)} · After {brief(event.after)}</span>
            )}
          </article>
        ))}
      </div>
    </>
  )
}

function brief(value) {
  if (!value || typeof value !== 'object') return '—'
  const parts = [value.kind, value.status, value.label].filter(Boolean)
  return parts.join(' · ') || '—'
}
