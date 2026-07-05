import { supabase, isBackendEnabled } from './supabase'

// Crash reporting: uncaught errors get written to the client_errors table so
// problems on real devices are visible without a third-party service. Quiet by
// design — capped per session, truncated, and never allowed to throw itself.

const MAX_PER_SESSION = 5
let sent = 0

async function report(kind, message, stack) {
  if (!isBackendEnabled || sent >= MAX_PER_SESSION || !message) return
  sent++
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    await supabase.from('client_errors').insert({
      kind,
      message: String(message).slice(0, 500),
      stack: String(stack || '').slice(0, 2000),
      url: window.location.pathname,
      ua: navigator.userAgent.slice(0, 200),
      build: localStorage.getItem('si_build') || null,
    })
  } catch (_) { /* never let the reporter become the crash */ }
}

export function initErrorLogging() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e) => {
    // Resource-load failures have no message — skip those, log real JS errors.
    if (e.message) report('error', e.message, e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    report('promise', r?.message || String(r), r?.stack)
  })
}
