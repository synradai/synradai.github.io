import { INVESTIGATION_FROM, severityMeta } from '../config/severity.js'

export function triagePath(level) {
  const meta = severityMeta(level)
  if (!meta) throw new Error('Severity must be from 1 to 5.')
  return Number(level) >= INVESTIGATION_FROM ? 'investigation' : 'closeout'
}

export function triageSummary(level) {
  const path = triagePath(level)
  if (path === 'investigation') {
    return 'This opens a five-whys investigation. It is not closed out from the capture screen.'
  }
  return 'Corrective actions are filed with the record. You can close it out once they are done.'
}
