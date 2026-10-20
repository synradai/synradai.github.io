import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state.jsx'
import { AuthSteps, CodeField } from './AuthBits.jsx'
import { Button, Field } from './ui.jsx'

export default function Login() {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [passwordMode, setPasswordMode] = useState(false)
  const [reset, setReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const verifying = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const sendCode = async (event) => {
    event?.preventDefault()
    if (busy) return
    setBusy(true)
    const sent = await app.sendEmailCode(email)
    setBusy(false)
    if (sent) {
      setCode('')
      setStep('code')
      setCooldown(60)
    }
  }

  const verify = useCallback(async (token) => {
    if (verifying.current) return
    verifying.current = true
    setBusy(true)
    const ok = await app.verifyEmailCode(email, token)
    setBusy(false)
    verifying.current = false
    if (!ok) setCode('')
  }, [app, email])

  return (
    <div className="login">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <span className="orbit" />
          <span>Safe Intelligence</span>
          <span className="pill">beta 1</span>
        </div>
        <AuthSteps step={step === 'code' ? 2 : 1} />
        <p className="eyebrow">Private field test</p>
        <h1>{step === 'code' ? 'Enter the code' : 'Open the beta'}</h1>
        <p className="lede">
          {step === 'code'
            ? `We sent a 6-digit code to ${email}. Type it here. It also creates the account if this is your first time.`
            : 'Enter your email. We’ll send a 6-digit code. That opens an existing account or creates one.'}
        </p>

        {app.liveProjectBlocked && (
          <p className="note">This build is pointed at the live Safe Intelligence project. Beta will not connect to it. Put the new project URL and publishable key in .env.beta.</p>
        )}

        {app.recovery && (
          <form onSubmit={(event) => { event.preventDefault(); app.setPassword(password) }}>
            <Field label="New password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
            </Field>
            {app.authError && <p className="note">{app.authError}</p>}
            <Button type="submit">Save password</Button>
          </form>
        )}

        {app.backend && !app.recovery && step === 'code' && (
          <form onSubmit={(event) => { event.preventDefault(); verify(code) }}>
            <CodeField value={code} onChange={setCode} onComplete={verify} disabled={busy} />
            {app.authError && <p className="note">{app.authError}</p>}
            {app.authNotice && <p className="lede">{app.authNotice}</p>}
            <div className="auth-actions">
              <Button type="button" kind="ghost" onClick={sendCode} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Button>
              <button type="button" className="text-btn" onClick={() => { app.clearAuth(); setStep('email'); setPasswordMode(false) }}>
                Use a different email
              </button>
            </div>
          </form>
        )}

        {app.backend && !app.recovery && step === 'email' && !passwordMode && (
          <form onSubmit={sendCode}>
            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
            </Field>
            {app.authError && <p className="note">{app.authError}</p>}
            {app.authNotice && <p className="lede">{app.authNotice}</p>}
            <div className="auth-actions">
              <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a 6-digit code'}</Button>
              <button type="button" className="text-btn" onClick={() => { app.clearAuth(); setPasswordMode(true); setReset(false) }}>
                Use a password instead
              </button>
            </div>
          </form>
        )}

        {app.backend && !app.recovery && step === 'email' && passwordMode && (
          <form onSubmit={(event) => {
            event.preventDefault()
            if (reset) app.sendReset(email)
            else app.signIn(email, password)
          }}>
            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </Field>
            {!reset && (
              <Field label="Password">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              </Field>
            )}
            {app.authError && <p className="note">{app.authError}</p>}
            {app.authNotice && <p className="lede">{app.authNotice}</p>}
            <div className="auth-actions">
              <Button type="submit">{reset ? 'Send reset link' : 'Sign in'}</Button>
              <button type="button" className="text-btn" onClick={() => setReset((value) => !value)}>
                {reset ? 'Back to password' : 'Forgot password?'}
              </button>
              <button type="button" className="text-btn" onClick={() => { app.clearAuth(); setPasswordMode(false) }}>
                Email me a 6-digit code
              </button>
            </div>
          </form>
        )}

        {!app.backend && (
          <>
            <p className="offline-banner">Beta Supabase is not connected yet. You can still test on this device. Records stay in this browser until the new project is added.</p>
            <Button type="button" onClick={app.signInLocal}>Continue on this device</Button>
          </>
        )}
      </div>
    </div>
  )
}
