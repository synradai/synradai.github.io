import { generateId } from '../../src/utils/storage.js'

export const CLASSIFICATIONS = [
  ['FAI', 'FAI — first aid'],
  ['MTI', 'MTI — medical treatment'],
  ['LTI', 'LTI — lost time'],
  ['RWI', 'RWI — restricted work'],
]

export const INJURY_STATUSES = [
  ['open', 'Open'],
  ['restricted', 'Restricted'],
  ['returned', 'Returned'],
  ['closed', 'Closed'],
]

const DATE = /^\d{4}-\d{2}-\d{2}$/

function daysBetween(start, end) {
  if (!DATE.test(start) || !DATE.test(end)) return 0
  const [y, m, d] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000)
}

export function absenceDays(item, today) {
  const start = DATE.test(String(item?.restrictedFrom || '')) ? item.restrictedFrom : ''
  if (!start) return { lost: 0, restricted: 0 }
  const returned = DATE.test(String(item?.rtwOn || ''))
  const end = returned ? item.rtwOn : (DATE.test(String(today || '')) && today >= start ? today : '')
  if (!end || end < start) return { lost: 0, restricted: 0 }
  const span = daysBetween(start, end) + (returned ? 0 : 1)
  if (item.classification === 'LTI') return { lost: span, restricted: 0 }
  return { lost: 0, restricted: span }
}
const CLASS_SET = new Set(CLASSIFICATIONS.map(([id]) => id))
const STATUS_SET = new Set(INJURY_STATUSES.map(([id]) => id))

export function injuryError(fields) {
  if (!String(fields?.eventId || '').trim()) return 'Link the case to an incident.'
  if (!String(fields?.personName || '').trim()) return 'Add the person. Only you and organisation admins can see the name.'
  if (!CLASS_SET.has(fields?.classification)) return 'Choose FAI, MTI, LTI, or RWI.'
  if (fields?.status && !STATUS_SET.has(fields.status)) return 'Choose a status.'
  return ''
}

export function toPublicCase(row) {
  return {
    id: row.id,
    caseCode: row.case_code || row.caseCode || '',
    eventId: row.event_id || row.eventId || '',
    classification: row.classification || '',
    status: row.status || 'open',
    restrictedFrom: row.restricted_from || row.restrictedFrom || '',
    rtwOn: row.rtw_on || row.rtwOn || '',
    reviewOn: row.review_on || row.reviewOn || '',
    createdAt: row.created_at || row.createdAt || '',
    private: false,
  }
}

export function toPrivateCase(row) {
  return {
    ...toPublicCase(row),
    private: true,
    personName: row.person_name || row.personName || '',
    bodyPart: row.body_part || row.bodyPart || '',
    treatment: row.treatment || '',
    note: row.note || '',
    mechanism: row.mechanism || '',
    duties: row.duties || '',
    caseNotes: row.case_notes || row.caseNotes || '',
    userId: row.user_id || row.userId || '',
  }
}

export function mergeInjury(indexRows, privateRows) {
  const map = new Map()
  for (const row of indexRows || []) {
    if (row?.id) map.set(row.id, toPublicCase(row))
  }
  for (const row of privateRows || []) {
    if (row?.id) map.set(row.id, toPrivateCase(row))
  }
  return [...map.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(a.caseCode).localeCompare(String(b.caseCode)))
}

export function injuryLabel(item) {
  return [item?.caseCode || 'Case', item?.classification, item?.status].filter(Boolean).join(' · ')
}

export function casesForEvent(cases, eventId) {
  return (cases || []).filter((item) => item.eventId === eventId)
}

export function nextCaseCode(cases) {
  const max = (cases || []).reduce((highest, row) => {
    const match = String(row.caseCode || '').match(/(\d+)$/)
    return Math.max(highest, match ? Number(match[1]) : 0)
  }, 0)
  return `INJ-${String(max + 1).padStart(4, '0')}`
}

export function injuryPayload(fields) {
  const dateOrNull = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null)
  return {
    event_id: String(fields.eventId || '').trim(),
    person_name: String(fields.personName || '').trim(),
    body_part: String(fields.bodyPart || '').trim(),
    treatment: String(fields.treatment || '').trim(),
    classification: fields.classification,
    status: fields.status || 'open',
    restricted_from: dateOrNull(fields.restrictedFrom),
    rtw_on: dateOrNull(fields.rtwOn),
    note: String(fields.note || '').trim(),
    mechanism: String(fields.mechanism || '').trim(),
    duties: String(fields.duties || '').trim(),
    case_notes: String(fields.caseNotes || '').trim(),
    review_on: dateOrNull(fields.reviewOn),
  }
}

export function blankInjury(eventId) {
  return {
    id: generateId(),
    eventId: eventId || '',
    personName: '',
    bodyPart: '',
    treatment: '',
    classification: 'FAI',
    status: 'open',
    restrictedFrom: '',
    rtwOn: '',
    note: '',
    mechanism: '',
    duties: '',
    caseNotes: '',
    reviewOn: '',
  }
}
