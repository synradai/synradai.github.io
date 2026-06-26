import { supabase, isBackendEnabled } from './supabase'

// Two-factor auth (TOTP) via Supabase Auth. Enrolment shows a QR the user scans
// with an authenticator app; thereafter a fresh password login lands at "aal1"
// and must be elevated to "aal2" by entering a 6-digit code.

export async function getVerifiedTotpFactor() {
  if (!isBackendEnabled) return null
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return null
  return (data.totp || []).find(f => f.status === 'verified') || null
}

// True when this session has a verified factor but hasn't satisfied it yet.
export async function needsMfaChallenge() {
  if (!isBackendEnabled) return false
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return false
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
}

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
}

// Challenge + verify a code against a factor (used for both enrol and login).
export async function verifyTotp(factorId, code) {
  const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
  if (cErr) throw cErr
  const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code })
  if (vErr) throw vErr
  return true
}

export async function unenrollTotp(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

// Remove any abandoned half-finished enrolments so they don't accumulate.
export async function clearUnverifiedFactors() {
  if (!isBackendEnabled) return
  const { data } = await supabase.auth.mfa.listFactors()
  for (const f of (data?.all || [])) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
  }
}
