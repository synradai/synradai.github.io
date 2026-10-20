import { useState } from 'react'
import { reportingFor } from '../config/regulations.js'
import { flagNotifiable, lodgementError, notifiableChecklist, readLodgement } from '../lib/notifiable.js'
import { perthDate } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

export default function Reporting({ ruleset, forced, record, onSave }) {
  const flow = reportingFor(ruleset || 'general')
  const lodged = record ? readLodgement(record) : null
  const [draft, setDraft] = useState(() => lodged || { reference: '', lodgedOn: '', lodgedBy: '' })
  const [error, setError] = useState('')
  const checklist = record?.notifiable && lodged ? notifiableChecklist(record, lodged, perthDate()) : []

  const saveCheck = (patch) => {
    if (!onSave || !lodged) return
    onSave({ lodgement: { ...lodged, ...patch } })
  }

  const saveLodgement = () => {
    const next = {
      ...lodged,
      reference: draft.reference.trim(),
      lodgedOn: draft.lodgedOn,
      lodgedBy: draft.lodgedBy.trim(),
    }
    const problem = lodgementError(next)
    if (problem) { setError(problem); return }
    setError('')
    onSave({ lodgement: next })
  }

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <p className="eyebrow">{flow.name} · {flow.within}</p>
      <h2>{forced || record?.notifiable ? 'WorkSafe flow' : 'Notifiable check'}</h2>
      <p className="lede">Possible breach, verify. This app does not notify {flow.name}.</p>
      <ul>
        {flow.steps.map((step) => <li key={step}>{step}</li>)}
      </ul>
      {flow.unverified.map((note) => <p className="note" key={note}>{note}</p>)}
      {record && (
        <>
          <p><a href={flow.lodgeUrl} target="_blank" rel="noreferrer">Open WorkSafe’s page to lodge it yourself</a></p>
          {!record.notifiable && (
            <Button type="button" onClick={() => onSave(flagNotifiable(record))}>Flag as notifiable</Button>
          )}
          {record.notifiable && (
            <>
              <h2>Checklist and deadlines</h2>
              <p className="muted">Keep the record for 5 years (s.38).</p>
              {checklist.map((item) => (
                <p key={item.id}>
                  <button type="button" className={`chip${item.done ? ' active' : ''}`} onClick={() => saveCheck({ [item.id]: !item.done })}>
                    {item.done ? 'Done' : 'Open'}
                  </button>
                  {' '}{item.label}. {item.deadline}{item.overdue ? ' Overdue.' : ''}
                </p>
              ))}
              <div className="chip-row">
                <button type="button" className={`chip${lodged.writtenRequested ? ' active' : ''}`} onClick={() => saveCheck({ writtenRequested: !lodged.writtenRequested })}>
                  WorkSafe asked for written notice
                </button>
                <button type="button" className={`chip${lodged.dangerousGoods ? ' active' : ''}`} onClick={() => saveCheck({ dangerousGoods: !lodged.dangerousGoods })}>
                  Dangerous goods involved
                </button>
              </div>
              <h2>Lodgement</h2>
              <p className="muted">Record the reference after you lodge it. This app does not send it.</p>
              <Field label="Reference number">
                <input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} />
              </Field>
              <Field label="Date lodged">
                <input type="date" value={draft.lodgedOn} onChange={(event) => setDraft({ ...draft, lodgedOn: event.target.value })} />
              </Field>
              <Field label="Who lodged it" hint="Not the injured person’s name.">
                <input value={draft.lodgedBy} onChange={(event) => setDraft({ ...draft, lodgedBy: event.target.value })} />
              </Field>
              {error && <p className="note">{error}</p>}
              <Button type="button" onClick={saveLodgement}>Save lodgement</Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
