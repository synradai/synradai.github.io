import { generateId } from '../../src/utils/storage.js'
import { shiftDate } from './time.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function trainingError(fields) {
  if (!String(fields?.person || '').trim()) return 'Add the person.'
  if (!String(fields?.role || '').trim()) return 'Add the role.'
  if (!String(fields?.course || '').trim()) return 'Add the course or ticket.'
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
  const course = String(fields.course).trim()
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

export function matrixRows(records, columns, today) {
  const training = (records || []).filter((row) => row.kind === 'training')
  const roles = [...new Set(training.map((row) => String(row.fields?.role || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return roles.map((role) => ({
    role,
    cells: (columns || []).map((course) => {
      const matches = training.filter((row) => row.fields?.role === role && row.fields?.course === course)
      if (!matches.length || matches.every((row) => trainingState(row, today) === 'expired')) return 'gap'
      if (matches.some((row) => trainingState(row, today) === 'current')) return 'covered'
      return 'expiring'
    }),
  }))
}
