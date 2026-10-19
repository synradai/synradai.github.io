import { useState } from 'react'
import { getForm } from '../config/forms.js'
import { rewriteActions } from '../lib/ai.js'
import { formatWhen } from '../lib/time.js'
import { go } from '../lib/routes.js'
import { exportRecordPdf } from '../lib/pdfExport.js'
import { Button, FlagList, OfflineBanner } from './ui.jsx'

const LABELS = { incident: 'Incident', hazard: 'Hazard', take5: 'Take 5', 'scene-check': 'Scene check' }

export default function RecordView({ app, id }) {
  const record = app.rows.find((row) => row.id === id)
  const [note, setNote] = useState(record?.closeOut?.note || '')
  const [byRole, setByRole] = useState(record?.closeOut?.byRole || 'HSE adviser')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)

  if (!record) return <p className="note">That record is not on this device.</p>

  const fields = record.fields || {}
  const form = record.kind !== 'scene-check' ? getForm(record.kind) : null
  const majorLocked = record.path === 'investigation' && !record.fiveWhys?.rootCause?.trim()

  const toggle = (actionId) => {
    app.updateRecord(record.id, {
      correctiveActions: record.correctiveActions.map((action) => action.id === actionId ? { ...action, done: !action.done } : action),
    })
  }

  const rewrite = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await rewriteActions(record.kind, fields)
      setOffline(result.offline)
      app.updateRecord(record.id, {
        correctiveActions: result.actions.slice(0, 3).map((text, index) => ({
          id: `a${index + 1}`,
          text,
          ownerRole: record.correctiveActions[index]?.ownerRole || 'Supervisor',
          due: 'End of shift',
          done: false,
        })),
      })
    } catch (err) {
      setError(err.message || 'Could not rewrite the actions.')
    } finally {
      setBusy(false)
    }
  }

  const closeOut = () => {
    if (!note.trim()) { setError('Add a close-out note.'); return }
    if (majorLocked) { setError('Finish the five whys before closing a major record.'); return }
    app.updateRecord(record.id, {
      status: 'closed',
      closeOut: { note: note.trim(), byRole: byRole.trim() || 'HSE adviser', closedAt: new Date().toISOString() },
    })
  }

  return (
    <>
      <p className="eyebrow">{LABELS[record.kind] || record.kind} · {record.status}</p>
      <h1>{fields.siteArea || LABELS[record.kind]}</h1>
      <p className="muted">{formatWhen(fields.occurredAt || record.createdAt)} · severity {record.severity || '—'} · {record.source}</p>
      <OfflineBanner show={offline || record.sceneResult?.offline} />
      {record.path === 'investigation' && (
        <p className="note">Major record. <a href={`#/hse/investigate/${record.id}`}>Open the five whys</a>.</p>
      )}

      <div className="panel">
        {form && form.fields.filter((field) => field.type !== 'photos' && field.type !== 'severity').map((field) => (
          <p key={field.key}><strong>{field.label}. </strong>{fields[field.key] || '—'}</p>
        ))}
        {record.kind === 'scene-check' && (
          <>
            <p><strong>Note. </strong>{fields.note || '—'}</p>
            <h2>Missed hazards</h2>
            <ul>{(record.sceneResult?.missedHazards || []).map((item) => <li key={item}>{item}</li>)}</ul>
            <h2>Missed detail</h2>
            <ul>{(record.sceneResult?.missedDetails || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </>
        )}
        {(fields.photos || record.scenePhotos || []).length > 0 && (
          <div className="photos">{(fields.photos || record.scenePhotos).map((photo, index) => <img key={index} src={photo} alt="" />)}</div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>Possible breach — verify</h2>
        <FlagList flags={record.flags} />
      </div>

      {record.correctiveActions?.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h2>Corrective actions</h2>
          {record.correctiveActions.map((action) => (
            <label className="check" key={action.id}>
              <input type="checkbox" checked={Boolean(action.done)} onChange={() => toggle(action.id)} />
              <span>{action.text}<div className="hint">{action.ownerRole} · {action.due}</div></span>
            </label>
          ))}
          <Button type="button" kind="ghost" disabled={busy} onClick={rewrite}>{busy ? 'Rewriting…' : 'Rewrite with Grok'}</Button>
        </div>
      )}

      {record.kind !== 'scene-check' && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h2>Close-out</h2>
          {record.status === 'closed' ? (
            <p>Closed {formatWhen(record.closeOut?.closedAt)} by {record.closeOut?.byRole}. {record.closeOut?.note}</p>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Close-out note</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Closed by (role)</span>
                <input value={byRole} onChange={(event) => setByRole(event.target.value)} />
              </label>
              <Button type="button" onClick={closeOut} disabled={majorLocked}>Close out</Button>
            </>
          )}
        </div>
      )}

      {error && <p className="note">{error}</p>}
      <div className="actions" style={{ marginTop: 12 }}>
        <Button type="button" kind="ghost" onClick={() => exportRecordPdf(record)}>Export PDF</Button>
        <Button type="button" kind="ghost" onClick={() => go('#/hse/register')}>Register</Button>
        <Button type="button" kind="danger" onClick={() => { if (window.confirm('Delete this record from this device?')) { app.deleteRecord(record.id); go('#/hse/register') } }}>Delete</Button>
      </div>
    </>
  )
}
