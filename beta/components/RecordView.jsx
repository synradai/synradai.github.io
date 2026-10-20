import { useState } from 'react'
import { actionError, buildActionRecord, isOverdue, statusPatch } from '../lib/actions.js'
import { resolveForm } from '../lib/config.js'
import { rewriteActions } from '../lib/ai.js'
import { timelineTitle, TIMELINE_LABELS } from '../lib/day.js'
import { cleanLinks, linkPair, unlinkPair } from '../lib/links.js'
import { formatWhen, perthDate, perthDateTimeLocal } from '../lib/time.js'
import { go } from '../lib/routes.js'
import { exportRecordPdf } from '../lib/pdfExport.js'
import { InjuryChips, InjuryForm } from './Injury.jsx'
import Reporting from './Reporting.jsx'
import { Button, Field, FlagList, OfflineBanner } from './ui.jsx'

const LABELS = { incident: 'Incident', hazard: 'Hazard', take5: 'Take 5', 'scene-check': 'Scene check', meeting: 'Meeting', prestart: 'Prestart', toolbox: 'Toolbox talk', action: 'Action', inspection: 'Inspection' }
const RESULT_LABEL = { pass: 'Pass', fail: 'Fail', na: 'N/A' }
const NOTE_KINDS = new Set(['meeting', 'prestart', 'toolbox', 'training'])
const STATUS_LABEL = { open: 'Open', 'in-progress': 'In progress', done: 'Done' }

export default function RecordView({ app, id }) {
  const record = app.rows.find((row) => row.id === id)
  const [note, setNote] = useState(record?.closeOut?.note || '')
  const [byRole, setByRole] = useState(record?.closeOut?.byRole || 'HSE adviser')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [linkId, setLinkId] = useState('')
  const [actionTitle, setActionTitle] = useState('')
  const [actionOwner, setActionOwner] = useState('')
  const [actionDue, setActionDue] = useState(() => perthDate())
  const [raising, setRaising] = useState(false)
  const [caseOpen, setCaseOpen] = useState(false)

  if (!record) return <p className="note">That record is not on this device.</p>

  const fields = record.fields || {}
  const form = resolveForm(record.kind, app.formsConfig)
  const needsWhys = record.path === 'review' || record.path === 'escalate' || record.path === 'investigation'
  const whysOpen = needsWhys && !record.fiveWhys?.rootCause?.trim()
  const actionsOpen = (record.correctiveActions || []).some((action) => !action.done)

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

  const links = cleanLinks(record.links)
  const others = app.rows.filter((row) => row.id !== record.id && !links.some((link) => link.id === row.id))
  const today = perthDate()

  const addLink = () => {
    if (!linkId) return
    const next = linkPair(app.rows, record.id, linkId)
    app.saveRecords(next.filter((row) => row.id === record.id || row.id === linkId))
    setLinkId('')
  }

  const removeLink = (otherId) => {
    const next = unlinkPair(app.rows, record.id, otherId)
    app.saveRecords(next.filter((row) => row.id === record.id || row.id === otherId))
  }

  const raiseAction = (event) => {
    event.preventDefault()
    const fields = {
      title: actionTitle,
      owner: actionOwner,
      due: actionDue,
      status: 'open',
      occurredAt: perthDateTimeLocal().slice(0, 16),
    }
    const problem = actionError(fields)
    if (problem) { setError(problem); return }
    const action = buildActionRecord({ ruleset: record.ruleset || app.site.ruleset || 'general', fields })
    const next = linkPair([action, ...app.rows], action.id, record.id)
    app.saveRecords(next.filter((row) => row.id === action.id || row.id === record.id))
    setActionTitle('')
    setActionOwner('')
    setRaising(false)
    setError('')
  }

  const closeOut = () => {
    if (!note.trim()) { setError('Add a close-out note.'); return }
    if (!byRole.trim()) { setError('A supervisor or HSE role has to verify the close-out.'); return }
    if (record.path === 'closeout' && actionsOpen) { setError('Tick off the actions. A supervisor verifies them before this closes.'); return }
    if (whysOpen) { setError('Finish the five whys before close-out. Level 4 and 5 do not auto-close.'); return }
    if (record.path === 'review' && !record.fiveWhys?.signOff?.trim()) { setError('Level 3 needs an HSE sign-off on the five whys.'); return }
    if (record.path === 'escalate' && !record.fiveWhys?.signOff?.trim()) { setError('Level 4 and 5 stay open until the investigation is signed off.'); return }
    app.updateRecord(record.id, {
      status: 'closed',
      closeOut: { note: note.trim(), byRole: byRole.trim(), closedAt: new Date().toISOString() },
    })
  }

  return (
    <>
      <p className="eyebrow">{LABELS[record.kind] || record.kind} · {record.status}</p>
      <h1>{record.kind === 'action' || record.kind === 'inspection' ? (fields.title || LABELS[record.kind]) : (fields.siteArea || LABELS[record.kind])}</h1>
      <p className="muted">{formatWhen(fields.occurredAt || record.createdAt)} · driving severity {record.severity || '—'} · {record.ruleset || 'general'} · {record.source}</p>
      <OfflineBanner show={offline || record.sceneResult?.offline} />
      {record.path === 'stopped' && <p className="note">Stopped. A Take 5 answer was No, so the task does not start until a supervisor clears it.</p>}
      {needsWhys && (
        <p className="note">{record.path === 'escalate' ? 'Escalated. No auto-close.' : 'HSE review.'} <a href={`#/hse/investigate/${record.id}`}>Open the five whys</a>.</p>
      )}
      {(record.notifiable || record.path === 'escalate') && <Reporting ruleset={record.ruleset} forced={record.notifiable || record.path === 'escalate'} />}

      {record.kind === 'action' && (
        <div className="panel">
          <p><strong>{fields.title || 'Action'}. </strong>{fields.note || ''}</p>
          <p>Owner {fields.owner || '—'} · due {fields.due || '—'} · {STATUS_LABEL[record.status] || record.status}</p>
          {isOverdue(record, today) && <p className="note">Overdue. The due date has passed and this action is not done.</p>}
          <div className="actions">
            {record.status !== 'open' && <Button type="button" kind="ghost" onClick={() => app.updateRecord(record.id, statusPatch(record, 'open', today))}>Open</Button>}
            {record.status !== 'in-progress' && <Button type="button" kind="ghost" onClick={() => app.updateRecord(record.id, statusPatch(record, 'in-progress', today))}>In progress</Button>}
            {record.status !== 'done' && <Button type="button" kind="ghost" onClick={() => app.updateRecord(record.id, statusPatch(record, 'done', today))}>Done</Button>}
          </div>
        </div>
      )}

      {record.kind === 'inspection' && (
        <div className="panel">
          <p><strong>{fields.title || 'Inspection'}. </strong>{fields.note || ''}</p>
          {(record.checks || []).map((check) => (
            <p key={check.id}><strong>{RESULT_LABEL[check.result] || check.result}. </strong>{check.label}{check.note ? ` — ${check.note}` : ''}</p>
          ))}
        </div>
      )}

      {record.kind !== 'action' && record.kind !== 'inspection' && (
      <div className="panel">
        {NOTE_KINDS.has(record.kind) && (
          <>
            <p><strong>{fields.title || fields.topic || fields.task || 'Note'}. </strong></p>
            <p>{fields.note || fields.description || '—'}</p>
          </>
        )}
        {form && !NOTE_KINDS.has(record.kind) && form.fields.filter((field) => field.type !== 'photos' && field.type !== 'severity' && field.type !== 'note' && (fields[field.key] || field.required)).map((field) => (
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
      )}

      {record.kind !== 'action' && record.kind !== 'inspection' && !NOTE_KINDS.has(record.kind) && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h2>Possible breach — verify</h2>
          <FlagList flags={record.flags} />
        </div>
      )}

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

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>Linked records</h2>
        {links.length === 0 && <p className="muted">Nothing linked yet.</p>}
        {links.map((link) => {
          const other = app.rows.find((row) => row.id === link.id)
          const label = other ? `${TIMELINE_LABELS[other.kind] || other.kind}: ${timelineTitle(other)}` : 'Linked record is not on this device'
          return (
            <p key={link.id}>
              <a href={`#/hse/record/${link.id}`}>{label}</a>
              {' '}
              <button type="button" className="text-btn" onClick={() => removeLink(link.id)}>Unlink</button>
            </p>
          )
        })}
        {others.length > 0 && (
          <div className="admin-inline">
            <select aria-label="Record to link" value={linkId} onChange={(event) => setLinkId(event.target.value)}>
              <option value="">Choose a record</option>
              {others.map((row) => (
                <option key={row.id} value={row.id}>{TIMELINE_LABELS[row.kind] || row.kind}: {timelineTitle(row)}</option>
              ))}
            </select>
            <Button type="button" kind="ghost" onClick={addLink}>Link</Button>
          </div>
        )}
        {record.kind === 'incident' && (
          <>
            <h2>Injury cases</h2>
            <InjuryChips app={app} eventId={record.id} />
            <p className="muted">The daily record shows the case ID. The name stays on the injury case.</p>
            {!caseOpen && <Button type="button" kind="ghost" onClick={() => setCaseOpen(true)}>Open injury case</Button>}
            {caseOpen && (
              <InjuryForm
                initial={{ eventId: record.id, personName: '', bodyPart: '', treatment: '', classification: 'FAI', status: 'open', restrictedFrom: '', rtwOn: '', note: '' }}
                incidents={app.rows.filter((row) => row.kind === 'incident')}
                onSave={async (fields) => { await app.saveInjury(fields); setCaseOpen(false) }}
                onCancel={() => setCaseOpen(false)}
              />
            )}
          </>
        )}
        {record.kind !== 'action' && !raising && (
          <Button type="button" kind="ghost" onClick={() => setRaising(true)}>Raise an action</Button>
        )}
        {raising && (
          <form onSubmit={raiseAction} style={{ marginTop: '0.8rem' }}>
            <Field label="What needs to be done">
              <input value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} />
            </Field>
            <Field label="Owner">
              <input value={actionOwner} onChange={(event) => setActionOwner(event.target.value)} />
            </Field>
            <Field label="Due">
              <input type="date" value={actionDue} onChange={(event) => setActionDue(event.target.value)} />
            </Field>
            <div className="actions">
              <Button type="submit">Save action</Button>
              <Button type="button" kind="ghost" onClick={() => setRaising(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </div>

      {record.kind !== 'scene-check' && record.kind !== 'action' && record.kind !== 'inspection' && !NOTE_KINDS.has(record.kind) && (
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
              <Button type="button" onClick={closeOut} disabled={whysOpen}>Close out</Button>
            </>
          )}
        </div>
      )}

      {error && <p className="note">{error}</p>}
      <div className="actions" style={{ marginTop: 12 }}>
        <Button type="button" kind="ghost" onClick={() => exportRecordPdf(record, app.formsConfig)}>Export PDF</Button>
        <Button type="button" kind="ghost" onClick={() => go('#/hse/register')}>Register</Button>
        <Button type="button" kind="danger" onClick={async () => {
          if (!window.confirm('Delete this record?')) return
          await app.deleteRecord(record.id)
          go('#/hse/register')
        }}>Delete</Button>
      </div>
    </>
  )
}
