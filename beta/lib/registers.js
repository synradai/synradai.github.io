// Company registers: bases, tabs, fields, saved views, and rows.
// Field values stay in one jsonb object so a new column does not need a migration.

import { phaseOneBases } from './phaseOne.js'
import { matchesUse } from './tagging.js'

export const FIELD_TYPES = [
  { id: 'text', label: 'Text', icon: 'Aa' },
  { id: 'number', label: 'Number', icon: '#' },
  { id: 'date', label: 'Date', icon: 'Dt' },
  { id: 'single_select', label: 'Single select', icon: '▾' },
  { id: 'multi_select', label: 'Multi select', icon: '☰' },
  { id: 'checkbox', label: 'Yes / no', icon: 'YN' },
  { id: 'attachment', label: 'Photo', icon: 'Img' },
  { id: 'url', label: 'Link', icon: '↗' },
  { id: 'qr', label: 'QR code', icon: 'QR' },
]

const PALETTE = ['#1f8a4c', '#2458a8', '#b42318', '#c45c26', '#6b4c9a', '#8a6a12', '#0e7490', '#3f6212']

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = Math.floor(Math.random() * 16)
    return (ch === 'x' ? n : ((n % 4) + 8)).toString(16)
  })
}

export function fieldIcon(type) {
  return FIELD_TYPES.find((item) => item.id === type)?.icon || 'Aa'
}

export function choiceList(labels) {
  return (labels || []).map((label, index) => ({
    id: slug(label),
    label,
    color: PALETTE[index % PALETTE.length],
  }))
}

function slug(label) {
  const text = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return text || 'option'
}

function field(name, type, options = [], extra = {}) {
  return { id: extra.id || newId(), name, type, options, position: extra.position || 0 }
}

function view(name, config = {}, position = 0) {
  return { id: newId(), name, position, config }
}

function row(values) {
  return { id: newId(), values, createdAt: '', updatedAt: '' }
}

export function openedAgo(iso, now = new Date()) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'Not opened recently'
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000))
  if (mins < 1) return 'Opened just now'
  if (mins < 60) return `Opened ${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `Opened ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `Opened ${days} day${days === 1 ? '' : 's'} ago`
  return 'Not opened recently'
}

export function tint(hex, alpha = 0.28) {
  const h = String(hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return ''
  const n = Number.parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function abbrFor(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'Rg'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

function locationChoices() {
  return choiceList(['Wagerup', 'Pinjarra'])
}

function inspectionTable(name, position, sampleItem) {
  const ids = {
    date: newId(), inspector: newId(), location: newId(), item: newId(), uniqueId: newId(),
    make: newId(), yom: newId(), oem: newId(), result: newId(),
  }
  const fields = [
    field('Date', 'date', [], { id: ids.date, position: 0 }),
    field('Inspector', 'text', [], { id: ids.inspector, position: 1 }),
    field('Location', 'single_select', locationChoices(), { id: ids.location, position: 2 }),
    field('Item', 'text', [], { id: ids.item, position: 3 }),
    field('Unique ID', 'text', [], { id: ids.uniqueId, position: 4 }),
    field('Make', 'text', [], { id: ids.make, position: 5 }),
    field('YoM / batch', 'text', [], { id: ids.yom, position: 6 }),
    field('OEM technical info', 'checkbox', [], { id: ids.oem, position: 7 }),
    field('Pass / fail', 'single_select', [
      { id: 'pass', label: 'Pass', color: '#1f8a4c' },
      { id: 'fail', label: 'Fail', color: '#b42318' },
    ], { id: ids.result, position: 8 }),
  ]
  const rows = sampleItem ? [row({
    [ids.date]: '2026-10-15',
    [ids.inspector]: 'Site inspector',
    [ids.location]: sampleItem.location,
    [ids.item]: sampleItem.item,
    [ids.uniqueId]: sampleItem.uniqueId,
    [ids.make]: 'Sample make',
    [ids.yom]: '2022',
    [ids.oem]: true,
    [ids.result]: 'Pass',
  })] : []
  return {
    id: newId(),
    name,
    position,
    fields,
    views: [
      view('Master Register', {}, 0),
      view('Wagerup', { filter: [{ fieldId: ids.location, op: 'is', value: 'Wagerup' }] }, 1),
      view('Pinjarra', { filter: [{ fieldId: ids.location, op: 'is', value: 'Pinjarra' }] }, 2),
    ],
    rows,
  }
}

const SAMPLE_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56"><rect fill="#2458a8" width="80" height="56"/><text x="14" y="34" fill="white" font-size="14" font-family="sans-serif">Photo</text></svg>')}`

export function starterBases(now = new Date().toISOString()) {
  const at = new Date(now).getTime()
  const id = {
    tag: newId(), location: newId(), photos: newId(), oc: newId(), building: newId(),
    status: newId(), description: newId(), po: newId(), date: newId(), workType: newId(),
    scaffoldType: newId(), size: newId(), m3: newId(),
  }
  const scaffoldFields = [
    field('Scaffold tag', 'text', [], { id: id.tag, position: 0 }),
    field('Location', 'single_select', locationChoices(), { id: id.location, position: 1 }),
    field('Photos', 'attachment', [], { id: id.photos, position: 2 }),
    field('OC', 'single_select', choiceList(['OC1', 'OC2', 'OC5']), { id: id.oc, position: 3 }),
    field('Building', 'single_select', choiceList(['LIME', 'BLD 42', 'BLD 110']), { id: id.building, position: 4 }),
    field('Status', 'single_select', [
      { id: 'erected', label: 'ERECTED', color: '#1f8a4c' },
      { id: 'planned', label: 'PLANNED', color: '#c45c26' },
      { id: 'dismantled', label: 'DISMANTLED', color: '#5c6b82' },
    ], { id: id.status, position: 5 }),
    field('Description', 'text', [], { id: id.description, position: 6 }),
    field('PO', 'text', [], { id: id.po, position: 7 }),
    field('Date', 'date', [], { id: id.date, position: 8 }),
    field('Work type', 'single_select', [
      { id: 'capital', label: 'Capital', color: '#b42318' },
      { id: 'maintenance', label: 'Maintenance', color: '#1f8a4c' },
      { id: 'moh', label: 'MOH', color: '#6b4c9a' },
    ], { id: id.workType, position: 9 }),
    field('Scaffold type', 'single_select', [
      { id: 'tube', label: 'TUBE & CLIP', color: '#b42318' },
      { id: 'ring', label: 'RING LOCK', color: '#1f8a4c' },
    ], { id: id.scaffoldType, position: 10 }),
    field('Size', 'single_select', choiceList(['MEDIUM', 'HEAVY']), { id: id.size, position: 11 }),
    field('m3', 'number', [], { id: id.m3, position: 12 }),
  ]
  const legacy = [
    {
      id: newId(),
      name: 'Scaffold Register',
      abbr: 'Sc',
      color: '#6b2d3c',
      starred: true,
      kind: 'base',
      openedAt: new Date(at - 6 * 3600000).toISOString(),
      tables: [
        {
          id: newId(),
          name: 'Scaffold Register',
          position: 0,
          fields: scaffoldFields,
          views: [
            view('Master Register', { rowColor: id.status }, 0),
            view('Wagerup', { filter: [{ fieldId: id.location, op: 'is', value: 'Wagerup' }], rowColor: id.status }, 1),
            view('Pinjarra', { filter: [{ fieldId: id.location, op: 'is', value: 'Pinjarra' }], rowColor: id.status }, 2),
          ],
          rows: [
            row({
              [id.tag]: 'WGR088', [id.location]: 'Wagerup', [id.photos]: [{ name: 'scaffold.jpg', dataUrl: SAMPLE_PHOTO }],
              [id.oc]: 'OC2', [id.building]: 'LIME', [id.status]: 'ERECTED', [id.description]: 'Hard barricade to access roof valve.',
              [id.po]: 'PO7208665', [id.date]: '2026-05-21', [id.workType]: 'Capital', [id.scaffoldType]: 'TUBE & CLIP', [id.size]: 'MEDIUM', [id.m3]: 198,
            }),
            row({
              [id.tag]: 'WGR100', [id.location]: 'Wagerup', [id.photos]: [], [id.oc]: 'OC1', [id.building]: 'BLD 42', [id.status]: 'ERECTED',
              [id.description]: 'Access to ground floor elbow.', [id.po]: 'PO7700930', [id.date]: '2026-08-14', [id.workType]: 'Maintenance',
              [id.scaffoldType]: 'RING LOCK', [id.size]: 'HEAVY', [id.m3]: 657,
            }),
          ],
        },
        {
          id: newId(), name: 'Gearlist', position: 1,
          fields: [
            field('Item', 'text', [], { position: 0 }),
            field('Quantity', 'number', [], { position: 1 }),
            field('Location', 'single_select', locationChoices(), { position: 2 }),
            field('Notes', 'text', [], { position: 3 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
        {
          id: newId(), name: 'Stocktake', position: 2,
          fields: [
            field('Item', 'text', [], { position: 0 }),
            field('Counted', 'number', [], { position: 1 }),
            field('Date', 'date', [], { position: 2 }),
            field('Location', 'single_select', locationChoices(), { position: 3 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
        {
          id: newId(), name: 'Scaffold Inspection', position: 3,
          fields: [
            field('Date', 'date', [], { position: 0 }),
            field('Inspector', 'text', [], { position: 1 }),
            field('Scaffold tag', 'text', [], { position: 2 }),
            field('Result', 'single_select', [
              { id: 'pass', label: 'Pass', color: '#1f8a4c' },
              { id: 'fail', label: 'Fail', color: '#b42318' },
            ], { position: 3 }),
            field('Notes', 'text', [], { position: 4 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
        {
          id: newId(), name: 'Handrail Inspection', position: 4,
          fields: [
            field('Date', 'date', [], { position: 0 }),
            field('Inspector', 'text', [], { position: 1 }),
            field('Location', 'single_select', locationChoices(), { position: 2 }),
            field('Result', 'single_select', [
              { id: 'pass', label: 'Pass', color: '#1f8a4c' },
              { id: 'fail', label: 'Fail', color: '#b42318' },
            ], { position: 3 }),
            field('Notes', 'text', [], { position: 4 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
        (() => {
          const ids = { name: newId(), role: newId(), location: newId(), tickets: newId() }
          return {
            id: newId(), name: 'Employees', position: 5,
            fields: [
              field('Name', 'text', [], { id: ids.name, position: 0 }),
              field('Role', 'text', [], { id: ids.role, position: 1 }),
              field('Location', 'single_select', locationChoices(), { id: ids.location, position: 2 }),
              field('Tickets', 'multi_select', choiceList(['White card', 'Working at heights', 'Confined space']), { id: ids.tickets, position: 3 }),
            ],
            views: [view('Master Register', {}, 0)],
            rows: [row({ [ids.name]: 'Sample fitter', [ids.role]: 'Fitter', [ids.location]: 'Wagerup', [ids.tickets]: ['White card', 'Working at heights'] })],
          }
        })(),
      ],
    },
    {
      id: newId(),
      name: 'Equipment Inspection Register',
      abbr: 'Eq',
      color: '#1d4a32',
      starred: false,
      kind: 'base',
      openedAt: new Date(at - 3 * 86400000).toISOString(),
      tables: [
        inspectionTable('Harness Inspection', 0, { item: 'Harness', location: 'Pinjarra', uniqueId: 'SAMPLE-001' }),
        inspectionTable('Lanyard Inspection', 1, null),
        inspectionTable('Chain Block', 2, null),
        inspectionTable('Come Along', 3, null),
        inspectionTable('Lifting Chain', 4, null),
        inspectionTable('Shackles', 5, null),
        inspectionTable('Girder Clamps', 6, null),
        inspectionTable('Soft Slings', 7, null),
        inspectionTable('Spill Kit', 8, null),
        {
          id: newId(),
          name: 'Out of Service',
          position: 9,
          fields: [
            field('Date', 'date', [], { position: 0 }),
            field('Item', 'text', [], { position: 1 }),
            field('Unique ID', 'text', [], { position: 2 }),
            field('Location', 'single_select', locationChoices(), { position: 3 }),
            field('Reason', 'text', [], { position: 4 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
        {
          id: newId(),
          name: 'Data Sheet Attachments',
          position: 10,
          fields: [
            field('Title', 'text', [], { position: 0 }),
            field('Attachment', 'attachment', [], { position: 1 }),
            field('Date', 'date', [], { position: 2 }),
            field('Notes', 'text', [], { position: 3 }),
          ],
          views: [view('Master Register', {}, 0)],
          rows: [],
        },
      ],
    },
  ]
  return [...legacy, ...phaseOneBases(now)]
}

export function blankBase(name, now = new Date().toISOString()) {
  const title = String(name || '').trim() || 'New register'
  return {
    id: newId(),
    name: title,
    abbr: abbrFor(title),
    color: PALETTE[title.length % PALETTE.length],
    starred: false,
    kind: 'base',
    openedAt: now,
    tables: [{
      id: newId(),
      name: title,
      position: 0,
      fields: [field('Title', 'text', [], { position: 0 })],
      views: [view('All records', {}, 0)],
      rows: [],
    }],
  }
}

export function formsLibrary(codes, origin = 'https://synradai.github.io/beta/') {
  const root = String(origin || 'https://synradai.github.io/beta/').replace(/\/?$/, '/')
  const rows = (codes || []).filter((code) => code && code.active !== false && code.token).map((code) => ({
    id: String(code.id),
    readOnly: true,
    values: {
      title: code.label || code.targetId || 'Form',
      link: `${root}#/f/${encodeURIComponent(code.token)}`,
      qr: code.token,
      date: String(code.createdAt || '').slice(0, 10),
    },
  }))
  const latest = (codes || []).map((code) => code.createdAt).filter(Boolean).sort().at(-1) || ''
  return {
    id: 'forms-library',
    name: 'QR Codes',
    abbr: 'Qr',
    color: '#5b3d8a',
    starred: false,
    kind: 'forms',
    virtual: true,
    openedAt: latest,
    tables: [{
      id: 'forms-table',
      name: 'QR Codes',
      position: 0,
      fields: [
        field('Title', 'text', [], { id: 'title', position: 0 }),
        field('Website Link', 'url', [], { id: 'link', position: 1 }),
        field('QR Codes', 'qr', [], { id: 'qr', position: 2 }),
        field('Date', 'date', [], { id: 'date', position: 3 }),
      ],
      views: [view('All forms', {}, 0)],
      rows,
    }],
  }
}

export function sortBases(list) {
  return (list || []).slice().sort((a, b) => {
    if (Boolean(a.starred) !== Boolean(b.starred)) return a.starred ? -1 : 1
    return String(b.openedAt || '').localeCompare(String(a.openedAt || ''))
  })
}

function listValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (value == null || value === '') return []
  return [String(value).trim()]
}

export function cellSearch(fieldDef, value) {
  if (!fieldDef) return ''
  if (fieldDef.type === 'attachment') return listValue((value || []).map?.((item) => item?.name) || []).join(' ').toLowerCase()
  if (fieldDef.type === 'checkbox') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.join(' ').toLowerCase()
  return String(value ?? '').toLowerCase()
}

function matchesChoice(fieldDef, value, expected) {
  const want = String(expected ?? '').trim().toLowerCase()
  if (!want) return false
  const option = (fieldDef?.options || []).find((item) => item.label.toLowerCase() === want || item.id.toLowerCase() === want)
  const accepted = new Set([want, option?.id?.toLowerCase(), option?.label?.toLowerCase()].filter(Boolean))
  return listValue(value).some((item) => accepted.has(item.toLowerCase()))
}

export function matchFilter(fieldDef, value, rule) {
  const op = rule?.op || 'is'
  if (op === 'empty') {
    if (fieldDef?.type === 'checkbox') return value !== true && value !== false
    if (fieldDef?.type === 'attachment') return !Array.isArray(value) || value.length === 0
    return listValue(value).length === 0
  }
  if (op === 'not_empty') return !matchFilter(fieldDef, value, { op: 'empty' })
  if (op === 'contains') return cellSearch(fieldDef, value).includes(String(rule.value || '').trim().toLowerCase())
  if (op === 'is_not') return !matchesChoice(fieldDef, value, rule.value) && String(value ?? '').trim().toLowerCase() !== String(rule.value || '').trim().toLowerCase()
  if (fieldDef?.type === 'checkbox') return Boolean(value) === ['yes', 'true', '1'].includes(String(rule.value || '').trim().toLowerCase())
  return matchesChoice(fieldDef, value, rule.value) || String(value ?? '').trim().toLowerCase() === String(rule.value || '').trim().toLowerCase()
}

function compareCells(fieldDef, a, b) {
  if (fieldDef?.type === 'number') return (Number(a) || 0) - (Number(b) || 0)
  if (fieldDef?.type === 'checkbox') return Number(Boolean(a)) - Number(Boolean(b))
  if (fieldDef?.type === 'multi_select' || fieldDef?.type === 'attachment') {
    return listValue(fieldDef?.type === 'attachment' ? (a || []).map((item) => item?.name) : a).join(', ').localeCompare(listValue(fieldDef?.type === 'attachment' ? (b || []).map((item) => item?.name) : b).join(', '))
  }
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}

export function sortRows(rows, fields, sort) {
  const rules = Array.isArray(sort) ? sort.filter((rule) => rule?.fieldId) : []
  if (!rules.length) return rows.slice()
  return rows.slice().sort((a, b) => {
    for (const rule of rules) {
      const fieldDef = (fields || []).find((item) => item.id === rule.fieldId)
      const diff = compareCells(fieldDef, a.values?.[rule.fieldId], b.values?.[rule.fieldId])
      if (diff) return rule.dir === 'desc' ? -diff : diff
    }
    return 0
  })
}

function groupLabel(fieldDef, value) {
  if (!fieldDef) return ['(empty)']
  if (fieldDef.type === 'checkbox') return [value === true ? 'Yes' : value === false ? 'No' : '(empty)']
  if (fieldDef.type === 'multi_select') {
    const items = listValue(value)
    return items.length ? items : ['(empty)']
  }
  if (fieldDef.type === 'attachment') return (Array.isArray(value) && value.length) ? ['Has photo'] : ['(empty)']
  const text = String(value ?? '').trim()
  return [text || '(empty)']
}

export function groupRows(rows, fields, keys) {
  const remaining = (keys || []).filter(Boolean)
  if (!remaining.length) return [{ key: 'all', label: '', rows }]
  const [head, ...rest] = remaining
  const fieldDef = (fields || []).find((item) => item.id === head)
  const buckets = new Map()
  for (const item of rows || []) {
    for (const label of groupLabel(fieldDef, item.values?.[head])) {
      if (!buckets.has(label)) buckets.set(label, [])
      buckets.get(label).push(item)
    }
  }
  return [...buckets.entries()].map(([label, items]) => ({
    key: `${head}:${label}`,
    label,
    fieldId: head,
    rows: rest.length ? [] : items,
    children: rest.length ? groupRows(items, fields, rest) : null,
  }))
}

export function missingStarters(existing, now = new Date().toISOString()) {
  const names = new Set((existing || []).map((item) => item.name))
  return starterBases(now).filter((item) => item.name && !names.has(item.name))
}

export function applyView(table, viewConfig, search = '', now = new Date()) {
  const fields = table?.fields || []
  let rows = table?.rows || []
  const query = String(search || '').trim().toLowerCase()
  if (query) rows = rows.filter((item) => fields.some((fieldDef) => cellSearch(fieldDef, item.values?.[fieldDef.id]).includes(query)))
  for (const rule of viewConfig?.filter || []) {
    const fieldDef = fields.find((item) => item.id === rule.fieldId)
    rows = rows.filter((item) => matchFilter(fieldDef, item.values?.[rule.fieldId], rule))
  }
  if (viewConfig?.use) rows = rows.filter((item) => matchesUse(table, item.values, viewConfig.use, now))
  rows = sortRows(rows, fields, viewConfig?.sort)
  return {
    rows,
    groups: groupRows(rows, fields, viewConfig?.group),
    hidden: new Set(viewConfig?.hidden || []),
    rowColor: viewConfig?.rowColor || '',
  }
}

export function visibleFields(table, hidden) {
  return (table?.fields || []).filter((fieldDef) => !hidden?.has(fieldDef.id))
}

export function rowTint(table, rowColorId, values) {
  if (!rowColorId) return ''
  const fieldDef = (table?.fields || []).find((item) => item.id === rowColorId)
  const choice = (fieldDef?.options || []).find((item) => item.label === values?.[rowColorId] || item.id === values?.[rowColorId])
  return tint(choice?.color, 0.22)
}

export function splitMulti(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value || '').split(/[,;|\n]/).map((item) => item.trim()).filter(Boolean)
}

export function valuesFromHeaderRow(fields, headers, cells) {
  const named = {}
  ;(headers || []).forEach((header, index) => {
    const fieldDef = (fields || []).find((item) => item.id === header || item.name.toLowerCase() === String(header || '').trim().toLowerCase())
    if (fieldDef) named[fieldDef.id] = cells?.[index]
  })
  return valuesFromCells(fields, named)
}

export function valuesFromCells(fields, cells) {
  const values = {}
  for (const fieldDef of fields || []) {
    const raw = cells?.[fieldDef.name] ?? cells?.[fieldDef.id] ?? ''
    if (fieldDef.type === 'multi_select') values[fieldDef.id] = splitMulti(raw)
    else if (fieldDef.type === 'checkbox') values[fieldDef.id] = ['yes', 'true', 'y', '1'].includes(String(raw).trim().toLowerCase())
    else if (fieldDef.type === 'number') values[fieldDef.id] = raw === '' || raw == null ? '' : Number(raw)
    else if (fieldDef.type === 'attachment' || fieldDef.type === 'qr') values[fieldDef.id] = []
    else values[fieldDef.id] = String(raw ?? '').trim()
  }
  return values
}

export function findBase(bases, id) {
  return (bases || []).find((item) => item.id === id) || null
}

export function findTable(base, tableId) {
  if (!base) return null
  return (base.tables || []).find((item) => item.id === tableId) || base.tables?.[0] || null
}

function mapTables(bases, tableId, change) {
  return (bases || []).map((base) => ({
    ...base,
    tables: (base.tables || []).map((table) => (table.id === tableId ? change(table) : table)),
  }))
}

export function withRow(bases, tableId, nextRow) {
  return mapTables(bases, tableId, (table) => {
    const rows = table.rows || []
    const exists = rows.some((item) => item.id === nextRow.id)
    return { ...table, rows: exists ? rows.map((item) => (item.id === nextRow.id ? nextRow : item)) : [...rows, nextRow] }
  })
}

export function withoutRow(bases, tableId, rowId) {
  return mapTables(bases, tableId, (table) => ({ ...table, rows: (table.rows || []).filter((item) => item.id !== rowId) }))
}

export function withView(bases, tableId, nextView) {
  return mapTables(bases, tableId, (table) => {
    const views = table.views || []
    const exists = views.some((item) => item.id === nextView.id)
    return { ...table, views: exists ? views.map((item) => (item.id === nextView.id ? nextView : item)) : [...views, nextView] }
  })
}

export function withField(bases, tableId, nextField) {
  return mapTables(bases, tableId, (table) => ({
    ...table,
    fields: [...(table.fields || []), { ...nextField, position: (table.fields || []).length }],
  }))
}

export function withTable(bases, registerId, nextTable) {
  return (bases || []).map((base) => (base.id === registerId
    ? { ...base, tables: [...(base.tables || []), { ...nextTable, position: (base.tables || []).length, rows: nextTable.rows || [], views: nextTable.views || [view('All records', {}, 0)], fields: nextTable.fields || [] }] }
    : base))
}

export function withBasePatch(bases, id, patch) {
  return (bases || []).map((base) => (base.id === id ? { ...base, ...patch } : base))
}
