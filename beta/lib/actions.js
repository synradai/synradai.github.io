import { generateId } from '../../src/utils/storage.js'

const STATUSES = new Set(['open', 'in-progress', 'done'])

export function actionError(fields) {
  if (!String(fields?.title || '').trim()) return 'Add what needs to be done.'
  if (!String(fields?.owner || '').trim()) return 'Add an owner.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fields?.due || ''))) return 'Add a due date.'
  return ''
}

export function buildActionRecord({ id, ruleset = 'general', fields = {}, links = [] }) {
  const error = actionError(fields)
  if (error) throw new Error(error)
  const now = new Date().toISOString()
  const status = STATUSES.has(fields.status) ? fields.status : 'open'
  return {
    id: id || generateId(),
    kind: 'action',
    source: 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: null,
    status,
    fields: {
      title: String(fields.title).trim(),
      owner: String(fields.owner).trim(),
      ownerId: String(fields.ownerId || '').trim(),
      due: String(fields.due).slice(0, 10),
      note: String(fields.note || '').trim(),
      occurredAt: fields.occurredAt || now.slice(0, 16),
    },
    links: Array.isArray(links) ? links.filter((link) => link?.id).map((link) => ({ id: link.id, kind: link.kind || '' })) : [],
    flags: [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
}

export function statusPatch(row, status, today) {
  const fields = { ...(row?.fields || {}) }
  if (status === 'done') {
    if (!fields.closedOn) fields.closedOn = today
  } else {
    delete fields.closedOn
  }
  return { status, fields }
}

export function isOverdue(row, today) {
  if (row?.kind !== 'action' || row.status === 'done') return false
  const due = String(row.fields?.due || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return false
  return due < today
}

export function canRemind(row, today) {
  return isOverdue(row, today) && String(row?.fields?.remindedOn || '') !== today
}

export function reminderPatch(row, today) {
  return { fields: { ...(row?.fields || {}), remindedOn: today } }
}

export function ownerChoices(members, user) {
  const list = []
  const seen = new Set()
  for (const person of members || []) {
    const id = String(person?.id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    list.push({ id, name: String(person.name || '').trim() || 'Member' })
  }
  if (!list.length && user?.id) {
    list.push({ id: String(user.id), name: String(user.email || user.name || 'You').trim() || 'You' })
  }
  return list
}

export function selectedOwner(members, user, ownerId) {
  const choices = ownerChoices(members, user)
  return choices.find((person) => person.id === ownerId) || choices[0] || null
}

export function sortActions(rows, today) {
  return (rows || []).filter((row) => row.kind === 'action').slice().sort((a, b) => {
    const rank = (row) => (isOverdue(row, today) ? 0 : row.status === 'done' ? 2 : 1)
    const diff = rank(a) - rank(b)
    if (diff) return diff
    return String(a.fields?.due || '9999').localeCompare(String(b.fields?.due || '9999')) || String(a.id).localeCompare(String(b.id))
  })
}
