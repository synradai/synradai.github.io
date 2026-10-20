import { generateId } from '../../src/utils/storage.js'
import { buildActionRecord } from './actions.js'
import { linkPair } from './links.js'

const RESULTS = new Set(['pass', 'fail', 'na'])

export function blankChecks(template) {
  return (template?.items || []).map((item) => ({
    id: item.id,
    label: item.label,
    result: '',
    note: '',
  }))
}

export function inspectionError(fields, checks) {
  if (!String(fields?.templateId || '').trim()) return 'Choose a checklist.'
  if (!checks?.length) return 'This checklist has no items.'
  if (checks.some((check) => !RESULTS.has(check.result))) return 'Mark every item pass, fail, or N/A.'
  const failed = checks.some((check) => check.result === 'fail')
  if (failed && !String(fields?.owner || '').trim()) return 'Add an owner for the failed items.'
  if (failed && !/^\d{4}-\d{2}-\d{2}$/.test(String(fields?.due || ''))) return 'Add a due date for the failed items.'
  return ''
}

export function fileInspection({ id, ruleset = 'general', fields, checks }) {
  const problem = inspectionError(fields, checks)
  if (problem) throw new Error(problem)
  const now = new Date().toISOString()
  const failed = checks.filter((check) => check.result === 'fail')
  const inspection = {
    id: id || generateId(),
    kind: 'inspection',
    source: 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: null,
    status: failed.length ? 'open' : 'filed',
    fields: {
      title: String(fields.title || 'Inspection').trim(),
      templateId: fields.templateId,
      siteArea: String(fields.siteArea || '').trim(),
      occurredAt: fields.occurredAt || now.slice(0, 16),
      owner: String(fields.owner || '').trim(),
      due: fields.due || '',
      note: failed.length ? `${failed.length} item${failed.length === 1 ? '' : 's'} failed` : 'All items passed or N/A',
    },
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      result: check.result,
      note: String(check.note || '').trim(),
    })),
    links: [],
    flags: [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
  let rows = [inspection]
  for (const check of failed) {
    const action = buildActionRecord({
      ruleset,
      fields: {
        title: `Fix: ${check.label}`,
        owner: fields.owner,
        due: fields.due,
        note: check.note || '',
        occurredAt: inspection.fields.occurredAt,
        status: 'open',
        ownerId: fields.ownerId || '',
      },
    })
    rows = linkPair([...rows, action], inspection.id, action.id)
  }
  return rows
}
