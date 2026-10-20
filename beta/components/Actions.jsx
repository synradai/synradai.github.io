import { useMemo, useState } from 'react'
import { actionError, buildActionRecord, canRemind, isOverdue, selectedOwner, sortActions, statusPatch } from '../lib/actions.js'
import { timelineTitle, TIMELINE_LABELS } from '../lib/day.js'
import { linkPair } from '../lib/links.js'
import { perthDate, perthDateTimeLocal } from '../lib/time.js'
import OwnerSelect from './OwnerSelect.jsx'
import { Button, Field } from './ui.jsx'

const FILTERS = [
  ['all', 'All'],
  ['open', 'Open'],
  ['overdue', 'Overdue'],
  ['done', 'Done'],
]

const STATUS_LABEL = { open: 'Open', 'in-progress': 'In progress', done: 'Done' }

export default function Actions({ app }) {
  const today = perthDate()
  const [filter, setFilter] = useState('open')
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [due, setDue] = useState(today)
  const [note, setNote] = useState('')
  const [linkId, setLinkId] = useState('')
  const [error, setError] = useState('')
  const [remindNote, setRemindNote] = useState('')
  const [remindingId, setRemindingId] = useState('')
  const actions = useMemo(() => sortActions(app.rows, today), [app.rows, today])
  const shown = actions.filter((row) => {
    if (filter === 'done') return row.status === 'done'
    if (filter === 'overdue') return isOverdue(row, today)
    if (filter === 'open') return row.status !== 'done'
    return true
  })
  const linkChoices = app.rows.filter((row) => row.kind !== 'action')

  const save = (event) => {
    event.preventDefault()
    const person = selectedOwner(app.orgMembers, app.user, ownerId)
    const fields = { title, owner: person?.name || '', ownerId: person?.id || '', due, note, status: 'open', occurredAt: perthDateTimeLocal().slice(0, 16) }
    const problem = actionError(fields)
    if (problem) {
      setError(problem)
      return
    }
    const action = buildActionRecord({ ruleset: app.site.ruleset || 'general', fields })
    if (linkId) {
      const linked = linkPair([action, ...app.rows], action.id, linkId)
      app.saveRecords(linked.filter((row) => row.id === action.id || row.id === linkId))
    } else {
      app.addRecord(action)
    }
    setTitle('')
    setNote('')
    setLinkId('')
    setError('')
  }

  const setStatus = (row, status) => app.updateRecord(row.id, statusPatch(row, status, today))

  const remind = async (row) => {
    setRemindingId(row.id)
    setRemindNote('')
    const result = await app.remindAction(row.id)
    setRemindNote(result?.reason || 'Reminder recorded.')
    setRemindingId('')
  }

  return (
    <>
      <p className="eyebrow">Actions</p>
      <h1>Actions register</h1>
      <p className="lede">The owner is someone in this organisation. Overdue means the due date has passed and the action is not done. A reminder is recorded once a day, and emailed when mail is configured.</p>
      <form className="panel" onSubmit={save}>
        <Field label="What needs to be done">
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Owner">
          <OwnerSelect members={app.orgMembers} user={app.user} value={ownerId} onChange={setOwnerId} />
        </Field>
        <Field label="Due">
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </Field>
        <Field label="Note" hint="Optional.">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field label="Link to a record" hint="Optional. The link is saved on both records.">
          <select value={linkId} onChange={(event) => setLinkId(event.target.value)}>
            <option value="">No link</option>
            {linkChoices.map((row) => (
              <option key={row.id} value={row.id}>{TIMELINE_LABELS[row.kind] || row.kind}: {timelineTitle(row)}</option>
            ))}
          </select>
        </Field>
        {error && <p className="note">{error}</p>}
        <Button type="submit">Add action</Button>
      </form>
      <div className="chip-row" aria-label="Filter actions" style={{ marginTop: '0.8rem' }}>
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={`chip${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {remindNote && <p className="note">{remindNote}</p>}
      {shown.length === 0 && <p className="muted">No actions in this filter.</p>}
      <div className="grid" style={{ marginTop: '0.8rem' }}>
        {shown.map((row) => {
          const overdue = isOverdue(row, today)
          const links = Array.isArray(row.links) ? row.links : []
          return (
            <div className="card record" key={row.id}>
              <span className={`tag ${overdue ? 'preview' : 'live'}`}>{overdue ? 'Overdue' : STATUS_LABEL[row.status] || row.status}</span>
              <strong>{row.fields?.title}</strong>
              <span>{row.fields?.owner || 'No owner'} · due {row.fields?.due || '—'}</span>
              {row.fields?.note && <span>{row.fields.note}</span>}
              {links.length > 0 && (
                <span className="link-row">
                  {links.map((link) => {
                    const other = app.rows.find((item) => item.id === link.id)
                    const label = other ? `${TIMELINE_LABELS[other.kind] || other.kind}: ${timelineTitle(other)}` : 'Linked record'
                    return <a key={link.id} href={`#/hse/record/${link.id}`}>{label}</a>
                  })}
                </span>
              )}
              {row.fields?.remindedOn === today && <span>Reminder recorded today.</span>}
              <div className="actions" style={{ marginTop: '0.6rem' }}>
                {canRemind(row, today) && <Button type="button" disabled={remindingId === row.id} onClick={() => remind(row)}>{remindingId === row.id ? 'Sending…' : 'Send reminder'}</Button>}
                {row.status !== 'open' && <Button type="button" kind="ghost" onClick={() => setStatus(row, 'open')}>Open</Button>}
                {row.status !== 'in-progress' && <Button type="button" kind="ghost" onClick={() => setStatus(row, 'in-progress')}>In progress</Button>}
                {row.status !== 'done' && <Button type="button" kind="ghost" onClick={() => setStatus(row, 'done')}>Done</Button>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
