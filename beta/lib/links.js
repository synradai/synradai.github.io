export function cleanLinks(links) {
  if (!Array.isArray(links)) return []
  const seen = new Set()
  const next = []
  for (const link of links) {
    const id = String(link?.id || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push({ id, kind: String(link.kind || '') })
  }
  return next
}

function addLink(links, item) {
  const list = cleanLinks(links)
  if (list.some((link) => link.id === item.id)) return list
  return [...list, { id: item.id, kind: item.kind || '' }]
}

export function linkPair(rows, aId, bId) {
  if (!aId || !bId || aId === bId) return rows
  const left = (rows || []).find((row) => row.id === aId)
  const right = (rows || []).find((row) => row.id === bId)
  if (!left || !right) return rows
  return rows.map((row) => {
    if (row.id === aId) return { ...row, links: addLink(row.links, { id: right.id, kind: right.kind }) }
    if (row.id === bId) return { ...row, links: addLink(row.links, { id: left.id, kind: left.kind }) }
    return row
  })
}

export function unlinkPair(rows, aId, bId) {
  if (!aId || !bId) return rows
  return (rows || []).map((row) => {
    if (row.id !== aId && row.id !== bId) return row
    const other = row.id === aId ? bId : aId
    return { ...row, links: cleanLinks(row.links).filter((link) => link.id !== other) }
  })
}

export function stripLinksTo(rows, id) {
  return (rows || []).filter((row) => row.id !== id).map((row) => {
    const links = cleanLinks(row.links).filter((link) => link.id !== id)
    if (links.length === cleanLinks(row.links).length) return row
    return { ...row, links }
  })
}
