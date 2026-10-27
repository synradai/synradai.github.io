import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { parseCsv } from '../lib/import.js'
import {
  FIELD_TYPES,
  applyView,
  choiceList,
  findBase,
  findTable,
  formsLibrary,
  newId,
  openedAgo,
  rowTint,
  sortBases,
  valuesFromHeaderRow,
  visibleFields,
} from '../lib/registers.js'
import { exampleCount } from '../lib/phaseOne.js'
import { quarterTag, registerStats, rowUse, tableCheck } from '../lib/tagging.js'
import { go } from '../lib/routes.js'
import { Button, Field } from './ui.jsx'

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that photo.'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, 480 / Math.max(img.width, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.72) })
      }
      img.onerror = () => resolve({ name: file.name, dataUrl: String(reader.result || '') })
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

function choiceFor(field, value) {
  return (field?.options || []).find((item) => item.label === value || item.id === value)
}

function chipInk(color) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color) : '#2458a8'
  const n = parseInt(hex.slice(1), 16)
  const channel = (shift) => {
    const value = ((n >> shift) & 255) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
  return (1.05 / (lum + 0.05)) >= 4.5 ? '#ffffff' : '#141414'
}

function Pill({ field, value }) {
  const choice = choiceFor(field, value)
  const color = choice?.color || '#2458a8'
  return <span className="reg-chip" style={{ background: color, color: chipInk(color) }}>{choice?.label || value}</span>
}

function plainValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (value && typeof value === 'object') return ''
  return value == null ? '' : String(value)
}

function briefValue(field, value) {
  if (field.type === 'attachment') {
    const count = Array.isArray(value) ? value.length : 0
    return count ? `${count} photo${count === 1 ? '' : 's'}` : ''
  }
  if (field.type === 'qr') return value ? 'QR' : ''
  return plainValue(value)
}

function QrThumb({ link }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancel = false
    if (!link) return undefined
    QRCode.toDataURL(link, { margin: 0, width: 72, color: { dark: '#07101f', light: '#ffffff' } })
      .then((url) => { if (!cancel) setSrc(url) })
      .catch(() => {})
    return () => { cancel = true }
  }, [link])
  if (!src) return <span className="muted">QR</span>
  return <img className="reg-qr" src={src} alt="" />
}

function Cell({ field, value, row }) {
  if (field.type === 'single_select') return value ? <Pill field={field} value={value} /> : null
  if (field.type === 'multi_select') {
    const items = Array.isArray(value) ? value : []
    if (!items.length) return null
    return <span className="reg-chips">{items.map((item) => <Pill key={item} field={field} value={item} />)}</span>
  }
  if (field.type === 'checkbox') {
    if (value === true) return <span className="reg-chip" style={{ background: '#1f8a4c', color: '#ffffff' }}>Yes</span>
    if (value === false) return <span className="reg-chip" style={{ background: '#2a3140', color: '#ffffff' }}>No</span>
    return null
  }
  if (field.type === 'attachment') {
    const photos = Array.isArray(value) ? value : []
    if (!photos.length) return null
    return (
      <span className="reg-photos">
        {photos.map((photo) => <img key={photo.dataUrl || photo.name} src={photo.dataUrl} alt="" />)}
      </span>
    )
  }
  if (field.type === 'url' && value) {
    return <a href={value} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{value}</a>
  }
  if (field.type === 'qr') return <span onClick={(event) => event.stopPropagation()}><QrThumb link={row.values?.link || value} /></span>
  if (field.type === 'number') return value === '' || value == null || Number.isNaN(value) ? null : <span className="reg-num">{value}</span>
  return value ? <span>{value}</span> : null
}

function useBases(app) {
  const stored = app.bases || []
  return useMemo(() => sortBases([...stored, formsLibrary(app.qrCodes)]), [stored, app.qrCodes])
}

function kindLabel(kind) {
  if (kind === 'gear') return 'Gear'
  if (kind === 'plant') return 'Owned plant'
  if (kind === 'hire') return 'Hired'
  if (kind === 'out_of_service') return 'Out of service'
  if (kind === 'forms') return 'Forms'
  return 'Register'
}

function RegisterCard({ base, app }) {
  const stats = registerStats(base)
  return (
    <article className={`reg-card${base.kind === 'out_of_service' ? ' hazard' : ''}`}>
      <button
        type="button"
        className={`base-star${base.starred ? ' on' : ''}`}
        aria-label={base.starred ? 'Unstar' : 'Star'}
        disabled={base.virtual}
        onClick={() => app.starBase(base.id)}
      >
        {base.starred ? '★' : '☆'}
      </button>
      <a href={`#/registers/${base.id}`} aria-label={`${base.name}, ${stats.total} total, ${stats.locked} locked out, ${stats.dueSoon} due soon`}>
        <span className="reg-card-kicker">{kindLabel(base.kind)}</span>
        <strong>{base.name}</strong>
        <span className="reg-counts">
          <span><b>{stats.total}</b> total</span>
          <span><b>{stats.locked}</b> locked out</span>
          <span><b>{stats.dueSoon}</b> due soon</span>
        </span>
        <span className="reg-card-meta">{openedAgo(base.openedAt)}</span>
      </a>
    </article>
  )
}

export function RegistersHome({ app }) {
  const bases = useBases(app)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [clearing, setClearing] = useState(false)
  const title = app.site?.orgName || 'Registers'
  const due = quarterTag(new Date())
  const examples = exampleCount(app.bases)
  const starred = bases.filter((item) => item.starred)
  const sections = [
    ['Gear', bases.filter((item) => item.kind === 'gear')],
    ['Owned plant', bases.filter((item) => item.kind === 'plant')],
    ['Hired and client-owned', bases.filter((item) => item.kind === 'hire')],
    ['Out of service', bases.filter((item) => item.kind === 'out_of_service')],
    ['Other registers', bases.filter((item) => !item.virtual && (!item.kind || item.kind === 'base'))],
    ['Forms', bases.filter((item) => item.virtual || item.kind === 'forms')],
  ].filter(([, items]) => items.length)

  const create = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const id = await app.createBase(name)
      setName('')
      setCreating(false)
      go(`#/registers/${id}`)
    } catch (err) {
      setError(err.message || 'Could not create that register.')
    }
  }

  const clearExamples = async () => {
    setClearing(true)
    setError('')
    try {
      await app.clearExampleRows()
    } catch (err) {
      setError(err.message || 'Could not clear the example rows.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="reg-home">
      <div className="reg-home-head">
        <div>
          <p className="eyebrow">Registers</p>
          <h1>{title}</h1>
        </div>
        <Button type="button" onClick={() => setCreating((value) => !value)}>Create</Button>
      </div>
      <p className="lede">Each card is a company register. The counts are total rows, locked out, and due soon. Due soon means a service inside 30 days or already overdue, a hire ending inside 14 days, or a tag whose quarter ends inside 14 days.</p>
      <p className="quarter-banner"><span className="swatch" style={{ background: due.color }} />Due this quarter: {due.label} ({due.season}). Gear with another colour, or a tag from before this quarter, is locked out.</p>
      {examples > 0 && (
        <p className="example-banner">
          Sample rows are marked Example and can be cleared in one click.
          <Button type="button" kind="ghost" onClick={clearExamples} disabled={clearing}>{clearing ? 'Clearing…' : 'Clear example data'}</Button>
        </p>
      )}
      {app.basesNote && <p className="note">{app.basesNote}</p>}
      {error && <p className="note">{error}</p>}
      {creating && (
        <form className="panel" onSubmit={create}>
          <Field label="Register name">
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Plant register" />
          </Field>
          <Button type="submit">Create register</Button>
        </form>
      )}
      {!app.basesReady && <p className="muted">Opening registers…</p>}
      {starred.length > 0 && (
        <>
          <h2>Starred</h2>
          <div className="base-grid">
            {starred.map((base) => <RegisterCard key={`star-${base.id}`} base={base} app={app} />)}
          </div>
        </>
      )}
      {sections.map(([heading, items]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <div className="base-grid">
            {items.map((base) => <RegisterCard key={base.id} base={base} app={app} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function CheckPill({ check }) {
  if (!check) return null
  const colour = check.state === 'in_date' ? check.due?.color : ''
  const style = colour ? { background: colour, color: chipInk(colour) } : undefined
  return <span className={`reg-chip status ${check.tone}`} style={style}>{check.label}</span>
}

function DataRows({ rows, fields, table, rowColor, baseId, showUse, now }) {
  return rows.map((item) => {
    const check = showUse ? rowUse(table, item.values, now) : null
    return (
      <tr
        key={item.id}
        className={`${check?.state === 'locked' || check?.state === 'due' ? 'is-locked' : ''}${item.values?._example ? ' is-example' : ''}`}
        style={{ background: rowTint(table, rowColor, item.values) }}
        onClick={() => go(`#/registers/${baseId}/${table.id}/${item.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') go(`#/registers/${baseId}/${table.id}/${item.id}`)
        }}
        tabIndex={0}
      >
        {showUse && (
          <td className="check-cell">
            <CheckPill check={check} />
            {item.values?._example && <span className="reg-chip example">Example</span>}
          </td>
        )}
        {fields.map((field, fieldIndex) => (
          <td key={field.id} className={fieldIndex === 0 ? 'lead' : ''}>
            <Cell field={field} value={item.values?.[field.id]} row={item} />
          </td>
        ))}
        {fields.length === 0 && <td />}
      </tr>
    )
  })
}

function leafCount(group) {
  if (group.children?.length) return group.children.reduce((sum, child) => sum + leafCount(child), 0)
  return group.rows?.length || 0
}

function GroupBlocks({ groups, depth, fields, table, rowColor, baseId, showUse, now }) {
  return groups.map((group) => (
    <GroupBlock key={group.key} group={group} depth={depth} fields={fields} table={table} rowColor={rowColor} baseId={baseId} showUse={showUse} now={now} />
  ))
}

function GroupBlock({ group, depth, fields, table, rowColor, baseId, showUse, now }) {
  if (!group.label && !group.children) {
    return <DataRows rows={group.rows} fields={fields} table={table} rowColor={rowColor} baseId={baseId} showUse={showUse} now={now} />
  }
  const count = group.children ? group.children.reduce((sum, child) => sum + leafCount(child), 0) : (group.rows?.length || 0)
  const span = Math.max(fields.length, 1) + (showUse ? 1 : 0)
  return (
    <>
      {group.label && (
        <tr className="reg-group">
          <td colSpan={span} style={{ paddingLeft: `${0.6 + depth * 0.8}rem` }}>{group.label} · {count}</td>
        </tr>
      )}
      {group.children
        ? <GroupBlocks groups={group.children} depth={depth + 1} fields={fields} table={table} rowColor={rowColor} baseId={baseId} showUse={showUse} now={now} />
        : <DataRows rows={group.rows} fields={fields} table={table} rowColor={rowColor} baseId={baseId} showUse={showUse} now={now} />}
    </>
  )
}

function cardTitle(fields, row) {
  const named = fields.find((field) => ['Item', 'Unique ID', 'Scaffold tag', 'Title', 'Name'].includes(field.name))
  const field = named || fields.find((item) => item.type === 'text') || fields[0]
  const text = field ? (plainValue(row.values?.[field.id]) || 'Untitled') : 'Untitled'
  return { field, text }
}

function tagChoice(table, row) {
  const field = (table.fields || []).find((item) => item.name === 'Tag colour')
  if (!field) return null
  return choiceFor(field, row.values?.[field.id])
}

function ItemCard({ row, fields, table, baseId, showUse, now, hazard }) {
  const check = showUse ? rowUse(table, row.values, now) : null
  const tagged = tagChoice(table, row)
  const title = cardTitle(fields, row)
  const meta = fields
    .filter((field) => field.id !== title.field?.id && field.name !== 'Tag colour')
    .map((field) => ({ field, text: briefValue(field, row.values?.[field.id]) }))
    .filter((item) => item.text)
    .slice(0, 3)
  const bandStyle = !hazard && tagged?.color ? { background: tagged.color, color: chipInk(tagged.color) } : undefined
  return (
    <a className={`gear-card${hazard ? ' hazard' : ''}`} href={`#/registers/${baseId}/${table.id}/${row.id}`} aria-label={`${title.text}${check ? `, ${check.label}` : ''}`}>
      <span className={`gear-band${hazard ? ' hazard' : ''}`} style={bandStyle} aria-hidden="true">
        {hazard ? <span>Out of service</span> : (tagged?.label || 'No tag')}
      </span>
      <span className="gear-body">
        <span className="gear-title">{title.text}</span>
        <span className="gear-badges">
          {check && <CheckPill check={check} />}
          {row.values?._example && <span className="reg-chip example">Example</span>}
        </span>
        {meta.length > 0 && (
          <span className="gear-meta">
            {meta.map((item) => <span key={item.field.id}>{item.field.name}: {item.text}</span>)}
          </span>
        )}
      </span>
    </a>
  )
}

function GearGroups({ groups, depth, fields, table, baseId, showUse, now, hazard }) {
  return groups.map((group) => (
    <div key={group.key} className="gear-group">
      {group.label && <p className="gear-group-label" style={{ paddingLeft: `${depth * 0.6}rem` }}>{group.label}</p>}
      {group.children
        ? <GearGroups groups={group.children} depth={depth + 1} fields={fields} table={table} baseId={baseId} showUse={showUse} now={now} hazard={hazard} />
        : group.rows.map((row) => (
          <ItemCard key={row.id} row={row} fields={fields} table={table} baseId={baseId} showUse={showUse} now={now} hazard={hazard || row.values?._oos} />
        ))}
    </div>
  ))
}

function GearList({ grouped, groups, rows, fields, table, baseId, showUse, now, hazard }) {
  return (
    <div className="gear-list">
      {grouped
        ? <GearGroups groups={groups} depth={0} fields={fields} table={table} baseId={baseId} showUse={showUse} now={now} hazard={hazard} />
        : rows.map((row) => (
          <ItemCard key={row.id} row={row} fields={fields} table={table} baseId={baseId} showUse={showUse} now={now} hazard={hazard || row.values?._oos} />
        ))}
    </div>
  )
}

export function RegisterBase({ app, id, tableId }) {
  const bases = useBases(app)
  const base = findBase(bases, id)
  const table = findTable(base, tableId)
  const [viewId, setViewId] = useState('')
  const [search, setSearch] = useState('')
  const [tool, setTool] = useState('')
  const [viewName, setViewName] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const [tabName, setTabName] = useState('')
  const [error, setError] = useState('')
  const [useFilter, setUseFilter] = useState('')
  const [clearing, setClearing] = useState(false)
  const seen = useRef('')

  useEffect(() => {
    if (!base || base.virtual || seen.current === base.id) return
    seen.current = base.id
    app.touchBase(base.id)
  }, [base, app])

  useEffect(() => {
    if (table && viewId && !table.views.some((item) => item.id === viewId)) setViewId(table.views[0]?.id || '')
    if (table && !viewId) setViewId(table.views[0]?.id || '')
  }, [table, viewId])

  useEffect(() => { setUseFilter('') }, [table?.id])

  if (!app.basesReady) return <p className="muted">Opening registers…</p>
  if (!base || !table) {
    return (
      <>
        <h1>Register not found</h1>
        <p className="lede"><a href="#/registers">Back to registers</a></p>
      </>
    )
  }

  const view = table.views.find((item) => item.id === viewId) || table.views[0]
  const config = view?.config || {}
  const now = new Date()
  const checkKind = tableCheck(table)
  const activeUse = useFilter === 'all' ? '' : (useFilter || config.use || '')
  const applied = applyView(table, { ...config, use: activeUse }, search, now)
  const fields = visibleFields(table, applied.hidden)
  const grouped = Boolean(config.group?.length)
  const showUse = Boolean(checkKind)
  const due = quarterTag(now)
  const examples = (table.rows || []).some((row) => row.values?._example === true)
  const useChips = checkKind === 'tag'
    ? [['', 'All'], ['in_date', 'In date'], ['locked', 'Locked out']]
    : checkKind === 'service'
      ? [['', 'All'], ['due', 'Service due']]
      : checkKind === 'hire'
        ? [['', 'All'], ['on_hire', 'On hire'], ['off_hire', 'Off hire']]
        : []

  const saveConfig = (patch) => {
    if (!view || base.virtual) return
    app.saveRegisterView(table.id, { ...view, config: { ...config, ...patch } })
  }

  const addRow = async () => {
    const item = { id: newId(), values: {} }
    await app.saveRegisterRow(table.id, item)
    go(`#/registers/${base.id}/${table.id}/${item.id}`)
  }

  const addTab = async (event) => {
    event.preventDefault()
    const name = tabName.trim()
    if (!name) return
    const idNext = await app.addRegisterTable(base.id, name)
    setTabName('')
    if (idNext) go(`#/registers/${base.id}/${idNext}`)
  }

  const addField = async (event) => {
    event.preventDefault()
    if (!fieldName.trim()) return
    const options = fieldType === 'single_select' || fieldType === 'multi_select'
      ? choiceList(fieldOptions.split(',').map((item) => item.trim()).filter(Boolean))
      : []
    await app.addRegisterField(table.id, { id: newId(), name: fieldName.trim(), type: fieldType, options })
    setFieldName('')
    setFieldOptions('')
  }

  const addView = async (event) => {
    event.preventDefault()
    const name = viewName.trim() || 'New view'
    const next = { id: newId(), name, position: table.views.length, config: { ...config } }
    await app.saveRegisterView(table.id, next)
    setViewName('')
    setViewId(next.id)
  }

  const onCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const parsed = parseCsv(await file.text())
      const rows = parsed.rows.map((cells) => ({ id: newId(), values: valuesFromHeaderRow(table.fields, parsed.headers, cells) }))
      if (!rows.length) throw new Error('That file has no data rows.')
      await app.importRegisterRows(table.id, rows)
    } catch (err) {
      setError(err.message || 'Could not import that file.')
    }
  }

  return (
    <div className={`reg-base${base.kind === 'out_of_service' ? ' hazard' : ''}`}>
      <p className="eyebrow"><a href="#/registers">Registers</a></p>
      <div className="reg-home-head">
        <h1>{base.name}</h1>
        {!base.virtual && <Button type="button" onClick={addRow}>Add row</Button>}
      </div>
      {base.virtual && <p className="lede">Form links for this company. Gear does not get a QR sticker.</p>}
      {checkKind === 'tag' && <p className="quarter-banner"><span className="swatch" style={{ background: due.color }} />Due this quarter: {due.label} ({due.season}). A wrong or expired colour is locked out and can’t be used until it is re-tagged.</p>}
      {checkKind === 'service' && <p className="lede">Owned heavy plant. Service is due 6 months after the last service.</p>}
      {checkKind === 'hire' && <p className="lede">Hired and client-owned equipment, with the hire company and the on-hire and off-hire dates.</p>}
      {base.kind === 'out_of_service' && <p className="lede">Black and yellow means out of service. Returning an item keeps the row in History.</p>}
      {examples && (
        <p className="example-banner">
          These rows are example data.
          <Button type="button" kind="ghost" disabled={clearing} onClick={async () => {
            setClearing(true)
            try { await app.clearExampleRows() } catch (err) { setError(err.message || 'Could not clear the example rows.') }
            setClearing(false)
          }}>{clearing ? 'Clearing…' : 'Clear example data'}</Button>
        </p>
      )}
      <div className="reg-tabs" role="tablist">
        {base.tables.map((item) => (
          <a key={item.id} role="tab" aria-selected={item.id === table.id} className={item.id === table.id ? 'active' : ''} href={`#/registers/${base.id}/${item.id}`}>{item.name}</a>
        ))}
      </div>
      {!base.virtual && (
        <form className="reg-add-tab" onSubmit={addTab}>
          <input aria-label="New tab name" value={tabName} onChange={(event) => setTabName(event.target.value)} placeholder="New tab" />
          <Button type="submit" kind="ghost">Add tab</Button>
        </form>
      )}
      <div className="reg-layout">
        <aside className="reg-views">
          <p className="group">Sites and lists</p>
          {table.views.map((item) => (
            <button key={item.id} type="button" className={item.id === view?.id ? 'active' : ''} onClick={() => setViewId(item.id)}>{item.name}</button>
          ))}
          {!base.virtual && (
            <form onSubmit={addView} className="reg-add-tab">
              <input aria-label="New view name" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="New view" />
              <Button type="submit" kind="ghost">Save view</Button>
            </form>
          )}
        </aside>
        <div>
          <div className="reg-toolbar">
            {['hide', 'filter', 'group', 'sort', 'color'].map((key) => (
              <button key={key} type="button" className={`chip${tool === key ? ' active' : ''}`} onClick={() => setTool((value) => (value === key ? '' : key))}>
                {key === 'hide' ? 'Hide fields' : key === 'filter' ? 'Filter' : key === 'group' ? 'Group' : key === 'sort' ? 'Sort' : 'Row colour'}
              </button>
            ))}
            <label className="reg-search">
              <span className="sr">Search</span>
              <input aria-label="Search rows" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
            </label>
            {useChips.map(([value, label]) => (
              <button key={label} type="button" className={`chip${activeUse === value ? ' active' : ''}`} onClick={() => setUseFilter(value === '' ? 'all' : value)}>{label}</button>
            ))}
            {!base.virtual && <label className="chip file-chip">Import CSV<input type="file" accept=".csv,text/csv" onChange={onCsv} /></label>}
          </div>
          {error && <p className="note">{error}</p>}
          {tool === 'hide' && (
            <div className="reg-tool">
              {table.fields.map((field) => (
                <label className="checkline" key={field.id}>
                  <input
                    type="checkbox"
                    checked={!applied.hidden.has(field.id)}
                    onChange={() => {
                      const hidden = new Set(config.hidden || [])
                      if (hidden.has(field.id)) hidden.delete(field.id)
                      else hidden.add(field.id)
                      saveConfig({ hidden: [...hidden] })
                    }}
                  />
                  <span>{field.name}</span>
                </label>
              ))}
            </div>
          )}
          {tool === 'filter' && (
            <div className="reg-tool">
              {(config.filter || []).map((rule, index) => (
                <div className="reg-rule" key={`${rule.fieldId}-${index}`}>
                  <select aria-label="Filter field" value={rule.fieldId} onChange={(event) => saveConfig({ filter: config.filter.map((item, i) => (i === index ? { ...item, fieldId: event.target.value } : item)) })}>
                    {table.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                  </select>
                  <select aria-label="Filter comparison" value={rule.op} onChange={(event) => saveConfig({ filter: config.filter.map((item, i) => (i === index ? { ...item, op: event.target.value } : item)) })}>
                    <option value="is">is</option>
                    <option value="is_not">is not</option>
                    <option value="contains">contains</option>
                    <option value="empty">is empty</option>
                    <option value="not_empty">is not empty</option>
                  </select>
                  <input aria-label="Filter value" value={rule.value || ''} onChange={(event) => saveConfig({ filter: config.filter.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)) })} />
                </div>
              ))}
              <Button type="button" kind="ghost" onClick={() => saveConfig({ filter: [...(config.filter || []), { fieldId: table.fields[0]?.id || '', op: 'is', value: '' }] })}>Add filter</Button>
            </div>
          )}
          {tool === 'group' && (
            <div className="reg-tool">
              <p className="hint">Tick more than one field to group by both. The first ticked field is the outer group.</p>
              {table.fields.map((field) => (
                <label className="checkline" key={field.id}>
                  <input
                    type="checkbox"
                    checked={(config.group || []).includes(field.id)}
                    onChange={() => {
                      const group = config.group || []
                      saveConfig({ group: group.includes(field.id) ? group.filter((item) => item !== field.id) : [...group, field.id] })
                    }}
                  />
                  <span>{field.name}</span>
                </label>
              ))}
            </div>
          )}
          {tool === 'sort' && (
            <div className="reg-tool">
              {(config.sort || []).map((rule, index) => (
                <div className="reg-rule" key={`${rule.fieldId}-${index}`}>
                  <select aria-label="Sort field" value={rule.fieldId} onChange={(event) => saveConfig({ sort: config.sort.map((item, i) => (i === index ? { ...item, fieldId: event.target.value } : item)) })}>
                    {table.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                  </select>
                  <select aria-label="Sort direction" value={rule.dir || 'asc'} onChange={(event) => saveConfig({ sort: config.sort.map((item, i) => (i === index ? { ...item, dir: event.target.value } : item)) })}>
                    <option value="asc">A to Z</option>
                    <option value="desc">Z to A</option>
                  </select>
                </div>
              ))}
              <Button type="button" kind="ghost" onClick={() => saveConfig({ sort: [...(config.sort || []), { fieldId: table.fields[0]?.id || '', dir: 'asc' }] })}>Add sort</Button>
            </div>
          )}
          {tool === 'color' && (
            <div className="reg-tool">
              <Field label="Colour rows from">
                <select aria-label="Row colour field" value={config.rowColor || ''} onChange={(event) => saveConfig({ rowColor: event.target.value })}>
                  <option value="">No row colour</option>
                  {table.fields.filter((field) => field.type === 'single_select').map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                </select>
              </Field>
            </div>
          )}
          <GearList
            grouped={grouped}
            groups={applied.groups}
            rows={applied.rows}
            fields={fields}
            table={table}
            baseId={base.id}
            showUse={showUse}
            now={now}
            hazard={base.kind === 'out_of_service'}
          />
          <div className="reg-scroll">
            <table className="reg-grid">
              <thead>
                <tr>
                  {showUse && <th>Status</th>}
                  {fields.map((field, index) => (
                    <th key={field.id} className={index === 0 ? 'lead' : ''}>{field.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped
                  ? <GroupBlocks groups={applied.groups} depth={0} fields={fields} table={table} rowColor={applied.rowColor} baseId={base.id} showUse={showUse} now={now} />
                  : <DataRows rows={applied.rows} fields={fields} table={table} rowColor={applied.rowColor} baseId={base.id} showUse={showUse} now={now} />}
              </tbody>
            </table>
          </div>
          {applied.rows.length === 0 && <p className="muted">No rows in this view. Add a row, or import a CSV whose headers match the column names.</p>}
          {!base.virtual && (
            <form className="reg-add-field" onSubmit={addField}>
              <input aria-label="New field name" value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="New field" />
              <select aria-label="Field type" value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
                {FIELD_TYPES.filter((item) => item.id !== 'qr').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              {(fieldType === 'single_select' || fieldType === 'multi_select') && (
                <input aria-label="Choices" value={fieldOptions} onChange={(event) => setFieldOptions(event.target.value)} placeholder="Choice, choice" />
              )}
              <Button type="submit" kind="ghost">Add field</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Editor({ field, value, onChange }) {
  if (field.type === 'single_select') {
    return (
      <select aria-label={field.name} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {(field.options || []).map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
      </select>
    )
  }
  if (field.type === 'multi_select') {
    const picked = Array.isArray(value) ? value : []
    return (
      <div className="multi-select">
        {(field.options || []).map((option) => (
          <label className="checkline" key={option.id}>
            <input
              type="checkbox"
              checked={picked.includes(option.label)}
              onChange={() => onChange(picked.includes(option.label) ? picked.filter((item) => item !== option.label) : [...picked, option.label])}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <div className="ynna">
        <button type="button" className={value === true ? 'on' : ''} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className={value === false ? 'on' : ''} onClick={() => onChange(false)}>No</button>
      </div>
    )
  }
  if (field.type === 'date') return <input aria-label={field.name} type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  if (field.type === 'number') return <input aria-label={field.name} inputMode="decimal" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
  if (field.type === 'url') return <input aria-label={field.name} type="url" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  if (field.type === 'attachment') {
    const photos = Array.isArray(value) ? value : []
    return (
      <div>
        <div className="reg-photos large">
          {photos.map((photo) => <img key={photo.dataUrl || photo.name} src={photo.dataUrl} alt={photo.name || ''} />)}
        </div>
        <input
          aria-label={`Add photo to ${field.name}`}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const photo = await readPhoto(file)
            onChange([...photos, photo])
          }}
        />
      </div>
    )
  }
  if (field.type === 'qr') return <QrThumb link={value} />
  return <input aria-label={field.name} value={value || ''} onChange={(event) => onChange(event.target.value)} />
}

export function RegisterRecord({ app, id, tableId, rowId }) {
  const bases = useBases(app)
  const base = findBase(bases, id)
  const table = findTable(base, tableId)
  const existing = table?.rows?.find((item) => item.id === rowId)
  const [values, setValues] = useState(existing?.values || {})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (existing) setValues(existing.values || {})
  }, [existing])

  if (!app.basesReady) return <p className="muted">Opening the record…</p>
  if (!base || !table || !existing) {
    return (
      <>
        <h1>Record not found</h1>
        <p className="lede"><a href={base && table ? `#/registers/${base.id}/${table.id}` : '#/registers'}>Back to the register</a></p>
      </>
    )
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    setSaved('')
    try {
      await app.saveRegisterRow(table.id, { ...existing, values })
      setSaved('Saved.')
    } catch (err) {
      setError(err.message || 'Could not save this record.')
    }
  }

  const remove = async () => {
    await app.deleteRegisterRow(table.id, existing.id)
    go(`#/registers/${base.id}/${table.id}`)
  }

  const check = rowUse(table, values)
  const oosBase = bases.find((item) => item.kind === 'out_of_service')
  const status = table.fields.find((item) => item.name === 'Status')
  const stillOut = base.kind === 'out_of_service' && values[status?.id] !== 'Returned'
  const tagged = tagChoice(table, { values })
  const hazard = base.kind === 'out_of_service'
  const titleField = table.fields.find((field) => ['Item', 'Unique ID', 'Scaffold tag', 'Title', 'Name'].includes(field.name)) || table.fields[0]
  const title = plainValue(values[titleField?.id]) || 'Record'
  const bandStyle = !hazard && tagged?.color ? { background: tagged.color, color: chipInk(tagged.color) } : undefined

  const takeOut = async () => {
    setBusy(true)
    setError('')
    try {
      const moved = await app.moveOutOfService(table.id, existing.id, reason)
      const target = bases.find((item) => item.kind === 'out_of_service') || oosBase
      if (moved?.oosRow && target) go(`#/registers/${target.id}/${moved.oosTableId}/${moved.oosRow.id}`)
    } catch (err) {
      setError(err.message || 'Could not take that item out of service.')
    } finally {
      setBusy(false)
    }
  }

  const bringBack = async () => {
    setBusy(true)
    setError('')
    try {
      await app.returnToService(table.id, existing.id)
      setSaved('Returned to service. This row stays in the history.')
    } catch (err) {
      setError(err.message || 'Could not return that item to service.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`reg-record${hazard ? ' hazard' : ''}`} onSubmit={save}>
      <p className="eyebrow"><a href={`#/registers/${base.id}/${table.id}`}>{base.name} · {table.name}</a></p>
      <div className={`record-band${hazard ? ' hazard' : ''}`} style={bandStyle}>{hazard ? <span>Out of service</span> : (tagged?.label || check?.label || 'Record')}</div>
      <h1>{title}</h1>
      {check && <p className="record-status"><CheckPill check={check} /></p>}
      <p className="lede">Edit the whole record here. On a phone this is the way to change a row.</p>
      {check?.state === 'locked' && (
        <p className="lockout-banner">
          {check.label}. {check.reason ? `${check.reason}. ` : ''}
          {check.due ? `Can’t be used until it is re-tagged ${check.due.label} (${check.due.season}).` : 'Can’t be used until it is back in service.'}
        </p>
      )}
      {check?.state === 'due' && <p className="due-banner">SERVICE DUE{check.next ? ` since ${check.next}` : ''}. Owned plant is serviced every 6 months.</p>}
      {check?.state === 'in_date' && check.due && <p className="ok-banner">In date for {check.due.label} ({check.due.season}).</p>}
      {values._oos && oosBase && (
        <p className="lockout-banner">
          OUT OF SERVICE. The movement is kept on the out-of-service register.
          {' '}<a href={`#/registers/${oosBase.id}/${oosBase.tables?.[0]?.id}/${values._oosRowId}`}>Open that record</a>
        </p>
      )}
      {values._example && <p className="example-banner">Example row. Clear example data from the register home when you want an empty register.</p>}
      {table.fields.map((field) => (
        <Field key={field.id} label={field.name}>
          {field.type === 'qr'
            ? <QrThumb link={values.link || values[field.id]} />
            : <Editor field={field} value={values[field.id]} onChange={(next) => setValues((prev) => ({ ...prev, [field.id]: next }))} />}
        </Field>
      ))}
      {base.kind === 'gear' && !values._oos && !existing.readOnly && (
        <div className="reg-move">
          <Field label="Reason out of service">
            <input aria-label="Reason out of service" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Damaged, failed inspection" />
          </Field>
          <Button type="button" kind="ghost" disabled={busy} onClick={takeOut}>Take out of service</Button>
        </div>
      )}
      {error && <p className="note">{error}</p>}
      {saved && <p className="lede">{saved}</p>}
      <div className="admin-savebar">
        {!existing.readOnly && <Button type="submit">Save</Button>}
        {stillOut && !existing.readOnly && <Button type="button" disabled={busy} onClick={bringBack}>Return to service</Button>}
        {!existing.readOnly && <Button type="button" kind="ghost" onClick={remove}>Delete</Button>}
        <Button type="button" kind="ghost" onClick={() => go(`#/registers/${base.id}/${table.id}`)}>Back</Button>
      </div>
    </form>
  )
}
