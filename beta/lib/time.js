export function perthDateTimeLocal(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

export function perthDate(date = new Date()) {
  return perthDateTimeLocal(date).slice(0, 10)
}

export function shiftDate(isoDate, days) {
  const [year, month, day] = String(isoDate || '').split('-').map(Number)
  if (!year || !month || !day) return perthDate()
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  return `${next.getUTCFullYear()}-${mm}-${dd}`
}

export function formatWhen(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} AWST`
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)} AWST`
}
