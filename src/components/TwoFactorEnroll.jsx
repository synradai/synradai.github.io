import { useEffect, useState } from 'react'
import { clearUnverifiedFactors, enrollTotp, verifyTotp } from '../utils/mfa'
import { FIELD_LABEL, INPUT, PrimaryButton, ErrorBox } from './ui'

const RECOVERY = 'Supabase does not provide backup codes. If you lose this authenticator, an administrator has to reset two-factor authentication on your account before you can sign in again. Email synradai@outlook.com.'

// Blocking screen: a signed-in user with no verified factor cannot open records
// until they scan the QR (or type the secret) and confirm a code.
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
    if (code.trim().length < 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    if (preview) { setError('This preview screen cannot verify a code.'); return }
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem', textAlign: 'center' }}>Set up two-factor authentication</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem', textAlign: 'center', fontWeight: 600, lineHeight: 1.5 }}>
          Every account needs an authenticator app before any records open. Scan the code, or type the secret in by hand.
        </p>

        {loading && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-faint)', textAlign: 'center', fontWeight: 700 }}>Preparing your authenticator…</p>
        )}

        {enroll && (
          <>
            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', display: 'block', width: 'fit-content', margin: '0 auto 0.75rem' }}>
              <img src={enroll.qrCode} alt="Authenticator QR code" style={{ width: 180, height: 180, display: 'block' }} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: '0 0 1rem', fontWeight: 600, wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.5 }}>
              Can’t scan? Enter this key manually:<br />
              <span style={{ color: 'var(--accent-soft)', fontFamily: 'monospace', fontWeight: 700 }}>{enroll.secret}</span>
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={FIELD_LABEL}>6-digit code</div>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                onKeyDown={e => e.key === 'Enter' && confirm()}
                style={{ ...INPUT, fontSize: '1.4rem', letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace' }}
              />
            </div>
            <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>
            <PrimaryButton onClick={confirm} loading={busy}>
              {busy ? 'Verifying…' : 'Confirm and continue'}
            </PrimaryButton>
          </>
        )}

        {!enroll && !loading && <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>}

        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: '1rem 0 0', lineHeight: 1.5, fontWeight: 600 }}>
          {RECOVERY}
        </p>
        <button onClick={onSignOut} style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export const MFA_RECOVERY_NOTE = RECOVERY
