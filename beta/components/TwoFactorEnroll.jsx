import { useCallback, useEffect, useRef, useState } from 'react'
import { clearUnverifiedFactors, enrollTotp, verifyTotp } from '../lib/mfa.js'
import { AuthSteps, CodeField } from './AuthBits.jsx'
import { Button } from './ui.jsx'

const RECOVERY = 'Supabase does not provide backup codes. If you lose this authenticator, an administrator has to reset two-factor authentication on your account before you can sign in again. Email synradai@outlook.com.'

function totpError(error) {
  const message = error?.message || ''
  if (/expired/i.test(message)) return 'That code has expired. Wait for the next one in the app.'
  if (/invalid/i.test(message)) return 'That code didn’t match. Check the app and try again.'
  return message || 'That code didn’t match. Check the app and try again.'
}

export default function TwoFactorEnroll({ onVerified, onSignOut, preview = null }) {
  const [enroll, setEnroll] = useState(preview)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(!preview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const verifying = useRef(false)

  useEffect(() => {
    if (preview) return undefined
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

  const confirm = useCallback(async (token) => {
    const next = String(token || '').trim()
    if (next.length < 6 || verifying.current) return
    if (preview) {
      setError('This preview screen cannot verify a code.')
      return
    }
    verifying.current = true
    setError('')
    setBusy(true)
    try {
      await verifyTotp(enroll.factorId, next)
      onVerified()
    } catch (e) {
      setError(totpError(e))
      setCode('')
      setBusy(false)
      verifying.current = false
    }
  }, [enroll, onVerified, preview])

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(enroll.secret)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('Could not copy the key. Select it and copy it by hand.')
    }
  }

  return (
    <div className="login">
      <div className="card login-card">
        <AuthSteps step={3} />
        <p className="eyebrow">Required</p>
        <h1>Add your authenticator</h1>
        <p className="lede">Open this in your authenticator app, or copy the setup key. Then enter the 6-digit code.</p>
        {loading && <p className="muted">Preparing your authenticator…</p>}
        {enroll && (
          <form onSubmit={(event) => { event.preventDefault(); confirm(code) }}>
            <div className="auth-actions">
              <a className="btn" href={enroll.uri}>Open in authenticator app</a>
              <Button type="button" kind="ghost" onClick={copyKey}>{copied ? 'Setup key copied' : 'Copy setup key'}</Button>
            </div>
            <p className="muted" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
              Setup key<br />
              <strong style={{ fontFamily: 'monospace' }}>{enroll.secret}</strong>
            </p>
            <div className="qr-wide">
              <img src={enroll.qrCode} alt="Authenticator QR code" width="180" height="180" />
            </div>
            <CodeField value={code} onChange={setCode} onComplete={confirm} disabled={busy} />
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
