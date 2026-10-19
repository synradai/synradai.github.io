// Actual and potential severity. The higher one drives the workflow.
// A yes on the notifiable check forces the driving level to at least 4.

export const SEVERITY_SCALE = [
  { level: 1, label: 'Insignificant', hint: 'First aid or none. Damage under $1,000. Example: a minor cut from a scaffold tube.', path: 'closeout' },
  { level: 2, label: 'Minor', hint: 'Medical treatment, no lost time. Damage under $10,000. Example: an eye foreign body removed at a clinic.', path: 'closeout' },
  { level: 3, label: 'Moderate', hint: 'Lost time or restricted duties, or a contained chemical spill. Damage under $100,000.', path: 'review' },
  { level: 4, label: 'Major', hint: 's.36 serious injury or s.37 dangerous incident. Example: a dropped object into a live area, or a fall-arrest activation.', path: 'escalate' },
  { level: 5, label: 'Catastrophic', hint: 'Fatality, permanent disability, or multiple serious injuries. Example: a fatal fall or a crane overturn.', path: 'escalate' },
]

export const FIVE_WHYS_FROM = 3
export const ESCALATE_FROM = 4

export const FIVE_WHYS = [
  'Why did this happen?',
  'Why did that cause exist?',
  'Why was that allowed to happen?',
  'Why did the control fail or go missing?',
  'Why was the job set up that way?',
]

export const ICAM_FIELDS = [
  'Team and lead',
  'PEEPO data',
  'Timeline',
  'Absent or failed defences',
  'Individual and team actions',
  'Task and environment conditions',
  'Organisational factors',
  'Findings',
  'Actions per finding',
  'Sign-off',
]

export const ICAM_CONTROLS = ['isolation', 'fall arrest', 'lifting', 'confined space', 'energised electrical']

const HUMAN_ERROR = /did(?:\s+not|n't|nt)\s+follow|failed to follow|worker error|human error|complacency|operator error|just a mistake/i

export function severityMeta(level) {
  return SEVERITY_SCALE.find((item) => item.level === Number(level)) || null
}

export function humanErrorGuard(text) {
  return HUMAN_ERROR.test(String(text || ''))
}

function inScale(value) {
  const level = Number(value)
  return level >= 1 && level <= 5 ? level : 0
}

export function readSeverities(fields = {}) {
  const actual = inScale(fields.actualSeverity ?? fields.severity)
  const potential = inScale(fields.potentialSeverity)
  return { actual, potential }
}

export function isNotifiable(fields = {}) {
  return String(fields.notifiable || '').toLowerCase() === 'yes'
}

export function sameEventRepeat(prior, fields, now = Date.now()) {
  const type = fields.incidentType || fields.category
  if (!type) return false
  const year = 365 * 24 * 60 * 60 * 1000
  return (prior || []).some((row) => {
    const when = Date.parse(row.fields?.occurredAt || row.createdAt || '')
    if (!when || now - when > year || now - when < 0) return false
    return row.fields?.incidentType === type || row.fields?.category === type
  })
}

export function assessReport(fields = {}, { prior } = {}) {
  const { actual, potential } = readSeverities(fields)
  let driving = Math.max(actual, potential)
  const notifiable = isNotifiable(fields)
  if (notifiable) driving = Math.max(driving, ESCALATE_FROM)
  const icamReasons = []
  if (actual >= ESCALATE_FROM || potential >= ESCALATE_FROM) {
    icamReasons.push('Actual or potential severity is 4 or 5, including a high-potential near miss.')
  }
  if (notifiable) icamReasons.push('The notifiable check is yes.')
  if (fields.criticalControlFailed === 'Yes') icamReasons.push('A critical control failed (isolation, fall arrest, lifting, confined space, or energised electrical).')
  if (fields.repeatEvent === 'Yes' || sameEventRepeat(prior, fields)) icamReasons.push('This event type has happened again within 12 months.')
  if (fields.multiplePcbu === 'Yes') icamReasons.push('More than one PCBU is involved.')
  if (fields.clientRequiresIcam === 'Yes') icamReasons.push('The client requires ICAM.')
  let path = 'closeout'
  if (driving >= ESCALATE_FROM || icamReasons.length > 0) path = 'escalate'
  else if (driving >= FIVE_WHYS_FROM) path = 'review'
  return { actual, potential, driving, notifiable, path, icam: path === 'escalate', icamReasons }
}

export function triagePath(level) {
  const meta = severityMeta(level)
  if (!meta) throw new Error('Severity must be from 1 to 5.')
  return meta.path
}

export function triageSummary(level) {
  const path = triagePath(level)
  if (path === 'escalate') {
    return 'Escalate now. Tell the site manager, the client, and the HSE manager. Open ICAM, run the notifiable check, and preserve the scene under s.39. This does not auto-close.'
  }
  if (path === 'review') {
    return 'HSE reviews this, with a five whys and an HSE sign-off.'
  }
  return 'Record the actions. A supervisor verifies them, then it can close. A potential of 4 or 5 escalates instead.'
}

export function emptyFiveWhys() {
  return {
    problem: '',
    whys: FIVE_WHYS.map(() => ({ why: '', evidence: '', deeper: '' })),
    rootCause: '',
    contributing: '',
    actions: '',
    hierarchy: '',
    owner: '',
    due: '',
    verification: '',
    signOff: '',
  }
}
