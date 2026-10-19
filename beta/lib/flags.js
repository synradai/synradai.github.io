import { breachesFor, LEGAL_NOTICE, NOTIFY_FLAG } from '../config/regulations.js'
import { ESCALATE_FROM, isNotifiable } from '../config/severity.js'

function regsFrom(options) {
  if (Array.isArray(options)) return options
  const ruleset = options?.ruleset || 'general'
  return options?.regs || breachesFor(ruleset)
}

export function matchFlags(text, options) {
  const hay = String(text || '').toLowerCase()
  const regs = regsFrom(options)
  if (!hay.trim()) return []
  const seen = new Set()
  const hits = []
  for (const reg of regs) {
    if (seen.has(reg.id)) continue
    const keyed = (reg.keywords || []).some((word) => word && hay.includes(String(word).toLowerCase()))
    if (!keyed && !reg.always) continue
    seen.add(reg.id)
    hits.push({ ...reg, notice: reg.notice || LEGAL_NOTICE })
  }
  return hits
}

export function withNotifyFlag(flags, fields, driving) {
  const list = Array.isArray(flags) ? [...flags] : []
  const notify = isNotifiable(fields) || Number(driving) >= ESCALATE_FROM
  if (notify && !list.some((flag) => flag.id === NOTIFY_FLAG.id)) {
    list.unshift({ ...NOTIFY_FLAG, notice: LEGAL_NOTICE })
  }
  return list
}

export function withSeverityFlag(flags, severity) {
  return withNotifyFlag(flags, {}, severity)
}
