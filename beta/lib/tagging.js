// Western Australian quarterly tagging. Red Dec–Feb, green Mar–May,
// blue Jun–Aug, yellow Sep–Nov. Dates are read in Australia/Perth.

import { perthDate } from './time.js'

export const TAG_COLOURS = [
  { id: 'red', label: 'Red', color: '#d92d20', months: [12, 1, 2], season: 'Dec–Feb' },
  { id: 'green', label: 'Green', color: '#1f8a4c', months: [3, 4, 5], season: 'Mar–May' },
  { id: 'blue', label: 'Blue', color: '#2458a8', months: [6, 7, 8], season: 'Jun–Aug' },
  { id: 'yellow', label: 'Yellow', color: '#ca8a04', months: [9, 10, 11], season: 'Sep–Nov' },
]

export function tagOptions() {
  return TAG_COLOURS.map(({ id, label, color }) => ({ id, label, color }))
}

function parts(input) {
  const iso = input instanceof Date ? perthDate(input) : String(input || '').slice(0, 10)
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month, day, iso }
}

export function quarterTag(input) {
  const when = parts(input)
  if (!when) return TAG_COLOURS[3]
  return TAG_COLOURS.find((item) => item.months.includes(when.month)) || TAG_COLOURS[3]
}

function lastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function quarterBounds(input) {
  const when = parts(input) || parts(new Date())
  const tag = quarterTag(when.iso)
  let startYear = when.year
  let startMonth = tag.months[0]
  if (tag.id === 'red') {
    startMonth = 12
    startYear = when.month === 12 ? when.year : when.year - 1
  }
  const endMonth = tag.months[tag.months.length - 1]
  const endYear = endMonth < startMonth ? startYear + 1 : startYear
  const pad = (value) => String(value).padStart(2, '0')
  return {
    tag,
    start: `${startYear}-${pad(startMonth)}-01`,
    end: `${endYear}-${pad(endMonth)}-${pad(lastDay(endYear, endMonth))}`,
  }
}

export function addMonths(iso, months) {
  const when = parts(iso)
  if (!when) return ''
  const total = when.month - 1 + Number(months || 0)
  const year = when.year + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const day = Math.min(when.day, lastDay(year, month + 1))
  const pad = (value) => String(value).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function sameColour(value, tag) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return text === tag.id || text === tag.label.toLowerCase()
}

export function fieldByName(table, name) {
  const want = String(name || '').toLowerCase()
  return (table?.fields || []).find((item) => String(item.name || '').toLowerCase() === want) || null
}

export function tableCheck(table) {
  const names = new Set((table?.fields || []).map((item) => item.name))
  if (names.has('Tag colour') && names.has('Tagged on')) return 'tag'
  if (names.has('Last service')) return 'service'
  if (names.has('On hire')) return 'hire'
  if (names.has('Out on') && names.has('Status')) return 'oos'
  return ''
}

export function rowUse(table, values, now = new Date()) {
  if (values?._oos) return { state: 'locked', label: 'OUT OF SERVICE', tone: 'hazard', reason: 'Out of service' }
  const kind = tableCheck(table)
  if (kind === 'tag') return tagUse(table, values, now)
  if (kind === 'service') return serviceUse(table, values, now)
  if (kind === 'hire') return hireUse(table, values, now)
  if (kind === 'oos') return oosUse(table, values)
  return null
}

function tagUse(table, values, now) {
  const due = quarterBounds(now)
  const colour = values?.[fieldByName(table, 'Tag colour')?.id]
  const tagged = String(values?.[fieldByName(table, 'Tagged on')?.id] || '').slice(0, 10)
  const colourOk = sameColour(colour, due.tag)
  const dateOk = Boolean(tagged) && tagged >= due.start && tagged <= due.end
  if (colourOk && dateOk) return { state: 'in_date', label: 'In date', tone: 'ok', due: due.tag, reason: '' }
  let reason = 'No quarterly tag'
  if (colour && !colourOk) reason = 'Wrong colour'
  else if (colourOk && !dateOk) reason = tagged ? 'Expired tag' : 'No tag date'
  else if (!colour && tagged) reason = 'No tag colour'
  return { state: 'locked', label: 'LOCKED OUT', tone: 'lock', due: due.tag, reason }
}

function serviceUse(table, values, now) {
  const last = String(values?.[fieldByName(table, 'Last service')?.id] || '').slice(0, 10)
  const today = perthDate(now)
  if (!last) return { state: 'due', label: 'SERVICE DUE', tone: 'due', next: '', reason: 'No service date' }
  const next = addMonths(last, 6)
  if (next < today) return { state: 'due', label: 'SERVICE DUE', tone: 'due', next, reason: 'More than 6 months' }
  return { state: 'ok', label: 'In date', tone: 'ok', next, reason: '' }
}

function hireUse(table, values, now) {
  const on = String(values?.[fieldByName(table, 'On hire')?.id] || '').slice(0, 10)
  const off = String(values?.[fieldByName(table, 'Off hire')?.id] || '').slice(0, 10)
  const today = perthDate(now)
  if (!on || (off && off <= today)) return { state: 'off', label: 'Off hire', tone: 'muted', reason: '' }
  return { state: 'on', label: 'On hire', tone: 'ok', reason: '' }
}

function oosUse(table, values) {
  const status = values?.[fieldByName(table, 'Status')?.id]
  if (status === 'Returned') return { state: 'ok', label: 'Returned', tone: 'ok', reason: '' }
  return { state: 'locked', label: 'OUT OF SERVICE', tone: 'hazard', reason: 'Out of service' }
}

export function matchesUse(table, values, use, now = new Date()) {
  if (!use) return true
  const check = rowUse(table, values, now)
  if (use === 'locked') return check?.state === 'locked'
  if (use === 'in_date') return check?.state === 'in_date'
  if (use === 'due') return check?.state === 'due'
  if (use === 'on_hire') return check?.state === 'on'
  if (use === 'off_hire') return check?.state === 'off'
  return true
}
