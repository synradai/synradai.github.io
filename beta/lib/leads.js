import { recordDay } from './day.js'
import { shiftDate } from './time.js'

export const LEAD_TARGETS = [
  { id: 'prestart', label: 'Prestarts', target: 5 },
  { id: 'toolbox', label: 'Toolbox talks', target: 1 },
  { id: 'inspection', label: 'Inspections', target: 1 },
  { id: 'observation', label: 'Observations', target: 3 },
  { id: 'onTime', label: 'Actions closed on time', target: 1 },
]

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function weekStarting(day) {
  if (!DATE.test(String(day || ''))) return ''
  const [year, month, date] = day.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay()
  const back = weekday === 0 ? 6 : weekday - 1
  return shiftDate(day, -back)
}

function inSpan(value, start, end) {
  const day = String(value || '').slice(0, 10)
  return DATE.test(day) && day >= start && day <= end
}

export function leadCounts(rows, start) {
  const end = shiftDate(start, 6)
  const list = rows || []
  const countKind = (kind) => list.filter((row) => row.kind === kind && inSpan(recordDay(row), start, end)).length
  const onTime = list.filter((row) => {
    if (row.kind !== 'action' || row.status !== 'done') return false
    const closed = String(row.fields?.closedOn || '')
    const due = String(row.fields?.due || '')
    return inSpan(closed, start, end) && DATE.test(due) && closed <= due
  }).length
  return {
    start,
    end,
    prestart: countKind('prestart'),
    toolbox: countKind('toolbox'),
    inspection: countKind('inspection'),
    observation: countKind('hazard'),
    onTime,
  }
}
