import { useState } from 'react'
import { selectedOwner } from '../lib/actions.js'
import { blankChecks, fileInspection, inspectionError } from '../lib/inspections.js'
import { perthDate, perthDateTimeLocal } from '../lib/time.js'
import OwnerSelect from './OwnerSelect.jsx'
import { Button, Field } from './ui.jsx'

const RESULT_LABEL = { pass: 'Pass', fail: 'Fail', na: 'N/A' }

export default function Inspections({ app }) {
  const templates = app.inspectionTemplates || []
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const template = templates.find((item) => item.id === templateId) || templates[0]
  const [checks, setChecks] = useState(() => blankChecks(template))
  const [ownerId, setOwnerId] = useState('')
  const [due, setDue] = useState(() => perthDate())
  const [error, setError] = useState('')

  const choose = (id) => {
    const next = templates.find((item) => item.id === id)
    setTemplateId(id)
    setChecks(blankChecks(next))
    setError('')
  }

  const mark = (itemId, result) => {
    setChecks((prev) => prev.map((check) => check.id === itemId ? { ...check, result } : check))
  }

  const note = (itemId, value) => {
    setChecks((prev) => prev.map((check) => check.id === itemId ? { ...check, note: value } : check))
  }

  const save = (event) => {
    event.preventDefault()
    const person = selectedOwner(app.orgMembers, app.user, ownerId)
    const fields = {
      templateId: template?.id || '',
      title: template?.name || 'Inspection',
      siteArea: app.site.siteName || '',
      owner: person?.name || '',
      ownerId: person?.id || '',
      due,
      occurredAt: perthDateTimeLocal().slice(0, 16),
    }
    const problem = inspectionError(fields, checks)
    if (problem) { setError(problem); return }
    const rows = fileInspection({ ruleset: app.site.ruleset || 'general', fields, checks })
    app.saveRecords(rows)
    setChecks(blankChecks(template))
    setError('')
  }

  const filed = app.rows.filter((row) => row.kind === 'inspection')

  return (
    <>
      <p className="eyebrow">Inspections</p>
      <h1>File an inspection</h1>
      <p className="lede">Mark each item pass, fail, or N/A. A failed item opens an action with the owner and due date below.</p>
      <form className="panel" onSubmit={save}>
        <Field label="Checklist">
          <select value={template?.id || ''} onChange={(event) => choose(event.target.value)}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        {checks.map((check) => (
          <div key={check.id} style={{ marginTop: '0.8rem' }}>
            <p><strong>{check.label}</strong></p>
            <div className="chip-row" aria-label={check.label}>
              {['pass', 'fail', 'na'].map((result) => (
                <button key={result} type="button" className={`chip${check.result === result ? ' active' : ''}`} onClick={() => mark(check.id, result)}>
                  {RESULT_LABEL[result]}
                </button>
              ))}
            </div>
            {check.result === 'fail' && (
              <Field label="What failed" hint="Optional. This note goes on the action.">
                <input value={check.note} onChange={(event) => note(check.id, event.target.value)} />
              </Field>
            )}
          </div>
        ))}
        <Field label="Owner for failed items">
          <OwnerSelect members={app.orgMembers} user={app.user} value={ownerId} onChange={setOwnerId} />
        </Field>
        <Field label="Due date for failed items">
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </Field>
        {error && <p className="note">{error}</p>}
        <Button type="submit">File inspection</Button>
      </form>
      <h2 style={{ marginTop: '1.2rem' }}>Filed</h2>
      {filed.length === 0 && <p className="muted">No inspections filed yet.</p>}
      <div className="grid">
        {filed.map((row) => (
          <a className="card record" href={`#/hse/record/${row.id}`} key={row.id}>
            <span className={`tag ${row.status === 'open' ? 'preview' : 'live'}`}>{row.fields?.note || row.status}</span>
            <strong>{row.fields?.title || 'Inspection'}</strong>
            <span>{row.fields?.siteArea || 'Site'} · {(row.checks || []).length} items</span>
          </a>
        ))}
      </div>
    </>
  )
}
