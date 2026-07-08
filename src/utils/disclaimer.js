import { supabase, isBackendEnabled } from './supabase'

// AI disclaimer acknowledgment — named, dated, logged server-side before a
// user can use the app (a liability requirement for AI in a safety context,
// not a nicety). Bumping the version re-prompts every user with the new text.
export const DISCLAIMER_VERSION = 1
const CACHE_KEY = `sa_ai_ack_v${DISCLAIMER_VERSION}`

// Does the signed-in user still need to acknowledge? Cached locally after the
// first confirmation so the check is instant and works offline. Fails open on
// read errors — the field tool is never bricked; it re-prompts next session.
export async function needsAiAck() {
  if (!isBackendEnabled) return false
  try { if (localStorage.getItem(CACHE_KEY) === '1') return false } catch (_) {}
  try {
    const { data, error } = await supabase
      .from('disclaimer_acks').select('id').eq('version', DISCLAIMER_VERSION).limit(1)
    if (error) return false
    const acked = (data || []).length > 0
    if (acked) { try { localStorage.setItem(CACHE_KEY, '1') } catch (_) {} }
    return !acked
  } catch (_) { return false }
}

export async function recordAiAck(fullName) {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200)
  const { error } = await supabase.from('disclaimer_acks').insert({
    version: DISCLAIMER_VERSION,
    full_name: (fullName || '').trim().slice(0, 120),
    ua,
  })
  // A duplicate means it's already recorded — that's success, not failure.
  if (error && !/duplicate|unique/i.test(error.message)) throw error
  try { localStorage.setItem(CACHE_KEY, '1') } catch (_) {}
}
