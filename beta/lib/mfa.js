import { isBackendEnabled, supabase } from './supabase.js'

// TOTP via the beta Supabase project. A password sign-in is aal1 until the
// user verifies a code. Records stay closed until the session is aal2.

export async function getVerifiedTotpFactor() {
  if (!isBackendEnabled || !supabase) return null
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  if (!data) return null
  return (data.totp || []).find((factor) => factor.status === 'verified') || null
}

// 'ready' at aal2. 'enroll' when no verified factor exists. 'challenge' when
// a factor exists and the code is still required. 'error' fails closed.
export async function getMfaGate() {
  if (!isBackendEnabled || !supabase) return 'ready'
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return 'error'
  if (data.currentLevel === 'aal2') return 'ready'
  try {
    const factor = await getVerifiedTotpFactor()
    return factor ? 'challenge' : 'enroll'
  } catch {
    return 'error'
  }
}

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
}

export async function verifyTotp(factorId, code) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw verifyError
  return true
}

export async function clearUnverifiedFactors() {
  if (!isBackendEnabled || !supabase) return
  const { data } = await supabase.auth.mfa.listFactors()
  for (const factor of data?.all || []) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {})
    }
  }
}
