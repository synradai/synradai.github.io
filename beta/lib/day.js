import { perthDate, perthDateTimeLocal } from './time.js'

export const TIMELINE_LABELS = {
  incident: 'Incident',
  hazard: 'Hazard',
  take5: 'Take 5',
  'scene-check': 'Scene check',
  meeting: 'Meeting',
  prestart: 'Prestart',
  toolbox: 'Toolbox talk',
}

export const QUICK_ADD = [
  { id: 'incident', label: 'Incident', full: true },
  { id: 'hazard', label: 'Hazard', full: true },
  { id: 'take5', label: 'Take 5', full: true },
  { id: 'meeting', label: 'Meeting', full: false, title: 'Meeting' },
  { id: 'prestart', label: 'Prestart', full: false, title: 'Prestart' },
  { id: 'toolbox', label: 'Toolbox talk', full: false, title: 'Topic' },
]

export function recordDay(row) {
  const occurred = String(row?.fields?.occurredAt || '')
  if (/^\d{4}-\d{2}-\d{2}/.test(occurred)) return occurred.slice(0, 10)
  if (row?.createdAt) {
    const date = new Date(row.createdAt)
    if (!Number.isNaN(date.getTime())) return perthDate(date)
  }
  return ''
}

export function recordTime(row) {
  const occurred = String(row?.fields?.occurredAt || '')
  const match = occurred.match(/T(\d{2}:\d{2})/)
  if (match) return match[1]
  if (row?.createdAt) {
    const date = new Date(row.createdAt)
    if (!Number.isNaN(date.getTime())) return perthDateTimeLocal(date).slice(11, 16)
  }
  return ''
}

export function recordsForDay(rows, day) {
  return (rows || [])
    .filter((row) => recordDay(row) === day)
    .sort((a, b) => recordTime(a).localeCompare(recordTime(b)) || String(a.id).localeCompare(String(b.id)))
}

export function timelineTitle(row) {
  const fields = row?.fields || {}
  return fields.title || fields.topic || fields.task || fields.siteArea || TIMELINE_LABELS[row?.kind] || row?.kind || 'Record'
}

export function timelineDetail(row) {
  const fields = row?.fields || {}
  return fields.description || fields.note || fields.task || fields.topic || ''
}
