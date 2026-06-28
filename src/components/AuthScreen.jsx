import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { FIELD_LABEL, INPUT, PrimaryButton, ErrorBox } from './ui'
import Legal from './Legal'

// Email + password sign in / sign up. On success the auth state change in
// App.jsx swaps this screen out for the app. New signups auto-get an
// "organisation of one" via the database trigger (see supabase/schema.sql).
export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showLegal, setShowLegal] = useState(false)

  const submit = async () => {
    setError(''); setNotice('')
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    if (mode === 'signup' && password.length < 8) { setError('Use at least 8 characters for your password.'); return }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() || null } },
        })
        if (error) throw error
        // If email confirmation is on, there's no session yet — tell the user.
        const { data } = await supabase.auth.getSession()
        if (!data.session) setNotice('Account created. Check your email to confirm, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent-soft)' }}>Safe Intelligence</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem', letterSpacing: '-0.01em' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
            {mode === 'signin' ? 'Sign in to your safety workspace' : 'Field safety, made simple'}
          </p>
        </div>

        {mode === 'signup' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={FIELD_LABEL}>Name</div>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" style={INPUT} />
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <div style={FIELD_LABEL}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={INPUT} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={FIELD_LABEL}>Password</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={INPUT}
          />
        </div>

        <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>
        {notice && (
          <div style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '0.5rem', padding: '0.625rem', color: 'var(--success-text)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {notice}
          </div>
        )}

        <PrimaryButton onClick={submit} loading={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </PrimaryButton>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}
          style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {mode === 'signin' ? "No account? Create one" : 'Already have an account? Sign in'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600, lineHeight: 1.5 }}>
          By continuing you agree to our{' '}
          <button onClick={() => setShowLegal(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Terms &amp; Privacy Policy
          </button>
        </p>
      </div>
      {showLegal && <Legal onClose={() => setShowLegal(false)} initialTab="terms" />}
    </div>
  )
}
