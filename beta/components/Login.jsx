import { useLayoutEffect, useState } from 'react'
import { go } from '../lib/routes.js'
import { useApp } from '../state.jsx'
import { Button, Field } from './ui.jsx'

export default function Login({ mode = 'signin' }) {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [reset, setReset] = useState(false)
  const joining = mode === 'join'

  useLayoutEffect(() => {
    app.clearAuth()
  }, [mode])

  return (
    <div className="login">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: '1rem' }}>
          <span className="orbit" />
          <span>Safe Intelligence</span>
          <span className="pill">beta 1</span>
        </div>
        <p className="eyebrow">Private field test</p>
        <h1>{joining ? 'Create your account' : 'Welcome back'}</h1>
        <p className="lede">
          {joining
            ? 'This page is the direct way to open a beta account. Confirm the email, then sign in.'
            : 'Sign in to the beta workspace.'}
        </p>

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

        {app.backend && !app.recovery && joining && (
          <form onSubmit={(event) => { event.preventDefault(); app.signUp(email, password, fullName) }}>
            <Field label="Name" hint="Optional. Becomes the organisation name on this project.">
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} />
            </Field>
            {app.authError && <p className="note">{app.authError}</p>}
            {app.authNotice && <p className="lede">{app.authNotice}</p>}
            <Button type="submit">Create account</Button>
            <div>
              <button type="button" className="text-btn" onClick={() => go('#/')}>Back to sign in</button>
            </div>
          </form>
        )}

        {app.backend && !app.recovery && !joining && (
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
            <Button type="submit">{reset ? 'Send reset link' : 'Sign in'}</Button>
            <div>
              <button type="button" className="text-btn" onClick={() => setReset((value) => !value)}>
                {reset ? 'Back to sign in' : 'Forgot password?'}
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
