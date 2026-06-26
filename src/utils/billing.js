import { supabase, isBackendEnabled, getAccessToken } from './supabase'

// Billing is only active once the billing function URL is configured. Until
// then the app behaves exactly as before (no paywall).
const BILLING_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BILLING_URL) || ''
export const isBillingEnabled = Boolean(BILLING_URL && isBackendEnabled)

// Read the org's subscription state (status + trial clock).
export async function getSubscription() {
  if (!isBackendEnabled) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return null
    const { data: org } = await supabase
      .from('organisations')
      .select('subscription_status, trial_ends_at, current_period_end')
      .eq('id', profile.org_id).single()
    if (!org) return null
    return { status: org.subscription_status, trialEndsAt: org.trial_ends_at, currentPeriodEnd: org.current_period_end }
  } catch (_) {
    return null
  }
}

// allowed = active subscription OR still inside the trial window.
// Fail-open when status is unknown (offline / read error) so the field tool is
// never bricked — enforcement happens once the device is back online.
export function computeAccess(sub) {
  if (!sub) return { allowed: true, trial: false, daysLeft: 0, status: 'unknown' }
  const now = Date.now()
  const trialMs = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0
  if (sub.status === 'active' || sub.status === 'trialing') {
    return { allowed: true, trial: false, daysLeft: 0, status: sub.status }
  }
  if (now < trialMs) {
    return { allowed: true, trial: true, daysLeft: Math.ceil((trialMs - now) / 86400000), status: 'trial' }
  }
  return { allowed: false, trial: false, daysLeft: 0, status: sub.status || 'expired' }
}

async function redirectToBilling(action) {
  if (!BILLING_URL) throw new Error('Billing is not set up yet.')
  const token = await getAccessToken()
  if (!token) throw new Error('Please sign in first.')
  const res = await fetch(BILLING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, returnUrl: window.location.origin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error || 'Could not reach billing. Try again.')
  window.location.href = data.url
}

export const startCheckout = () => redirectToBilling('checkout')
export const openPortal = () => redirectToBilling('portal')
