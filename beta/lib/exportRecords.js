import { recordDay, recordTime, timelineDetail, timelineTitle } from './day.js'
import { injuryLabel } from './injury.js'

function cell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function recordsInRange(rows, from, to) {
  const start = from && to && from > to ? to : from
  const end = from && to && from > to ? from : to
  return (rows || [])
    .filter((row) => {
      const day = recordDay(row)
      if (!day) return false
      if (start && day < start) return false
      if (end && day > end) return false
      return true
    })
    .sort((a, b) => recordDay(a).localeCompare(recordDay(b)) || recordTime(a).localeCompare(recordTime(b)) || String(a.id).localeCompare(String(b.id)))
}

export function projectRecord(row, cases) {
  const labels = (cases || [])
    .filter((item) => item.eventId === row.id)
    .map((item) => injuryLabel(item))
  return {
    day: recordDay(row),
    time: recordTime(row),
    kind: row.kind || '',
    title: timelineTitle(row),
    status: row.status || '',
    site: row.fields?.siteArea || '',
    summary: timelineDetail(row),
    cases: labels.join(' | '),
  }
}

const COLUMNS = ['day', 'time', 'kind', 'title', 'status', 'site', 'summary', 'cases']

export function recordsToCsv(rows) {
  const lines = [COLUMNS.join(',')]
  for (const row of rows || []) {
    lines.push(COLUMNS.map((key) => cell(row[key])).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function recordsToPdfBody(rows) {
  if (!rows?.length) return 'No records in this range.'
  return rows.map((row) => {
    const cases = row.cases ? `\nCases: ${row.cases}` : ''
    return `${row.day} ${row.time} · ${row.kind} · ${row.title} · ${row.status}\n${row.site}\n${row.summary}${cases}`
  }).join('\n\n')
}
