import { generateId } from '../../src/utils/storage.js'
import { templateActions } from '../config/actions.js'
import { collectText, take5Blocked } from '../config/forms.js'
import { assessReport, emptyFiveWhys } from '../config/severity.js'
import { matchFlags, withNotifyFlag } from './flags.js'

export function buildRecord({ kind, fields, source, id, ruleset = 'general', prior = [] }) {
  const now = new Date().toISOString()
  if (kind === 'take5') return buildTake5({ fields, source, id, ruleset, now })
  const decision = assessReport(fields, { prior })
  if (!decision.driving) throw new Error('Severity must be from 1 to 5.')
  const flags = withNotifyFlag(matchFlags(collectText(fields), { ruleset }), fields, decision.driving)
  const investigating = decision.path === 'review' || decision.path === 'escalate'
  return {
    id: id || generateId(),
    kind,
    source: source || 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: decision.driving,
    actualSeverity: decision.actual,
    potentialSeverity: decision.potential,
    notifiable: decision.notifiable,
    path: decision.path,
    status: decision.path === 'escalate' ? 'escalated' : decision.path === 'review' ? 'hse-review' : 'open',
    icam: decision.icam,
    icamReasons: decision.icamReasons,
    fields: { ...fields },
    flags,
    correctiveActions: decision.path === 'closeout' ? templateActions(kind) : [],
    closeOut: null,
    fiveWhys: investigating ? emptyFiveWhys() : null,
  }
}

function buildTake5({ fields, source, id, ruleset, now }) {
  const blocked = take5Blocked(fields)
  const stopped = blocked.length > 0 || fields.safeToStart === 'No'
  return {
    id: id || generateId(),
    kind: 'take5',
    source: source || 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: stopped ? 'stopped' : 'started',
    status: stopped ? 'stopped' : 'filed',
    blocked,
    fields: { ...fields, safeToStart: stopped ? 'No' : fields.safeToStart },
    flags: matchFlags(collectText(fields), { ruleset }),
    correctiveActions: stopped ? templateActions('take5') : [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
}

export function buildNoteRecord({ kind, fields, id, ruleset = 'general' }) {
  const now = new Date().toISOString()
  return {
    id: id || generateId(),
    kind,
    source: fields?.source || 'typed',
    createdAt: now,
    updatedAt: now,
    ruleset,
    severity: null,
    path: null,
    status: 'filed',
    fields: { ...fields },
    flags: [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
}

export function buildSceneRecord({ fields, result, flags, id, ruleset = 'general' }) {
  const now = new Date().toISOString()
  return {
    id: id || generateId(),
    kind: 'scene-check',
    source: 'scene',
    createdAt: now,
    updatedAt: now,
    ruleset,
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
