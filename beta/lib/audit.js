import { perthDate } from './time.js'

function cell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function auditDay(event) {
  if (!event?.created_at) return ''
  const date = new Date(event.created_at)
  if (Number.isNaN(date.getTime())) return String(event.created_at).slice(0, 10)
  return perthDate(date)
}

export function filterAudit(events, query = {}) {
  const action = query.action && query.action !== 'all' ? query.action : ''
  const entity = query.entity && query.entity !== 'all' ? query.entity : ''
  const day = String(query.day || '')
  return (events || []).filter((event) => {
    if (action && event.action !== action) return false
    if (entity && event.entity !== entity) return false
    if (day && auditDay(event) !== day) return false
    return true
  })
}

export function auditToCsv(events) {
  const columns = ['when', 'action', 'entity', 'entity_id', 'summary', 'actor_id', 'before', 'after']
  const lines = [columns.join(',')]
  for (const event of events || []) {
    const row = [
      event.created_at || '',
      event.action || '',
      event.entity || '',
      event.entity_id || '',
      event.summary || '',
      event.actor_id || '',
      event.before ? JSON.stringify(event.before) : '',
      event.after ? JSON.stringify(event.after) : '',
    ]
    lines.push(row.map(cell).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}
