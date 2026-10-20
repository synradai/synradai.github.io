import { useMemo, useState } from 'react'
import { isOverdue } from '../lib/actions.js'
import { QUICK_ADD, recordTime, recordsForDay, timelineDetail, timelineTitle, TIMELINE_LABELS } from '../lib/day.js'
import { cleanLinks } from '../lib/links.js'
import { buildNoteRecord } from '../lib/record.js'
import { go } from '../lib/routes.js'
import { perthDate, perthDateTimeLocal, shiftDate } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

export default function DailyRecord({ app }) {
  const [day, setDay] = useState(() => perthDate())
  const [adding, setAdding] = useState(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const rows = useMemo(() => recordsForDay(app.rows, day), [app.rows, day])
  const today = perthDate()

  const openFull = (kind) => {
    const clock = perthDateTimeLocal().slice(11, 16)
    sessionStorage.setItem('si-beta-prefill', JSON.stringify({ kind, occurredAt: `${day}T${clock}` }))
    go(`#/hse/capture/${kind}`)
  }

  const startShort = (kind) => {
    setAdding(kind)
    setTitle('')
    setNote('')
    setError('')
  }

  const saveShort = (event) => {
    event.preventDefault()
    if (!title.trim() && !note.trim()) {
      setError('Add a title or a note.')
      return
    }
    const clock = perthDateTimeLocal().slice(11, 16)
    const record = buildNoteRecord({
      kind: adding,
      ruleset: app.site.ruleset || 'general',
      fields: {
        occurredAt: `${day}T${clock}`,
        title: title.trim(),
        note: note.trim(),
        siteArea: app.site.siteName || '',
        reporter: 'HSE adviser',
      },
    })
    app.addRecord(record)
    setAdding(null)
    setTitle('')
    setNote('')
    setError('')
  }

  return (
    <>
      <p className="eyebrow">Daily record</p>
      <h1>{day === today ? 'Today' : day.split('-').reverse().join('/')}</h1>
      <p className="lede">Incidents, hazards, Take 5s, meetings, prestarts and toolbox talks for this day, on one timeline.</p>
      <div className="admin-inline">
        <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDay(shiftDate(day, -1))}>‹</button>
        <input aria-label="Day" type="date" value={day} onChange={(event) => setDay(event.target.value || today)} />
        <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDay(shiftDate(day, 1))}>›</button>
      </div>
      {day !== today && <Button type="button" kind="ghost" onClick={() => setDay(today)}>Today</Button>}
      <div className="chip-row" aria-label="Add to this day" style={{ marginTop: '0.8rem' }}>
        {QUICK_ADD.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${adding === item.id ? ' active' : ''}`}
            onClick={() => (item.full ? openFull(item.id) : startShort(item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>
      {adding && (
        <form className="panel" onSubmit={saveShort}>
          <h2>{QUICK_ADD.find((item) => item.id === adding)?.label}</h2>
          <Field label={QUICK_ADD.find((item) => item.id === adding)?.title || 'Title'}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Note" hint="Type the note. A full incident, hazard, or Take 5 still has the voice walkthrough.">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {error && <p className="note">{error}</p>}
          <div className="actions">
            <Button type="submit">Add to this day</Button>
            <Button type="button" kind="ghost" onClick={() => setAdding(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {rows.length === 0 && <p className="muted">Nothing filed for this day yet.</p>}
      <div className="grid" style={{ marginTop: '0.8rem' }}>
        {rows.map((row) => {
          const links = cleanLinks(row.links)
          const overdue = isOverdue(row, today)
          return (
            <div className="card record" key={row.id}>
              <a href={`#/hse/record/${row.id}`}>
                <span className={`tag ${overdue ? 'preview' : 'live'}`}>{overdue ? 'Overdue' : (TIMELINE_LABELS[row.kind] || row.kind)}</span>
                <strong>{recordTime(row) || '—'} · {timelineTitle(row)}</strong>
                <span>{timelineDetail(row) || row.status}</span>
              </a>
              {links.length > 0 && (
                <span className="link-row">
                  {links.map((link) => {
                    const other = app.rows.find((item) => item.id === link.id)
                    const label = other ? `${TIMELINE_LABELS[other.kind] || other.kind}: ${timelineTitle(other)}` : 'Linked record'
                    return <a key={link.id} href={`#/hse/record/${link.id}`}>{label}</a>
                  })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
