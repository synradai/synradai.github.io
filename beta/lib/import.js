import { buildActionRecord } from './actions.js'
import { buildPerson } from './people.js'
import { buildRecord } from './record.js'
import { buildTrainingRecord } from './training.js'

export const IMPORT_TARGETS = {
  training: {
    label: 'Training records',
    fields: [
      { key: 'person', label: 'Person', required: true },
      { key: 'role', label: 'Role', required: true },
      { key: 'course', label: 'Course', required: true },
      { key: 'completed', label: 'Completed' },
      { key: 'expiry', label: 'Expiry' },
      { key: 'siteArea', label: 'Area' },
    ],
  },
  people: {
    label: 'People',
    fields: [
      { key: 'fullName', label: 'Name', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
  },
  actions: {
    label: 'Actions',
    fields: [
      { key: 'title', label: 'Action', required: true },
      { key: 'owner', label: 'Owner', required: true },
      { key: 'due', label: 'Due', required: true },
      { key: 'note', label: 'Note' },
    ],
  },
  incidents: {
    label: 'Incidents',
    fields: [
      { key: 'description', label: 'Description', required: true },
      { key: 'occurredAt', label: 'When' },
      { key: 'siteArea', label: 'Area' },
      { key: 'incidentType', label: 'Type' },
      { key: 'actualSeverity', label: 'Actual severity', required: true },
      { key: 'potentialSeverity', label: 'Potential severity', required: true },
      { key: 'peopleRoles', label: 'People and roles' },
    ],
  },
}

const ALIASES = {
  person: ['person', 'name', 'worker', 'employee', 'full name', 'fullname'],
  fullName: ['full name', 'fullname', 'name', 'person', 'worker', 'employee'],
  role: ['role', 'job', 'position', 'job title'],
  course: ['course', 'ticket', 'training', 'competency', 'qualification'],
  completed: ['completed', 'completed on', 'date completed', 'completion', 'trained'],
  expiry: ['expiry', 'expires', 'expiry date', 'expires on', 'valid to'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'mobile', 'phone number'],
  title: ['title', 'action', 'task', 'what'],
  owner: ['owner', 'responsible', 'assignee', 'assigned to'],
  due: ['due', 'due date', 'deadline'],
  note: ['note', 'notes', 'comment', 'comments'],
  description: ['description', 'what happened', 'details', 'incident'],
  occurredAt: ['occurred', 'occurred at', 'when', 'date', 'datetime'],
  siteArea: ['area', 'site area', 'location', 'site'],
  incidentType: ['type', 'incident type', 'category'],
  actualSeverity: ['actual severity', 'actual', 'severity'],
  potentialSeverity: ['potential severity', 'potential'],
  peopleRoles: ['people and roles', 'people', 'involved'],
}

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const filled = rows.filter((item) => item.some((value) => String(value).trim()))
  if (!filled.length) return { headers: [], rows: [] }
  return {
    headers: filled[0].map((header) => String(header).trim()),
    rows: filled.slice(1).map((item) => item.map((value) => String(value).trim())),
  }
}

export function guessMap(headers, target) {
  const fields = IMPORT_TARGETS[target]?.fields || []
  const map = {}
  const used = new Set()
  for (const field of fields) {
    const aliases = ALIASES[field.key] || [norm(field.label)]
    const index = (headers || []).findIndex((header, column) => !used.has(column) && aliases.includes(norm(header)))
    if (index >= 0) {
      map[field.key] = index
      used.add(index)
    }
  }
  return map
}

export function missingMapped(target, map) {
  return (IMPORT_TARGETS[target]?.fields || [])
    .filter((field) => field.required && (map?.[field.key] === '' || map?.[field.key] == null))
    .map((field) => field.label)
}

function pick(headers, cells, map) {
  const fields = {}
  for (const [key, column] of Object.entries(map || {})) {
    if (column === '' || column == null || Number(column) < 0) continue
    fields[key] = String(cells?.[column] ?? '').trim()
  }
  return fields
}

function asDate(value) {
  const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : String(value || '').trim()
}

function asWhen(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  if (match) return `${match[1]}T${match[2]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T08:00`
  return text
}

function normalise(target, fields, siteName) {
  const next = { ...fields }
  if (target === 'training') {
    next.completed = asDate(next.completed)
    next.expiry = asDate(next.expiry)
    if (!String(next.siteArea || '').trim()) next.siteArea = siteName || ''
  }
  if (target === 'actions') next.due = asDate(next.due)
  if (target === 'incidents') {
    next.occurredAt = asWhen(next.occurredAt)
    if (!String(next.siteArea || '').trim()) next.siteArea = siteName || ''
  }
  return next
}

export function planImport({ target, headers, rows, map, siteName, siteId, ruleset = 'general' }) {
  return (rows || []).map((cells, index) => {
    const fields = normalise(target, pick(headers, cells, map), siteName)
    let error = ''
    let record = null
    let person = null
    try {
      if (target === 'incidents' && !String(fields.description || '').trim()) throw new Error('Add the description.')
      if (target === 'incidents') {
        for (const [key, label] of [['actualSeverity', 'Actual severity'], ['potentialSeverity', 'Potential severity']]) {
          const level = Number(fields[key])
          if (!(level >= 1 && level <= 5)) throw new Error(`${label} must be from 1 to 5.`)
        }
      }
      if (target === 'people') person = buildPerson({ siteId, fields })
      else if (target === 'training') record = { ...buildTrainingRecord({ ruleset, fields }), siteId: siteId || '', source: 'import' }
      else if (target === 'actions') record = { ...buildActionRecord({ ruleset, fields }), siteId: siteId || '', source: 'import' }
      else if (target === 'incidents') record = { ...buildRecord({ kind: 'incident', ruleset, fields, source: 'import' }), siteId: siteId || '' }
      else error = 'Choose what to import.'
    } catch (err) {
      error = err?.message || 'Could not import this row.'
    }
    return { index: index + 2, cells, fields, error, record, person }
  })
}

export function errorReportCsv(headers, planned) {
  const failed = (planned || []).filter((row) => row.error)
  const head = ['row', 'error', ...(headers || [])]
  const lines = [head, ...failed.map((row) => [row.index, row.error, ...(row.cells || [])])]
  return lines.map((line) => line.map(csvCell).join(',')).join('\n')
}

function airtableCell(value) {
  if (Array.isArray(value)) return value.map((item) => airtableCell(item)).filter(Boolean).join(', ')
  if (value && typeof value === 'object') return String(value.name || value.url || value.email || '')
  return String(value ?? '')
}

export function tableFromAirtable(payload) {
  const headers = Array.isArray(payload?.fields) ? payload.fields.map((field) => String(field)) : []
  const rows = (payload?.rows || []).map((row) => headers.map((header) => airtableCell(row?.fields?.[header])))
  return { headers, rows }
}
