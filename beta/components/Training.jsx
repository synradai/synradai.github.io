import { useState } from 'react'
import { buildTrainingRecord, matrixRows, personMatrix, personMatrixCsv, trainingError, trainingFilters, trainingState } from '../lib/training.js'
import { perthDate } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

const STATE_LABEL = { current: 'Current', expiring: 'Expiring', expired: 'Expired', missing: 'Missing' }

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function Training({ app }) {
  const today = perthDate()
  const columns = app.trainingMatrix?.columns || []
  const [person, setPerson] = useState('')
  const [role, setRole] = useState('')
  const [siteArea, setSiteArea] = useState(app.site.siteName || '')
  const [course, setCourse] = useState(columns[0] || '')
  const [other, setOther] = useState('')
  const [completed, setCompleted] = useState(today)
  const [expiry, setExpiry] = useState('')
  const [error, setError] = useState('')
  const [exportNote, setExportNote] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const chosen = course === '__other' ? other : course
  const records = app.rows.filter((row) => row.kind === 'training')
  const filters = trainingFilters(records)
  const grid = matrixRows(app.rows, columns, today)
  const people = personMatrix(app.rows, columns, today, { site: siteFilter, role: roleFilter })

  const save = (event) => {
    event.preventDefault()
    const fields = { person, role, course: chosen, completed, expiry, siteArea }
    const problem = trainingError(fields)
    if (problem) { setError(problem); return }
    app.addRecord(buildTrainingRecord({ ruleset: app.site.ruleset || 'general', fields }))
    setPerson('')
    setExpiry('')
    setError('')
  }

  const exportCsv = async () => {
    setExportNote('')
    try {
      await app.logExport({
        entity: 'training_matrix',
        entityId: 'people',
        summary: 'Exported the people training matrix',
        detail: { site: siteFilter || 'all', role: roleFilter || 'all', people: people.length, format: 'csv' },
      })
    } catch (err) {
      setExportNote(err.message || 'The export was not written to the audit trail.')
    }
    download('people-training-matrix.csv', personMatrixCsv(people, columns))
  }

  return (
    <>
      <p className="eyebrow">Training</p>
      <h1>Tickets and matrix</h1>
      <p className="lede">Each person is listed against the required courses: current, expiring within 30 days, expired, or missing. Filter by site and role. A cell with a record opens it.</p>
      <form className="panel" onSubmit={save}>
        <Field label="Person">
          <input value={person} onChange={(event) => setPerson(event.target.value)} />
        </Field>
        <Field label="Role">
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Fitter" />
        </Field>
        <Field label="Site" hint="Saved on the training record so the matrix can filter by site.">
          <input value={siteArea} onChange={(event) => setSiteArea(event.target.value)} />
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
      <h2 style={{ marginTop: '1.2rem' }}>People by training</h2>
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <Field label="Site">
          <select aria-label="Filter by site" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
            <option value="">All sites</option>
            {filters.sites.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Role">
          <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {filters.roles.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
      </form>
      <div className="actions">
        <Button type="button" kind="ghost" onClick={exportCsv}>Export CSV</Button>
      </div>
      {exportNote && <p className="note">{exportNote}</p>}
      {people.length === 0 && <p className="muted">No people match this site and role. Add a training record to fill the matrix.</p>}
      {people.length > 0 && (
        <div className="matrix">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                {columns.map((item) => <th key={item}>{item}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map((row) => (
                <tr key={row.person}>
                  <th>{row.person}</th>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]} className={cell.state}>
                      {cell.id
                        ? <a href={`#/hse/record/${cell.id}`}>{STATE_LABEL[cell.state]}</a>
                        : STATE_LABEL[cell.state]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
