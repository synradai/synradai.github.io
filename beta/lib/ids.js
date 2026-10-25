export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

export function rowsForSite(rows, siteId) {
  if (!siteId) return rows || []
  return (rows || []).filter((row) => !row?.siteId || row.siteId === siteId)
}
