import { useEffect, useState } from 'react'
import { getVerifiedTotpFactor } from '../utils/mfa'
import { MFA_RECOVERY_NOTE } from './TwoFactorEnroll'
import { SECTION_LABEL, CARD } from './ui'

// 2FA is required for every account. Enrolment happens before records load,
// so this card only reports status — it cannot be turned off.
export default function TwoFactor() {
  const [factor, setFactor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getVerifiedTotpFactor()
      .then(next => { if (!cancelled) setFactor(next) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return null

  return (
    <div style={CARD}>
      <div style={SECTION_LABEL}>Two-Factor Authentication</div>
      <p style={{ fontSize: '0.85rem', color: 'var(--success-text)', margin: '0 0 0.6rem', fontWeight: 700 }}>
        {factor ? '✓ Required — an authenticator code is needed at every sign-in.' : 'Required — finish authenticator setup to keep using Safe Intelligence.'}
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
        {MFA_RECOVERY_NOTE}
      </p>
    </div>
  )
}
