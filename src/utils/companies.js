import { STORAGE_KEYS } from '../constants'
import { safeSetItem } from './storage'

// Company memory — every company typed into a report is remembered on-device,
// ranked by how often it's used, capped at 50 (about the whole WA mining
// industry). Powers the suggestion chips under company fields so after the
// first few reports you tap instead of type.

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.KNOWN_COMPANIES)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (_) { return [] }
}

const save = (list) => {
  const ranked = [...list].sort((a, b) => (b.count - a.count) || (b.last - a.last)).slice(0, 50)
  safeSetItem(STORAGE_KEYS.KNOWN_COMPANIES, JSON.stringify(ranked))
}

// Most-used first; returns just the names.
export function getKnownCompanies() {
  return load().map(c => c.name)
}

// Call on every report save. Case-insensitive dedupe, keeps the latest casing.
export function rememberCompanies(...names) {
  const list = load()
  const now = Date.now()
  let changed = false
  for (const raw of names) {
    const name = (raw || '').trim()
    if (!name) continue
    const hit = list.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (hit) { hit.name = name; hit.count += 1; hit.last = now }
    else list.push({ name, count: 1, last: now })
    changed = true
  }
  if (changed) save(list)
}

// One-time backfill from reports saved before company memory existed.
// No-op once anything is stored, so counts never inflate on reload.
export function seedCompanies(names) {
  if (load().length) return
  const seen = new Set()
  const unique = []
  for (const raw of names) {
    const name = (raw || '').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    unique.push(name)
  }
  if (unique.length) rememberCompanies(...unique)
}
