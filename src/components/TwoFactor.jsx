import { useState, useEffect } from 'react'
import { getVerifiedTotpFactor, enrollTotp, verifyTotp, unenrollTotp, clearUnverifiedFactors } from '../utils/mfa'
import { SECTION_LABEL, CARD, INPUT, PrimaryButton, ErrorBox } from './ui'

// Settings card: enable or disable 2FA on the account.
export default function TwoFactor() {
  const [factor, setFactor] = useState(null)   // verified factor, if any
  const [loading, setLoading] = useState(true)
  const [enroll, setEnroll] = useState(null)   // { factorId, qrCode, secret } during setup
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    try { setFactor(await getVerifiedTotpFactor()) } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const startEnroll = async () => {
    setError(''); setBusy(true)
    try {
      await clearUnverifiedFactors()
      setEnroll(await enrollTotp())
    } catch (e) { setError(e?.message || 'Could not start 2FA setup.') }
    setBusy(false)
  }

  const confirmEnroll = async () => {
    if (code.trim().length < 6) { setError('Enter the 6-digit code from your app.'); return }
    setError(''); setBusy(true)
    try {
      await verifyTotp(enroll.factorId, code.trim())
      setEnroll(null); setCode(''); await refresh()
    } catch (e) { setError('That code didn’t match. Check the app and try again.') }
    setBusy(false)
  }

  const cancelEnroll = async () => {
    setEnroll(null); setCode(''); setError('')
    await clearUnverifiedFactors().catch(() => {})
  }

  const disable = async () => {
    setError(''); setBusy(true)
    try { await unenrollTotp(factor.id); await refresh() }
    catch (e) { setError(e?.message || 'Could not turn off 2FA.') }
    setBusy(false)
  }

  if (loading) return null

  return (
    <div style={CARD}>
      <div style={SECTION_LABEL}>Two-Factor Authentication</div>

      {factor && !enroll && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--success-text)', marginBottom: '1rem', fontWeight: 700 }}>
            ✓ 2FA is on — your account asks for a code at sign-in.
          </p>
          <button onClick={disable} disabled={busy} style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            Turn off 2FA
          </button>
        </>
      )}

      {!factor && !enroll && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
            Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, etc.).
            Strongly recommended for accounts holding incident data.
          </p>
          <PrimaryButton onClick={startEnroll} loading={busy}>Enable 2FA</PrimaryButton>
        </>
      )}

      {enroll && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.6, fontWeight: 500 }}>
            1. Scan this with your authenticator app:
          </p>
          <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', display: 'inline-block', marginBottom: '0.75rem' }}>
            <img src={enroll.qrCode} alt="2FA QR code" style={{ width: 180, height: 180, display: 'block' }} />
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.75rem', fontWeight: 500, wordBreak: 'break-all' }}>
            Can’t scan? Enter this key manually: <span style={{ color: 'var(--accent-soft)', fontFamily: 'monospace', fontWeight: 700 }}>{enroll.secret}</span>
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.6, fontWeight: 500 }}>
            2. Enter the 6-digit code it shows:
          </p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            style={{ ...INPUT, fontSize: '1.2rem', letterSpacing: '0.25em', textAlign: 'center', fontFamily: 'monospace', marginBottom: '0.75rem' }}
          />
          <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <PrimaryButton onClick={confirmEnroll} loading={busy} style={{ flex: 1 }}>Confirm</PrimaryButton>
            <button onClick={cancelEnroll} style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </>
      )}

      {!enroll && <ErrorBox style={{ marginTop: '0.75rem' }}>{error}</ErrorBox>}
    </div>
  )
}
