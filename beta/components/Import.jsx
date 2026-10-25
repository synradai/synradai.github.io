import { useEffect, useMemo, useState } from 'react'
import { errorReportCsv, guessMap, IMPORT_TARGETS, missingMapped, parseCsv, planImport, tableFromAirtable } from '../lib/import.js'
import { getAccessToken, supabaseKey, supabaseUrl } from '../lib/supabase.js'
import { Button, Field } from './ui.jsx'

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

export default function Import({ app }) {
  const [target, setTarget] = useState('training')
  const [source, setSource] = useState('csv')
  const [headers, setHeaders] = useState([])
  const [dataRows, setDataRows] = useState([])
  const [map, setMap] = useState({})
  const [token, setToken] = useState('')
  const [baseId, setBaseId] = useState('')
  const [tables, setTables] = useState([])
  const [tableName, setTableName] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const signedIn = Boolean(app.backend && app.user && !app.user.local)
  const siteName = app.site.siteName || 'Main site'
  const fields = IMPORT_TARGETS[target].fields

  useEffect(() => () => setToken(''), [])

  useEffect(() => {
    if (headers.length) setMap(guessMap(headers, target))
  }, [target, headers])

  const planned = useMemo(() => (
    headers.length
      ? planImport({
        target,
        headers,
        rows: dataRows,
        map,
        siteName,
        siteId: app.site.activeSiteId || '',
        ruleset: app.site.ruleset || 'general',
      })
      : []
  ), [target, headers, dataRows, map, siteName, app.site.activeSiteId, app.site.ruleset])

  const unmapped = missingMapped(target, map)
  const ready = planned.filter((row) => !row.error)
  const failed = planned.filter((row) => row.error)

  const useTable = (nextHeaders, nextRows) => {
    setHeaders(nextHeaders)
    setDataRows(nextRows)
    setMap(guessMap(nextHeaders, target))
    setResult('')
  }

  const onFile = async (file) => {
    if (!file) return
    const parsed = parseCsv(await file.text())
    if (!parsed.headers.length) {
      setNote('That file has no header row.')
      setHeaders([])
      setDataRows([])
      return
    }
    setNote(parsed.rows.length ? '' : 'That file has no data rows.')
    setTruncated(false)
    useTable(parsed.headers, parsed.rows)
  }

  const callAirtable = async (body) => {
    const access = await getAccessToken()
    const response = await fetch(`${supabaseUrl}/functions/v1/airtable-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access}`,
        ...(supabaseKey ? { apikey: supabaseKey } : {}),
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Airtable import failed.')
    return data
  }

  const loadTables = async () => {
    setBusy(true)
    setNote('')
    try {
      const data = await callAirtable({ token, baseId })
      const next = data.tables || []
      setTables(next)
      setTableName(next[0]?.name || '')
      if (!next.length) setNote('That base has no tables.')
    } catch (error) {
      setNote(error.message || 'Could not read that base.')
    } finally {
      setBusy(false)
    }
  }

  const loadRows = async () => {
    setBusy(true)
    setNote('')
    try {
      const data = await callAirtable({ token, baseId, tableName })
      const table = tableFromAirtable(data)
      setTruncated(Boolean(data.truncated))
      useTable(table.headers, table.rows)
      if (!table.rows.length) setNote('That table has no rows.')
      else if (data.truncated) setNote('Airtable returned the first 300 rows. This is a one-off copy, not a live sync.')
    } catch (error) {
      setNote(error.message || 'Could not read that table.')
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    setBusy(true)
    setNote('')
    try {
      await app.commitImport({
        records: ready.map((row) => row.record).filter(Boolean),
        people: ready.map((row) => row.person).filter(Boolean),
      })
      setResult(`Imported ${ready.length}. ${failed.length} row${failed.length === 1 ? '' : 's'} failed.`)
      setToken('')
    } catch (error) {
      setNote(error.message || 'Could not import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="eyebrow">Import</p>
      <h1>Bring records into {siteName}</h1>
      <p className="lede">CSV import copies rows into this site. An Airtable import is a one-off copy. It does not keep syncing. The token is sent once to import a copy. It is not saved.</p>
      {note && <p className="note">{note}</p>}
      {result && <p className="note">{result}</p>}
      <div className="panel">
        <Field label="Import into">
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {Object.entries(IMPORT_TARGETS).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </select>
        </Field>
        <div className="actions">
          <Button type="button" kind={source === 'csv' ? 'primary' : 'ghost'} onClick={() => setSource('csv')}>CSV file</Button>
          <Button type="button" kind={source === 'airtable' ? 'primary' : 'ghost'} onClick={() => setSource('airtable')}>Airtable copy</Button>
        </div>
        {source === 'csv' ? (
          <Field label="CSV file" hint="The first row is the header. You map columns next.">
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onFile(file)
              }}
            />
          </Field>
        ) : signedIn ? (
          <>
            <Field label="Airtable personal access token" hint="Used once for this copy. It is not saved on this device or in the database.">
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </Field>
            <Field label="Base ID" hint="Starts with app. The token needs access to that base.">
              <input value={baseId} autoComplete="off" onChange={(event) => setBaseId(event.target.value)} placeholder="app…" />
            </Field>
            <Button type="button" disabled={busy || !token || !baseId} onClick={loadTables}>Load tables</Button>
            {tables.length > 0 && (
              <>
                <Field label="Table">
                  <select value={tableName} onChange={(event) => setTableName(event.target.value)}>
                    {tables.map((table) => (
                      <option key={table.id || table.name} value={table.name}>{table.name}</option>
                    ))}
                  </select>
                </Field>
                <Button type="button" disabled={busy || !tableName} onClick={loadRows}>Load rows</Button>
              </>
            )}
            {token && <Button type="button" kind="ghost" onClick={() => setToken('')}>Clear token</Button>}
          </>
        ) : (
          <p className="muted">Sign in to the beta to import from Airtable. CSV import works on this device.</p>
        )}
      </div>
      {headers.length > 0 && (
        <div className="panel">
          <h2>Map columns</h2>
          <div className="import-map">
            {fields.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                <select
                  aria-label={field.label}
                  value={map[field.key] ?? ''}
                  onChange={(event) => setMap({ ...map, [field.key]: event.target.value === '' ? '' : Number(event.target.value) })}
                >
                  <option value="">Skip</option>
                  {headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          {unmapped.length > 0 && <p className="note">Map {unmapped.join(', ')} before importing.</p>}
          {truncated && <p className="muted">Showing the first 300 Airtable rows.</p>}
          <h2>Preview</h2>
          <div className="import-preview">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  {fields.map((field) => <th key={field.key}>{field.label}</th>)}
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {planned.slice(0, 20).map((row) => (
                  <tr key={row.index}>
                    <td>{row.index}</td>
                    {fields.map((field) => <td key={field.key}>{row.fields[field.key] || '—'}</td>)}
                    <td className={row.error ? 'row-error' : ''}>{row.error || 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {planned.length > 20 && <p className="muted">Previewing 20 of {planned.length} rows. Import uses every row.</p>}
          <div className="actions">
            <Button type="button" disabled={busy || !ready.length || unmapped.length > 0} onClick={runImport}>
              Import {ready.length} row{ready.length === 1 ? '' : 's'}
            </Button>
            {failed.length > 0 && (
              <Button type="button" kind="ghost" onClick={() => download('import-errors.csv', errorReportCsv(headers, planned))}>
                Download error report
              </Button>
            )}
          </div>
        </div>
      )}
      {target === 'people' && (
        <div className="panel">
          <h2>People at {siteName}</h2>
          {app.people?.length ? (
            <ul>
              {app.people.map((person) => (
                <li key={person.id}>{person.fullName}{person.role ? ` · ${person.role}` : ''}</li>
              ))}
            </ul>
          ) : <p className="muted">No people at this site yet.</p>}
        </div>
      )}
    </>
  )
}
