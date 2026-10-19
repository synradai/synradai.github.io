import { useEffect, useState } from 'react'
import { clearUnverifiedFactors, enrollTotp, verifyTotp } from '../lib/mfa.js'
import { Button, Field } from './ui.jsx'

const RECOVERY = 'Supabase does not provide backup codes. If you lose this authenticator, an administrator has to reset two-factor authentication on your account before you can sign in again. Email synradai@outlook.com.'

export default function TwoFactorEnroll({ onVerified, onSignOut, preview = null }) {
  const [enroll, setEnroll] = useState(preview)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(!preview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (preview) return
    let cancelled = false
    ;(async () => {
      try {
        await clearUnverifiedFactors()
        const next = await enrollTotp()
        if (!cancelled) setEnroll(next)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not start authenticator setup.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [preview])

  const confirm = async () => {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    if (preview) {
      setError('This preview screen cannot verify a code.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await verifyTotp(enroll.factorId, code.trim())
      onVerified()
    } catch {
      setError('That code didn’t match. Check the app and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="card login-card">
        <p className="eyebrow">Required</p>
        <h1>Set up two-factor authentication</h1>
        <p className="lede">Every account needs an authenticator app before any records open. Scan the code, or type the secret in by hand.</p>
        {loading && <p className="muted">Preparing your authenticator…</p>}
        {enroll && (
          <form onSubmit={(event) => { event.preventDefault(); confirm() }}>
            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: 12, width: 'fit-content', margin: '0 auto 0.75rem' }}>
              <img src={enroll.qrCode} alt="Authenticator QR code" width="180" height="180" />
            </div>
            <p className="muted" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
              Can’t scan? Enter this key manually:<br />
              <strong style={{ fontFamily: 'monospace' }}>{enroll.secret}</strong>
            </p>
            <Field label="6-digit code">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ fontFamily: 'monospace', letterSpacing: '0.3em', textAlign: 'center' }}
              />
            </Field>
            {error && <p className="note">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Confirm and continue'}</Button>
          </form>
        )}
        {!enroll && !loading && error && <p className="note">{error}</p>}
        <p className="muted">{RECOVERY}</p>
        <Button kind="ghost" type="button" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}

export const MFA_RECOVERY_NOTE = RECOVERY
