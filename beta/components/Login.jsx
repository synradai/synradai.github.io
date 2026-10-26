import { useState } from 'react'
import { useApp } from '../state.jsx'
import { Button, Field } from './ui.jsx'

export default function Login() {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    await app.signIn(email, password)
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <span className="orbit" />
          <span>Safe Intelligence</span>
          <span className="pill">beta 1</span>
        </div>
        <p className="eyebrow">Private field test</p>
        <h1>Open the beta</h1>
        <p className="lede">Sign in with your email and password. You stay signed in on this device.</p>

        {app.liveProjectBlocked && (
          <p className="note">This build is pointed at the live Safe Intelligence project. Beta will not connect to it. Put the new project URL and publishable key in .env.beta.</p>
        )}

        {app.backend && (
          <form onSubmit={submit}>
            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" inputMode="email" required />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </Field>
            {app.authError && <p className="note">{app.authError}</p>}
            <div className="auth-actions">
              <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
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
