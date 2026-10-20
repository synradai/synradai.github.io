import { useState } from 'react'
import { CLASSIFICATIONS, INJURY_STATUSES, casesForEvent, injuryError, injuryLabel } from '../lib/injury.js'
import { timelineTitle, TIMELINE_LABELS } from '../lib/day.js'
import { go } from '../lib/routes.js'
import { Button, Field } from './ui.jsx'

function eventLabel(rows, eventId) {
  const row = (rows || []).find((item) => item.id === eventId)
  if (!row) return 'Linked incident'
  return `${TIMELINE_LABELS[row.kind] || row.kind}: ${timelineTitle(row)}`
}

export function InjuryForm({ initial, incidents, onSave, onCancel }) {
  const [fields, setFields] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (event) => setFields((prev) => ({ ...prev, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const problem = injuryError(fields)
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    try {
      await onSave(fields)
    } catch (err) {
      setError(err.message || 'Could not save the case.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <Field label="Injured person" hint="Stored for you and organisation admins only. The daily record shows the case ID.">
        <input value={fields.personName} onChange={set('personName')} autoComplete="off" />
      </Field>
      <Field label="Linked incident">
        <select value={fields.eventId} onChange={set('eventId')}>
          <option value="">Choose an incident</option>
          {incidents.map((row) => (
            <option key={row.id} value={row.id}>{timelineTitle(row)}</option>
          ))}
        </select>
      </Field>
      <Field label="Classification">
        <select value={fields.classification} onChange={set('classification')}>
          {CLASSIFICATIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select value={fields.status} onChange={set('status')}>
          {INJURY_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Field>
      <Field label="Body part" hint="Private, with the name.">
        <input value={fields.bodyPart} onChange={set('bodyPart')} />
      </Field>
      <Field label="Treatment" hint="Private, with the name.">
        <textarea value={fields.treatment} onChange={set('treatment')} />
      </Field>
      <Field label="Restricted from">
        <input type="date" value={fields.restrictedFrom || ''} onChange={set('restrictedFrom')} />
      </Field>
      <Field label="Return to work">
        <input type="date" value={fields.rtwOn || ''} onChange={set('rtwOn')} />
      </Field>
      <Field label="Medical note" hint="Private, with the name.">
        <textarea value={fields.note} onChange={set('note')} />
      </Field>
      {error && <p className="note">{error}</p>}
      <div className="actions">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save case'}</Button>
        {onCancel && <Button type="button" kind="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}

export default function Injury({ app, id }) {
  const [adding, setAdding] = useState(false)
  const incidents = app.rows.filter((row) => row.kind === 'incident')
  const selected = id ? (app.injuryCases || []).find((item) => item.id === id) : null

  const saveNew = async (fields) => {
    const saved = await app.saveInjury(fields)
    setAdding(false)
    if (saved?.id) go(`#/hse/injury/${saved.id}`)
  }

  const saveExisting = async (fields) => {
    await app.updateInjury(selected.id, fields)
  }

  if (id && !selected) return <p className="note">That case is not visible on this account.</p>

  if (selected) {
    return (
      <>
        <p className="eyebrow">Injury case</p>
        <h1>{injuryLabel(selected)}</h1>
        <p className="lede">
          <a href={`#/hse/record/${selected.eventId}`}>{eventLabel(app.rows, selected.eventId)}</a>
          {selected.restrictedFrom ? ` · restricted from ${selected.restrictedFrom}` : ''}
          {selected.rtwOn ? ` · return ${selected.rtwOn}` : ''}
        </p>
        {selected.private ? (
          <InjuryForm
            initial={{
              eventId: selected.eventId,
              personName: selected.personName || '',
              bodyPart: selected.bodyPart || '',
              treatment: selected.treatment || '',
              classification: selected.classification,
              status: selected.status,
              restrictedFrom: selected.restrictedFrom || '',
              rtwOn: selected.rtwOn || '',
              note: selected.note || '',
            }}
            incidents={incidents}
            onSave={saveExisting}
            onCancel={() => go('#/hse/injury')}
          />
        ) : (
          <div className="panel">
            <p>Case {selected.caseCode}. Classification {selected.classification}. Status {selected.status}.</p>
            <p className="note">The name, body part, treatment, and medical note stay with the person who opened the case and organisation admins.</p>
          </div>
        )}
        <div className="actions" style={{ marginTop: 12 }}>
          <Button type="button" kind="ghost" onClick={() => go('#/hse/injury')}>All cases</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="eyebrow">Injury</p>
      <h1>Injury cases</h1>
      <p className="lede">One case per injured person, linked to an incident. The register and the daily record show the case ID, never the name.</p>
      {!adding && <Button type="button" onClick={() => setAdding(true)}>Open a case</Button>}
      {adding && (
        <InjuryForm
          initial={{ eventId: incidents[0]?.id || '', personName: '', bodyPart: '', treatment: '', classification: 'FAI', status: 'open', restrictedFrom: '', rtwOn: '', note: '' }}
          incidents={incidents}
          onSave={saveNew}
          onCancel={() => setAdding(false)}
        />
      )}
      {(app.injuryCases || []).length === 0 && <p className="muted">No injury cases yet.</p>}
      <div className="grid" style={{ marginTop: '0.8rem' }}>
        {(app.injuryCases || []).map((item) => (
          <a className="card record" href={`#/hse/injury/${item.id}`} key={item.id}>
            <span className="tag live">{item.classification}</span>
            <strong>{injuryLabel(item)}</strong>
            <span>{eventLabel(app.rows, item.eventId)} · {item.status}</span>
          </a>
        ))}
      </div>
    </>
  )
}

export function InjuryChips({ app, eventId }) {
  const cases = casesForEvent(app.injuryCases, eventId)
  if (!cases.length) return null
  return (
    <span className="link-row">
      {cases.map((item) => (
        <a key={item.id} href={`#/hse/injury/${item.id}`}>{injuryLabel(item)}</a>
      ))}
    </span>
  )
}
