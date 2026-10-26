import { generateId } from '../../src/utils/storage.js'
import { shiftDate } from './time.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function courseList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;|\n]/)
  const seen = []
  for (const item of source) {
    const text = String(item || '').trim()
    if (text && !seen.some((existing) => existing.toLowerCase() === text.toLowerCase())) seen.push(text)
  }
  return seen
}

export function coursesOn(fields) {
  const many = courseList(fields?.courses)
  if (many.length) return many
  return courseList(fields?.course)
}

export function trainingError(fields) {
  if (!String(fields?.person || '').trim()) return 'Add the person.'
  if (!String(fields?.role || '').trim()) return 'Add the role.'
  if (!String(fields?.siteArea || '').trim()) return 'Add the site.'
  if (!coursesOn(fields).length) return 'Add the course or ticket.'
  if (fields?.completed && !DATE.test(fields.completed)) return 'Completed date is not a date.'
  if (fields?.expiry && !DATE.test(fields.expiry)) return 'Expiry is not a date.'
  if (!fields?.completed && !fields?.expiry) return 'Add a completed date or an expiry.'
  return ''
}

export function buildTrainingRecord({ id, ruleset = 'general', fields }) {
  const problem = trainingError(fields)
  if (problem) throw new Error(problem)
  const now = new Date().toISOString()
  const person = String(fields.person).trim()
  const role = String(fields.role).trim()
  const courses = coursesOn(fields)
  const course = courses.join(', ')
  return {
    id: id || generateId(),
    kind: 'training',
    source: 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: null,
    status: 'filed',
    fields: {
      title: course,
      person,
      role,
      course,
      courses,
      siteArea: String(fields.siteArea || '').trim(),
      completed: fields.completed || '',
      expiry: fields.expiry || '',
      occurredAt: fields.completed ? `${fields.completed}T08:00` : now.slice(0, 16),
      note: `${person} · ${role}`,
    },
    links: [],
    flags: [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
}

export function trainingState(row, today) {
  const expiry = String(row?.fields?.expiry || '')
  if (!DATE.test(expiry) || !DATE.test(String(today || ''))) return 'current'
  if (expiry < today) return 'expired'
  if (expiry <= shiftDate(today, 30)) return 'expiring'
  return 'current'
}

const STATE_RANK = { current: 3, expiring: 2, expired: 1, missing: 0 }
const STATE_LABEL = { current: 'Current', expiring: 'Expiring', expired: 'Expired', missing: 'Missing' }

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function trainingFilters(records) {
  const training = (records || []).filter((row) => row.kind === 'training')
  const unique = (key) => [...new Set(training.map((row) => String(row.fields?.[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return { sites: unique('siteArea'), roles: unique('role') }
}

export function personMatrix(records, columns, today, filter = {}) {
  const site = String(filter.site || '').trim()
  const role = String(filter.role || '').trim()
  const training = (records || []).filter((row) => {
    if (row.kind !== 'training') return false
    if (site && String(row.fields?.siteArea || '').trim() !== site) return false
    if (role && String(row.fields?.role || '').trim() !== role) return false
    return true
  })
  const people = [...new Set(training.map((row) => String(row.fields?.person || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return people.map((person) => ({
    person,
    cells: (columns || []).map((course) => {
      const matches = training.filter((row) => row.fields?.person === person && coursesOn(row.fields).some((item) => item.toLowerCase() === String(course).toLowerCase()))
      if (!matches.length) return { state: 'missing', id: '' }
      const best = matches.slice().sort((a, b) => {
        const diff = STATE_RANK[trainingState(b, today)] - STATE_RANK[trainingState(a, today)]
        if (diff) return diff
        return String(b.fields?.expiry || '').localeCompare(String(a.fields?.expiry || ''))
      })[0]
      return { state: trainingState(best, today), id: best.id }
    }),
  }))
}

export function personMatrixCsv(people, columns) {
  const header = ['Person', ...(columns || [])]
  const lines = [header.map(csvCell).join(',')]
  for (const row of people || []) {
    const states = (row.cells || []).map((cell) => STATE_LABEL[cell.state] || cell.state)
    lines.push([row.person, ...states].map(csvCell).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function matrixRows(records, columns, today) {
  const training = (records || []).filter((row) => row.kind === 'training')
  const roles = [...new Set(training.map((row) => String(row.fields?.role || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return roles.map((role) => ({
    role,
    cells: (columns || []).map((course) => {
      const matches = training.filter((row) => row.fields?.role === role && coursesOn(row.fields).some((item) => item.toLowerCase() === String(course).toLowerCase()))
      if (!matches.length || matches.every((row) => trainingState(row, today) === 'expired')) return 'gap'
      if (matches.some((row) => trainingState(row, today) === 'current')) return 'covered'
      return 'expiring'
    }),
  }))
}
