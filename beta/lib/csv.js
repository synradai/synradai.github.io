const COLUMNS = [
  ['id', (row) => row.id],
  ['kind', (row) => row.kind],
  ['status', (row) => row.status],
  ['severity', (row) => row.severity ?? ''],
  ['path', (row) => row.path || ''],
  ['occurredAt', (row) => row.fields?.occurredAt || ''],
  ['siteArea', (row) => row.fields?.siteArea || ''],
  ['peopleRoles', (row) => row.fields?.peopleRoles || ''],
  ['description', (row) => row.fields?.description || row.fields?.task || ''],
  ['immediateActions', (row) => row.fields?.immediateActions || ''],
  ['flags', (row) => (row.flags || []).map((flag) => `${flag.instrument} ${flag.pinpoint}`).join(' | ')],
  ['reporter', (row) => row.fields?.reporter || ''],
]

function cell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(rows) {
  const lines = [COLUMNS.map(([name]) => name).join(',')]
  for (const row of rows || []) {
    lines.push(COLUMNS.map(([, read]) => cell(read(row))).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function filterRecords(rows, query = {}) {
  const search = String(query.search || '').trim().toLowerCase()
  return (rows || []).filter((row) => {
    if (query.kind && query.kind !== 'all' && row.kind !== query.kind) return false
    if (query.status && query.status !== 'all' && row.status !== query.status) return false
    if (query.severity && query.severity !== 'all' && String(row.severity) !== String(query.severity)) return false
    const when = String(row.fields?.occurredAt || row.createdAt || '')
    if (query.from && when < String(query.from)) return false
    if (query.to && when.slice(0, 10) > String(query.to)) return false
    if (search) {
      const hay = JSON.stringify(row.fields || {}).toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}
