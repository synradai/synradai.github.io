import { STORAGE_KEYS } from '../constants'

// Client-side de-identification (SafeIntel data strategy): strip who/where from
// text before it leaves the device, keeping the safety content. Images already
// lose their EXIF/location metadata because compressPhoto()/the doc scanner
// re-encode them through a canvas, which drops all metadata.

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
// AU mobile/landline-ish: +61 / 0 prefix then 8-9 more digits, spaces/dashes ok
const PHONE = /\b(?:\+?61|0)[\s-]?\d(?:[\s-]?\d){7,9}\b/g

const DEFAULT_TERMS = { company: '', sites: [], people: [] }

export function loadTerms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEIDENT_TERMS)
    return raw ? { ...DEFAULT_TERMS, ...JSON.parse(raw) } : { ...DEFAULT_TERMS }
  } catch (_) {
    return { ...DEFAULT_TERMS }
  }
}

export function saveTerms(terms) {
  try { localStorage.setItem(STORAGE_KEYS.DEIDENT_TERMS, JSON.stringify(terms)) } catch (_) {}
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function replaceTerm(text, term, token) {
  const t = (term || '').trim()
  if (t.length < 2) return text // too short to match safely
  return text.replace(new RegExp(escapeRegex(t), 'gi'), token)
}

// Redact a single string: user terms first (longest first so "BHP Mining"
// beats "BHP"), then generic patterns.
export function deidentifyText(text, terms = loadTerms()) {
  if (!text || typeof text !== 'string') return text
  let out = text
  const sites = [...(terms.sites || [])].sort((a, b) => b.length - a.length)
  const people = [...(terms.people || [])].sort((a, b) => b.length - a.length)
  if (terms.company) out = replaceTerm(out, terms.company, '[COMPANY]')
  for (const s of sites) out = replaceTerm(out, s, '[SITE]')
  for (const p of people) out = replaceTerm(out, p, '[NAME]')
  out = out.replace(EMAIL, '[EMAIL]').replace(PHONE, '[PHONE]')
  return out
}

// Deep-redact every string in an object/array, leaving images, ids and
// timestamps untouched (they carry no free-text identifiers).
const SKIP_KEYS = new Set(['id', 'photo', 'photos', 'jsaPhotos', 'time', 'date', 'startTime', 'timestamp', 'signoffTime'])

export function deidentifyDeep(value, terms = loadTerms()) {
  if (typeof value === 'string') return deidentifyText(value, terms)
  if (Array.isArray(value)) return value.map(v => deidentifyDeep(v, terms))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SKIP_KEYS.has(k) || k.endsWith('Id') ? v : deidentifyDeep(v, terms)
    }
    return out
  }
  return value
}

// True once the user has told us at least one thing to strip.
export function hasTerms(terms = loadTerms()) {
  return Boolean(terms.company || (terms.sites || []).length || (terms.people || []).length)
}
