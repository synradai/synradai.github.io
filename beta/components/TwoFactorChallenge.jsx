import { useState } from 'react'
import { getVerifiedTotpFactor, verifyTotp } from '../lib/mfa.js'
import { MFA_RECOVERY_NOTE } from './TwoFactorEnroll.jsx'
import { Button, Field } from './ui.jsx'

export default function TwoFactorChallenge({ onVerified, onSignOut }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setError('')
    setLoading(true)
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
    <div className="login">
      <div className="card login-card">
        <p className="eyebrow">Required</p>
        <h1>Two-factor verification</h1>
        <p className="lede">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={(event) => { event.preventDefault(); submit() }}>
          <Field label="Authentication code">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              style={{ fontFamily: 'monospace', letterSpacing: '0.3em', textAlign: 'center' }}
            />
          </Field>
          {error && <p className="note">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</Button>
        </form>
        <p className="muted">{MFA_RECOVERY_NOTE}</p>
        <Button kind="ghost" type="button" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}
