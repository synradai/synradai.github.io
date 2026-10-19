import { LEGAL_NOTICE, NOTIFY_FLAG, REGULATIONS } from '../config/regulations.js'

export function matchFlags(text, regs = REGULATIONS) {
  const hay = String(text || '').toLowerCase()
  if (!hay.trim()) return []
  const seen = new Set()
  const hits = []
  for (const reg of regs) {
    if (seen.has(reg.id)) continue
    const hit = (reg.keywords || []).some((word) => word && hay.includes(String(word).toLowerCase()))
    if (!hit) continue
    seen.add(reg.id)
    hits.push({ ...reg, notice: LEGAL_NOTICE })
  }
  return hits
}

export function withSeverityFlag(flags, severity) {
  const list = Array.isArray(flags) ? [...flags] : []
  if (Number(severity) >= 4 && !list.some((flag) => flag.id === NOTIFY_FLAG.id)) {
    list.unshift({ ...NOTIFY_FLAG, notice: LEGAL_NOTICE })
  }
  return list
}
