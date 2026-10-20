import { generateId } from '../../src/utils/storage.js'
import { isOverdue } from './actions.js'
import { recordDay } from './day.js'
import { LEAD_TARGETS } from './leads.js'
import { matrixRows, trainingState } from './training.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

function inRange(day, from, to) {
  return DATE.test(String(day || '')) && day >= from && day <= to
}

function daysBetween(start, end) {
  if (!DATE.test(start) || !DATE.test(end)) return 0
  const [y, m, d] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000)
}

function tally(rows, keyOf) {
  const counts = new Map()
  for (const row of rows) {
    const key = String(keyOf(row) || 'Not set')
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function siteOf(row) {
  return String(row?.fields?.siteArea || '').trim()
}

function matchesSite(row, site) {
  if (!site) return true
  return siteOf(row) === site
}

export function hoursError(fields) {
  if (!DATE.test(String(fields?.from || '')) || !DATE.test(String(fields?.to || ''))) return 'Add the date range for the hours.'
  if (fields.from > fields.to) return 'The start date is after the end date.'
  const hours = Number(fields?.hours)
  if (!Number.isFinite(hours) || hours <= 0) return 'Enter the hours worked.'
  return ''
}

export function buildHoursRecord({ id, ruleset = 'general', fields }) {
  const problem = hoursError(fields)
  if (problem) throw new Error(problem)
  const now = new Date().toISOString()
  const hours = Number(fields.hours)
  return {
    id: id || generateId(),
    kind: 'hours',
    source: 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: null,
    status: 'filed',
    fields: {
      title: `${hours} hours`,
      siteArea: String(fields.siteArea || '').trim(),
      from: fields.from,
      to: fields.to,
      hours,
      occurredAt: `${fields.from}T00:00`,
      note: `${fields.from} to ${fields.to}`,
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

function caseStart(item) {
  const restricted = String(item?.restrictedFrom || '')
  if (DATE.test(restricted)) return restricted
  const created = String(item?.createdAt || '').slice(0, 10)
  return DATE.test(created) ? created : ''
}

export function daysLost(item, today) {
  if (item?.classification !== 'LTI') return 0
  const start = caseStart(item)
  if (!start) return 0
  const back = String(item?.rtwOn || '')
  if (DATE.test(back)) return Math.max(0, daysBetween(start, back))
  if (!DATE.test(String(today || '')) || today < start) return 0
  return daysBetween(start, today) + 1
}

function rate(count, hours) {
  if (!hours) return null
  return Math.round((count * 1000000) / hours * 10) / 10
}

export function dashboardSummary(rows, cases, { from, to, site = '', today, columns = [] } = {}) {
  const list = rows || []
  const incidents = list.filter((row) => row.kind === 'incident' && inRange(recordDay(row), from, to) && matchesSite(row, site))
  const actions = list.filter((row) => row.kind === 'action' && matchesSite(row, site))
  const openActions = actions.filter((row) => row.status !== 'done')
  const closedActions = actions.filter((row) => row.status === 'done' && inRange(String(row.fields?.closedOn || recordDay(row)), from, to))
  const overdue = openActions.filter((row) => isOverdue(row, today))
  const inspections = list.filter((row) => row.kind === 'inspection' && inRange(recordDay(row), from, to) && matchesSite(row, site))
  const weeks = Math.max(1, Math.ceil((daysBetween(from, to) + 1) / 7))
  const inspectionTarget = (LEAD_TARGETS.find((item) => item.id === 'inspection')?.target || 0) * weeks

  const incidentById = new Map(list.filter((row) => row.kind === 'incident').map((row) => [row.id, row]))
  const injuryRows = (cases || []).filter((item) => {
    const incident = incidentById.get(item.eventId)
    const day = incident ? recordDay(incident) : String(item.createdAt || '').slice(0, 10)
    if (!inRange(day, from, to)) return false
    if (!site) return true
    return incident ? siteOf(incident) === site : false
  })
  const countClass = (code) => injuryRows.filter((item) => item.classification === code).length
  const lti = countClass('LTI')
  const mti = countClass('MTI')
  const fai = countClass('FAI')
  const rwi = countClass('RWI')
  const hours = list.filter((row) => row.kind === 'hours').reduce((sum, row) => {
    const start = String(row.fields?.from || '')
    const end = String(row.fields?.to || '')
    if (!DATE.test(start) || !DATE.test(end) || end < from || start > to) return sum
    if (site && siteOf(row) && siteOf(row) !== site) return sum
    return sum + Number(row.fields?.hours || 0)
  }, 0)

  const training = list.filter((row) => row.kind === 'training')
  const states = { current: 0, expiring: 0, expired: 0 }
  for (const row of training) states[trainingState(row, today)] += 1
  const missing = matrixRows(training, columns, today).reduce((sum, row) => sum + row.cells.filter((cell) => cell === 'gap').length, 0)

  const leadRows = list.filter((row) => !site || matchesSite(row, site) || !siteOf(row))
  const leads = LEAD_TARGETS.map((item) => {
    let count = 0
    if (item.id === 'onTime') {
      count = list.filter((row) => row.kind === 'action' && row.status === 'done' && inRange(row.fields?.closedOn, from, to) && String(row.fields?.closedOn || '') <= String(row.fields?.due || '') && matchesSite(row, site)).length
    } else if (item.id === 'observation') {
      count = leadRows.filter((row) => row.kind === 'hazard' && inRange(recordDay(row), from, to)).length
    } else {
      count = leadRows.filter((row) => row.kind === item.id && inRange(recordDay(row), from, to)).length
    }
    const target = item.target * weeks
    return { id: item.id, label: item.label, count, target, met: count >= target }
  })

  return {
    incidents: {
      total: incidents.length,
      byType: tally(incidents, (row) => row.fields?.incidentType),
      bySeverity: tally(incidents, (row) => row.severity ? `Severity ${row.severity}` : 'Not set'),
      bySite: tally(incidents, (row) => siteOf(row)),
      byMonth: tally(incidents, (row) => recordDay(row).slice(0, 7)),
      rows: incidents,
    },
    actions: { open: openActions.length, closed: closedActions.length, overdue: overdue.length, rows: [...overdue, ...openActions.filter((row) => !isOverdue(row, today))].slice(0, 12) },
    injury: {
      FAI: fai,
      MTI: mti,
      LTI: lti,
      RWI: rwi,
      daysLost: injuryRows.reduce((sum, item) => sum + daysLost(item, today), 0),
      hours,
      ltifr: rate(lti, hours),
      trifr: rate(lti + mti + rwi, hours),
      rows: injuryRows,
    },
    inspections: { done: inspections.length, planned: inspectionTarget, rows: inspections },
    leads,
    training: { ...states, missing },
  }
}

export function siteOptions(rows) {
  return [...new Set((rows || []).map(siteOf).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
