import { useState } from 'react'
import { FIVE_WHYS, humanErrorGuard, ICAM_FIELDS } from '../config/severity.js'
import { suggestWhys } from '../lib/ai.js'
import { selectedOwner } from '../lib/actions.js'
import { investigationRows, readInvestigation, signOffError } from '../lib/investigation.js'
import OwnerSelect from './OwnerSelect.jsx'
import { exportInvestigationPdf } from '../lib/pdfExport.js'
import { brandFrom } from '../lib/reportPdf.js'
import { go } from '../lib/routes.js'
import { compressPhoto } from '../../src/utils/storage.js'
import { perthDate } from '../lib/time.js'
import { Button, Field, OfflineBanner } from './ui.jsx'

function asWhy(item) {
  if (item && typeof item === 'object') {
    return { why: item.why || '', evidence: item.evidence || '', deeper: item.deeper || '' }
  }
  return { why: String(item || ''), evidence: '', deeper: '' }
}

export default function Investigate({ app, id }) {
  const record = app.rows.find((row) => row.id === id)
  const saved = record?.fiveWhys || {}
  const [step, setStep] = useState(0)
  const [problem, setProblem] = useState(saved.problem || '')
  const [whys, setWhys] = useState(() => {
    const source = Array.isArray(saved.whys) && saved.whys.length ? saved.whys : ['', '', '', '', '']
    return FIVE_WHYS.map((_, index) => asWhy(source[index]))
  })
  const [rootCause, setRootCause] = useState(saved.rootCause || '')
  const [contributing, setContributing] = useState(saved.contributing || '')
  const [actions, setActions] = useState(saved.actions || '')
  const [hierarchy, setHierarchy] = useState(saved.hierarchy || '')
  const [owner, setOwner] = useState(saved.owner || '')
  const [due, setDue] = useState(saved.due || '')
  const [verification, setVerification] = useState(saved.verification || '')
  const [signOff, setSignOff] = useState(saved.signOff || '')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const savedInvestigation = readInvestigation(record)
  const [investigation, setInvestigation] = useState(savedInvestigation)
  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState('')
  const [when, setWhen] = useState('')
  const [eventText, setEventText] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [actionTitle, setActionTitle] = useState('')
  const [actionOwnerId, setActionOwnerId] = useState('')
  const [actionDue, setActionDue] = useState(perthDate())

  if (!record) return <p className="note">That investigation is not on this device.</p>

  const pack = (patch = {}) => ({
    problem: patch.problem ?? problem,
    whys: patch.whys || whys,
    rootCause: patch.rootCause ?? rootCause,
    contributing: patch.contributing ?? contributing,
    actions: patch.actions ?? actions,
    hierarchy: patch.hierarchy ?? hierarchy,
    owner: patch.owner ?? owner,
    due: patch.due ?? due,
    verification: patch.verification ?? verification,
    signOff: patch.signOff ?? signOff,
  })

  const save = (patch = {}) => {
    const fiveWhys = pack(patch)
    app.updateRecord(record.id, {
      fiveWhys,
      correctiveActions: fiveWhys.actions.trim()
        ? [{ id: 'a1', text: fiveWhys.actions.trim(), ownerRole: fiveWhys.owner || 'Supervisor', due: fiveWhys.due || 'Before next shift', done: false }]
        : record.correctiveActions,
    })
  }

  const draft = async () => {
    if (whys.some((item) => item.why.trim()) && !window.confirm('Replace the answers you have typed?')) return
    setBusy(true)
    setError('')
    try {
      const result = await suggestWhys(record.fields)
      setOffline(result.offline)
      const next = FIVE_WHYS.map((_, index) => asWhy(result.draft?.whys?.[index]))
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

  const setWhy = (index, patch) => setWhys(whys.map((item, i) => i === index ? { ...item, ...patch } : item))

  const nextWhy = () => {
    if (step === 0 && !problem.trim()) {
      setError('Write the problem as what, where, and when. Leave who out of it.')
      return
    }
    if (step > 0 && step < 6) {
      const current = whys[step - 1]
      if (!current.why.trim() || !current.evidence.trim()) {
        setError('Each why needs the cause and the evidence.')
        return
      }
      if (humanErrorGuard(current.why) && !current.deeper.trim()) {
        setError('That why ends at the person. Ask why that was possible, and write it before you move on.')
        return
      }
    }
    setError('')
    save()
    setStep(step + 1)
  }

  const setInvestigationField = (key, value) => {
    const next = { ...investigation, [key]: value }
    setInvestigation(next)
    app.updateRecord(record.id, { investigation: next })
  }

  const addMember = () => {
    if (!memberName.trim() || !memberRole.trim()) { setError('Add the team member’s name and role.'); return }
    setError('')
    const team = [...investigation.team, { name: memberName.trim(), role: memberRole.trim() }]
    setMemberName('')
    setMemberRole('')
    setInvestigationField('team', team)
  }

  const addEvent = () => {
    if (!when.trim() || !eventText.trim()) { setError('Add the time and what happened.'); return }
    setError('')
    const timeline = [...investigation.timeline, { when: when.trim(), event: eventText.trim() }]
    setWhen('')
    setEventText('')
    setInvestigationField('timeline', timeline)
  }

  const addEvidence = () => {
    if (!evidenceNote.trim()) { setError('Write what the evidence shows.'); return }
    setError('')
    const evidence = [...investigation.evidence, { note: evidenceNote.trim() }]
    setEvidenceNote('')
    setInvestigationField('evidence', evidence)
  }

  const addEvidencePhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (investigation.photos.length >= 4) { setError('Four evidence photos is the limit.'); return }
    const photo = await compressPhoto(file)
    setInvestigationField('photos', [...investigation.photos, photo])
  }

  const raiseAction = () => {
    try {
      const person = selectedOwner(app.orgMembers, app.user, actionOwnerId)
      const rows = investigationRows(record, investigation, { title: actionTitle, owner: person?.name || '', ownerId: person?.id || '', due: actionDue })
      app.saveRecords(rows)
      setActionTitle('')
      setError('')
    } catch (err) {
      setError(err.message || 'Could not raise that action.')
    }
  }

  const signInvestigation = () => {
    const problem = signOffError(investigation)
    if (problem) { setError(problem); return }
    setError('')
    app.updateRecord(record.id, { investigation, status: record.status === 'closed' ? record.status : 'hse-review' })
  }

  const guarded = step > 0 && step < 6 && humanErrorGuard(whys[step - 1].why)

  return (
    <div className="split">
      <div>
        <p className="eyebrow">Investigation · driving severity {record.severity} · actual {record.actualSeverity || '—'} · potential {record.potentialSeverity || '—'}</p>
        <h1>Investigation</h1>
        <p className="lede">{record.fields?.description || record.fields?.task || record.fields?.hazards}</p>
        <div className="panel">
          <p className="eyebrow">ICAM</p>
          <h2>Team</h2>
          <p className="muted">Don’t put the injured person’s name here.</p>
          <ul>{investigation.team.map((member, index) => <li key={`${member.name}-${index}`}>{member.name} · {member.role}</li>)}</ul>
          <Field label="Name"><input value={memberName} onChange={(event) => setMemberName(event.target.value)} /></Field>
          <Field label="Role"><input value={memberRole} onChange={(event) => setMemberRole(event.target.value)} /></Field>
          <Button type="button" kind="ghost" onClick={addMember}>Add to team</Button>
          <h2>Sequence of events</h2>
          <ul>{investigation.timeline.map((stepItem, index) => <li key={`${stepItem.when}-${index}`}>{stepItem.when} — {stepItem.event}</li>)}</ul>
          <Field label="When"><input value={when} onChange={(event) => setWhen(event.target.value)} placeholder="06:40" /></Field>
          <Field label="What happened"><input value={eventText} onChange={(event) => setEventText(event.target.value)} /></Field>
          <Button type="button" kind="ghost" onClick={addEvent}>Add to timeline</Button>
          <h2>Evidence</h2>
          <ul>{investigation.evidence.map((entry, index) => <li key={index}>{entry.note}</li>)}</ul>
          <Field label="What it shows"><input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></Field>
          <Button type="button" kind="ghost" onClick={addEvidence}>Add evidence note</Button>
          <Field label="Photo">
            <input type="file" accept="image/*" onChange={addEvidencePhoto} />
          </Field>
          <p className="muted">{investigation.photos.length} photo{investigation.photos.length === 1 ? '' : 's'} on this device.</p>
          <h2>ICAM analysis</h2>
          <Field label="Absent or failed defences"><textarea value={investigation.defences} onChange={(event) => setInvestigationField('defences', event.target.value)} /></Field>
          <Field label="Individual and team actions"><textarea value={investigation.individual} onChange={(event) => setInvestigationField('individual', event.target.value)} /></Field>
          <Field label="Task and environmental conditions"><textarea value={investigation.conditions} onChange={(event) => setInvestigationField('conditions', event.target.value)} /></Field>
          <Field label="Organisational factors"><textarea value={investigation.organisational} onChange={(event) => setInvestigationField('organisational', event.target.value)} /></Field>
          <Field label="Root factors"><textarea value={investigation.root} onChange={(event) => setInvestigationField('root', event.target.value)} /></Field>
          <Field label="Contributing factors"><textarea value={investigation.contributing} onChange={(event) => setInvestigationField('contributing', event.target.value)} /></Field>
          <h2>Corrective action</h2>
          <p className="muted">This opens an action and links it to the incident.</p>
          <Field label="What needs to be done"><input value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} /></Field>
          <Field label="Owner"><OwnerSelect members={app.orgMembers} user={app.user} value={actionOwnerId} onChange={setActionOwnerId} /></Field>
          <Field label="Due"><input type="date" value={actionDue} onChange={(event) => setActionDue(event.target.value)} /></Field>
          <Button type="button" onClick={raiseAction}>Create linked action</Button>
          <h2>Sign-off</h2>
          <Field label="Role"><input value={investigation.signOffRole} onChange={(event) => setInvestigationField('signOffRole', event.target.value)} /></Field>
          <Field label="Name"><input value={investigation.signOffName} onChange={(event) => setInvestigationField('signOffName', event.target.value)} /></Field>
          <Field label="Date"><input type="date" value={investigation.signOffOn} onChange={(event) => setInvestigationField('signOffOn', event.target.value)} /></Field>
          <div className="actions">
            <Button type="button" onClick={signInvestigation}>Sign off</Button>
            <Button type="button" kind="ghost" onClick={() => exportInvestigationPdf({ ...record, investigation }, brandFrom(app.site))}>Export PDF</Button>
          </div>
        </div>
        <h2>Five whys</h2>
        <OfflineBanner show={offline} />
        {step === 0 && (
          <div className="panel">
            <p className="eyebrow">Problem</p>
            <h2>What, where, and when</h2>
            <textarea value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="What happened, where, and when. Not who." />
            <div className="actions" style={{ marginTop: 12 }}>
              <Button type="button" onClick={nextWhy}>First why</Button>
            </div>
          </div>
        )}
        {step > 0 && step < 6 && (
          <div className="panel">
            <p className="eyebrow">Why {step} of 5</p>
            <h2>{FIVE_WHYS[step - 1]}</h2>
            <textarea value={whys[step - 1].why} onChange={(event) => setWhy(step - 1, { why: event.target.value })} />
            <h2>Evidence</h2>
            <textarea value={whys[step - 1].evidence} onChange={(event) => setWhy(step - 1, { evidence: event.target.value })} placeholder="What shows this, without naming an injured person." />
            {guarded && (
              <>
                <p className="note">This why stops at someone not following a rule. Ask why that was possible.</p>
                <textarea value={whys[step - 1].deeper} onChange={(event) => setWhy(step - 1, { deeper: event.target.value })} placeholder="Why was that possible?" />
              </>
            )}
            <div className="actions" style={{ marginTop: 12 }}>
              <Button type="button" kind="ghost" onClick={() => { save(); setStep(step - 1) }}>Back</Button>
              <Button type="button" onClick={nextWhy}>{step === 5 ? 'Root cause' : 'Next why'}</Button>
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="panel">
            <h2>Root cause</h2>
            <textarea value={rootCause} onChange={(event) => setRootCause(event.target.value)} />
            <h2>Contributing factors</h2>
            <textarea value={contributing} onChange={(event) => setContributing(event.target.value)} />
            <h2>Corrective actions</h2>
            <textarea value={actions} onChange={(event) => setActions(event.target.value)} placeholder="The change, in one or two sentences." />
            <label className="field"><span className="field-label">Hierarchy level (r.36)</span><input value={hierarchy} onChange={(event) => setHierarchy(event.target.value)} placeholder="Elimination, substitution, isolation, engineering, administrative, PPE" /></label>
            <label className="field"><span className="field-label">Owner (role)</span><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
            <label className="field"><span className="field-label">Due</span><input value={due} onChange={(event) => setDue(event.target.value)} /></label>
            <h2>Effectiveness check</h2>
            <textarea value={verification} onChange={(event) => setVerification(event.target.value)} placeholder="How will someone check the fix worked?" />
            <label className="field"><span className="field-label">Close-out sign-off (role)</span><input value={signOff} onChange={(event) => setSignOff(event.target.value)} /></label>
            <div className="actions" style={{ marginTop: 12 }}>
              <Button type="button" kind="ghost" onClick={() => setStep(5)}>Back</Button>
              <Button type="button" onClick={() => { save(); go(`#/hse/record/${record.id}`) }}>Save investigation</Button>
            </div>
          </div>
        )}
        {error && <p className="note">{error}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <Button type="button" kind="ghost" disabled={busy} onClick={draft}>{busy ? 'Drafting…' : 'Draft with Grok'}</Button>
        </div>
      </div>
      <aside className="panel">
        <p className="eyebrow">{record.icam ? 'ICAM required' : 'ICAM'}</p>
        <ul>{ICAM_FIELDS.map((item) => <li key={item}>{item}</li>)}</ul>
      </aside>
    </div>
  )
}
