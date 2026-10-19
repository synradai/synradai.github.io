import { useState } from 'react'
import { FIVE_WHYS } from '../config/severity.js'
import { suggestWhys } from '../lib/ai.js'
import { go } from '../lib/routes.js'
import { Button, OfflineBanner } from './ui.jsx'

export default function Investigate({ app, id }) {
  const record = app.rows.find((row) => row.id === id)
  const [step, setStep] = useState(0)
  const [whys, setWhys] = useState(record?.fiveWhys?.whys || ['', '', '', '', ''])
  const [rootCause, setRootCause] = useState(record?.fiveWhys?.rootCause || '')
  const [actions, setActions] = useState(record?.fiveWhys?.actions || '')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')

  if (!record) return <p className="note">That investigation is not on this device.</p>

  const save = (patch = {}) => {
    const nextWhys = patch.whys || whys
    const nextRoot = patch.rootCause ?? rootCause
    const nextActions = patch.actions ?? actions
    app.updateRecord(record.id, {
      fiveWhys: { whys: nextWhys, rootCause: nextRoot, actions: nextActions },
      status: nextRoot.trim() ? 'open' : 'investigation',
      correctiveActions: nextActions.trim()
        ? [{ id: 'a1', text: nextActions.trim(), ownerRole: 'Supervisor', due: 'Before next shift', done: false }]
        : record.correctiveActions,
    })
  }

  const draft = async () => {
    if (whys.some((why) => why.trim()) && !window.confirm('Replace the answers you have typed?')) return
    setBusy(true)
    setError('')
    try {
      const result = await suggestWhys(record.fields)
      setOffline(result.offline)
      const next = result.draft?.whys?.length === 5 ? result.draft.whys : whys
      setWhys(next)
      setRootCause(result.draft?.rootCause || '')
      setActions(result.draft?.actions || '')
      save({ whys: next, rootCause: result.draft?.rootCause || '', actions: result.draft?.actions || '' })
    } catch (err) {
      setError(err.message || 'Could not draft the whys.')
    } finally {
      setBusy(false)
    }
  }

  const onWhy = (index) => (step === 5 ? null : index)

  return (
    <div className="split">
      <div>
        <p className="eyebrow">Investigation · severity {record.severity}</p>
        <h1>Five whys</h1>
        <p className="lede">{record.fields?.description || record.fields?.task || record.fields?.hazards}</p>
        <OfflineBanner show={offline} />
        <div className="stepper" aria-hidden="true">
          {FIVE_WHYS.map((_, index) => <div key={index} className={`dot${index <= step ? ' on' : ''}`} />)}
        </div>
        {step < 5 ? (
          <div className="panel">
            <p className="eyebrow">Why {step + 1} of 5</p>
            <h2>{FIVE_WHYS[step]}</h2>
            <textarea value={whys[step]} onChange={(event) => setWhys(whys.map((why, index) => index === step ? event.target.value : why))} />
            <div className="actions" style={{ marginTop: 12 }}>
              {step > 0 && <Button type="button" kind="ghost" onClick={() => { save(); setStep(step - 1) }}>Back</Button>}
              <Button type="button" onClick={() => { save(); setStep(step + 1) }}>{step === 4 ? 'Root cause' : 'Next why'}</Button>
            </div>
          </div>
        ) : (
          <div className="panel">
            <h2>Root cause</h2>
            <textarea value={rootCause} onChange={(event) => setRootCause(event.target.value)} placeholder="The last why, in one or two sentences." />
            <h2>Actions from the investigation</h2>
            <textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="What changes, and which role owns it." />
            <div className="actions" style={{ marginTop: 12 }}>
              <Button type="button" kind="ghost" onClick={() => setStep(4)}>Back</Button>
              <Button type="button" onClick={() => { save(); go(`#/hse/record/${record.id}`) }}>Save investigation</Button>
            </div>
          </div>
        )}
        {error && <p className="note">{error}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <Button type="button" kind="ghost" disabled={busy} onClick={draft}>{busy ? 'Drafting…' : 'Draft with Grok'}</Button>
        </div>
        {onWhy(0) !== null && whys.some((why) => why) && step > 0 && (
          <ul className="muted">
            {whys.slice(0, step).map((why, index) => <li key={index}>{why || '—'}</li>)}
          </ul>
        )}
      </div>
      <aside className="panel">
        <p className="eyebrow">Placeholder</p>
        <h2>ICAM</h2>
        <p className="muted">The ICAM chart — people, environment, equipment, procedures, organisation — is a later beta. Use the five whys on this screen for now. It does not replace a formal ICAM if the site requires one.</p>
      </aside>
    </div>
  )
}
