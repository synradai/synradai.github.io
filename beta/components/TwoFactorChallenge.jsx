import { useCallback, useRef, useState } from 'react'
import { getVerifiedTotpFactor, verifyTotp } from '../lib/mfa.js'
import { AuthSteps, CodeField } from './AuthBits.jsx'
import { MFA_RECOVERY_NOTE } from './TwoFactorEnroll.jsx'
import { Button } from './ui.jsx'

function totpError(error) {
  const message = error?.message || ''
  if (/expired/i.test(message)) return 'That code has expired. Wait for the next one in the app.'
  if (/invalid/i.test(message) || /match/i.test(message)) return 'That code didn’t match. Try the current one.'
  return message || 'Verification failed.'
}

export default function TwoFactorChallenge({ onVerified, onSignOut }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const verifying = useRef(false)

  const submit = useCallback(async (token) => {
    const next = String(token || '').trim()
    if (next.length < 6 || verifying.current) return
    verifying.current = true
    setError('')
    setLoading(true)
    try {
      const factor = await getVerifiedTotpFactor()
      if (!factor) throw new Error('No authenticator is set up on this account. Sign out and start again.')
      await verifyTotp(factor.id, next)
      onVerified()
    } catch (e) {
      setError(totpError(e))
      setCode('')
      setLoading(false)
      verifying.current = false
    }
  }, [onVerified])

  return (
    <div className="login">
      <div className="card login-card">
        <AuthSteps step={3} />
        <p className="eyebrow">Required</p>
        <h1>Authenticator code</h1>
        <p className="lede">Your session is still here. Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={(event) => { event.preventDefault(); submit(code) }}>
          <CodeField value={code} onChange={setCode} onComplete={submit} disabled={loading} label="Authentication code" />
          {error && <p className="note">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</Button>
        </form>
        <p className="muted">{MFA_RECOVERY_NOTE}</p>
        <Button kind="ghost" type="button" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}
