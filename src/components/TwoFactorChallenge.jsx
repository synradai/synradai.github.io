import { useState } from 'react'
import { getVerifiedTotpFactor, verifyTotp } from '../utils/mfa'
import { FIELD_LABEL, INPUT, PrimaryButton, ErrorBox } from './ui'

// Shown after password login when the account has 2FA on — must enter a current
// code before the app unlocks.
export default function TwoFactorChallenge({ onVerified, onSignOut }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (code.trim().length < 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setError(''); setLoading(true)
    try {
      const factor = await getVerifiedTotpFactor()
      if (!factor) throw new Error('No 2FA device found on this account.')
      await verifyTotp(factor.id, code.trim())
      onVerified()
    } catch (e) {
      setError(e?.message?.includes('Invalid') ? 'That code didn’t match. Try the current one.' : (e?.message || 'Verification failed.'))
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem', textAlign: 'center' }}>Two-factor verification</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', textAlign: 'center', fontWeight: 600, lineHeight: 1.5 }}>
          Enter the 6-digit code from your authenticator app.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <div style={FIELD_LABEL}>Authentication code</div>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ ...INPUT, fontSize: '1.4rem', letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace' }}
          />
        </div>

        <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

        <PrimaryButton onClick={submit} loading={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </PrimaryButton>

        <button onClick={onSignOut} style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
