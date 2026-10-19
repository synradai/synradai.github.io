import { useState } from 'react'
import { useApp } from '../state.jsx'
import { Button, Field } from './ui.jsx'

export default function Login() {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')

  return (
    <div className="login">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <span className="orbit" />
          <span>Safe Intelligence</span>
          <span className="pill">beta 1</span>
        </div>
        <p className="eyebrow">Private field test</p>
        <h1>Welcome back</h1>
        <p className="lede">Sign in to the beta workspace. There is no public signup — access is issued for this test.</p>

        {app.liveProjectBlocked && (
          <p className="note">This build is pointed at the live Safe Intelligence project. Beta will not connect to it. Put the new project URL and publishable key in .env.beta.</p>
        )}

        {app.recovery && (
          <form onSubmit={(event) => { event.preventDefault(); app.setPassword(password) }}>
            <Field label="New password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
            </Field>
            <Button type="submit">Save password</Button>
          </form>
        )}

        {app.backend && !app.recovery && (
          <form onSubmit={(event) => {
            event.preventDefault()
            if (mode === 'reset') app.sendReset(email)
            else app.signIn(email, password)
          }}>
            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </Field>
            {mode === 'signin' && (
              <Field label="Password">
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              </Field>
            )}
            {app.authError && <p className="note">{app.authError}</p>}
            <Button type="submit">{mode === 'reset' ? 'Send reset link' : 'Sign in'}</Button>
            <div>
              <button type="button" className="text-btn" onClick={() => setMode(mode === 'reset' ? 'signin' : 'reset')}>
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
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
