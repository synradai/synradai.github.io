import { buildActionRecord } from './actions.js'
import { linkPair } from './links.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function emptyInvestigation() {
  return {
    team: [],
    timeline: [],
    evidence: [],
    photos: [],
    defences: '',
    individual: '',
    conditions: '',
    organisational: '',
    root: '',
    contributing: '',
    signOffRole: '',
    signOffName: '',
    signOffOn: '',
  }
}

export function readInvestigation(record) {
  const saved = record?.investigation || {}
  const base = emptyInvestigation()
  return {
    ...base,
    ...saved,
    team: Array.isArray(saved.team) ? saved.team : [],
    timeline: Array.isArray(saved.timeline) ? saved.timeline : [],
    evidence: Array.isArray(saved.evidence) ? saved.evidence : [],
    photos: Array.isArray(saved.photos) ? saved.photos : [],
  }
}

export function signOffError(investigation) {
  if (!String(investigation?.signOffRole || '').trim()) return 'Add the role signing this off.'
  if (!String(investigation?.signOffName || '').trim()) return 'Add who is signing this off.'
  if (!DATE.test(String(investigation?.signOffOn || ''))) return 'Add the sign-off date.'
  return ''
}

export function investigationRows(incident, investigation, actionFields) {
  const action = buildActionRecord({
    ruleset: incident.ruleset || 'general',
    fields: {
      title: actionFields.title,
      owner: actionFields.owner,
      due: actionFields.due,
      note: 'Raised from the ICAM investigation.',
      occurredAt: incident.fields?.occurredAt,
      status: 'open',
    },
  })
  if (incident.fields?.siteArea) action.fields.siteArea = incident.fields.siteArea
  const nextIncident = { ...incident, investigation }
  return linkPair([nextIncident, action], incident.id, action.id)
}
