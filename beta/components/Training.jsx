import { useState } from 'react'
import { buildTrainingRecord, matrixRows, trainingError, trainingState } from '../lib/training.js'
import { perthDate } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

const STATE_LABEL = { current: 'Current', expiring: 'Expiring', expired: 'Expired' }

export default function Training({ app }) {
  const today = perthDate()
  const columns = app.trainingMatrix?.columns || []
  const [person, setPerson] = useState('')
  const [role, setRole] = useState('')
  const [course, setCourse] = useState(columns[0] || '')
  const [other, setOther] = useState('')
  const [completed, setCompleted] = useState(today)
  const [expiry, setExpiry] = useState('')
  const [error, setError] = useState('')
  const chosen = course === '__other' ? other : course
  const records = app.rows.filter((row) => row.kind === 'training')
  const grid = matrixRows(app.rows, columns, today)

  const save = (event) => {
    event.preventDefault()
    const fields = { person, role, course: chosen, completed, expiry }
    const problem = trainingError(fields)
    if (problem) { setError(problem); return }
    app.addRecord(buildTrainingRecord({ ruleset: app.site.ruleset || 'general', fields }))
    setPerson('')
    setExpiry('')
    setError('')
  }

  return (
    <>
      <p className="eyebrow">Training</p>
      <h1>Tickets and matrix</h1>
      <p className="lede">Record who holds a course, and when it expires. The matrix is roles against the required courses. A gap means nobody current in that role holds it.</p>
      <form className="panel" onSubmit={save}>
        <Field label="Person">
          <input value={person} onChange={(event) => setPerson(event.target.value)} />
        </Field>
        <Field label="Role">
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Fitter" />
        </Field>
        <Field label="Course or ticket">
          <select value={course} onChange={(event) => setCourse(event.target.value)}>
            {columns.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="__other">Other</option>
          </select>
        </Field>
        {course === '__other' && (
          <Field label="Other course">
            <input value={other} onChange={(event) => setOther(event.target.value)} />
          </Field>
        )}
        <Field label="Completed">
          <input type="date" value={completed} onChange={(event) => setCompleted(event.target.value)} />
        </Field>
        <Field label="Expiry" hint="Leave blank if the ticket does not expire. Expiring means within 30 days.">
          <input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
        </Field>
        {error && <p className="note">{error}</p>}
        <Button type="submit">Save training</Button>
      </form>
      <h2 style={{ marginTop: '1.2rem' }}>Roles by training</h2>
      {grid.length === 0 && <p className="muted">Add a training record to fill the matrix.</p>}
      {grid.length > 0 && (
        <div className="matrix">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                {columns.map((item) => <th key={item}>{item}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => (
                <tr key={row.role}>
                  <th>{row.role}</th>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]} className={cell === 'covered' ? '' : 'gap'}>{cell === 'covered' ? 'Covered' : cell === 'expiring' ? 'Expiring' : 'Gap'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 style={{ marginTop: '1.2rem' }}>Records</h2>
      {records.length === 0 && <p className="muted">No training records yet.</p>}
      <div className="grid">
        {records.map((row) => {
          const state = trainingState(row, today)
          return (
            <a className="card record" href={`#/hse/record/${row.id}`} key={row.id}>
              <span className={`tag ${state === 'current' ? 'live' : 'preview'}`}>{STATE_LABEL[state]}</span>
              <strong>{row.fields?.person} · {row.fields?.course}</strong>
              <span>{row.fields?.role}{row.fields?.expiry ? ` · expires ${row.fields.expiry}` : ' · no expiry'}</span>
            </a>
          )
        })}
      </div>
    </>
  )
}
