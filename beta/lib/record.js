import { generateId } from '../../src/utils/storage.js'
import { templateActions } from '../config/actions.js'
import { collectText } from '../config/forms.js'
import { matchFlags, withSeverityFlag } from './flags.js'
import { triagePath } from './triage.js'

export function buildRecord({ kind, fields, source, id }) {
  const severity = Number(fields?.severity)
  const path = triagePath(severity)
  const now = new Date().toISOString()
  return {
    id: id || generateId(),
    kind,
    source: source || 'typed',
    createdAt: now,
    updatedAt: now,
    severity,
    path,
    status: path === 'investigation' ? 'investigation' : 'open',
    fields: { ...fields },
    flags: withSeverityFlag(matchFlags(collectText(fields)), severity),
    correctiveActions: path === 'closeout' ? templateActions(kind) : [],
    closeOut: null,
    fiveWhys: path === 'investigation'
      ? { whys: ['', '', '', '', ''], rootCause: '', actions: '' }
      : null,
  }
}

export function buildSceneRecord({ fields, result, flags, id }) {
  const now = new Date().toISOString()
  return {
    id: id || generateId(),
    kind: 'scene-check',
    source: 'scene',
    createdAt: now,
    updatedAt: now,
    severity: null,
    path: null,
    status: 'filed',
    fields: { ...fields },
    sceneResult: result,
    flags: flags || [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
  }
}
