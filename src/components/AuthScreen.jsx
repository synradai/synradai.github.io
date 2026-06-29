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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      {/* ambient glow behind everything */}
      <div style={{ position: 'absolute', top: '-12%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 460, background: 'radial-gradient(circle, rgba(59,130,246,0.30), rgba(34,211,238,0.12) 45%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          {/* glowing hero orb */}
          <div style={{ position: 'relative', width: 104, height: 104, margin: '0 auto 1.5rem' }}>
            <div style={{ position: 'absolute', inset: -18, borderRadius: '50%', border: '1px solid rgba(96,165,250,0.25)' }} />
            <div style={{
              width: 104, height: 104, borderRadius: '50%',
              background: 'radial-gradient(circle at 50% 36%, #dbeafe 0%, var(--glow-b) 34%, var(--glow-a) 62%, #1e3a8a 88%)',
              boxShadow: '0 0 48px 6px rgba(59,130,246,0.55), 0 0 110px 26px rgba(34,211,238,0.30), inset 0 -10px 22px rgba(99,102,241,0.55), inset 0 8px 16px rgba(255,255,255,0.30)',
            }} />
          </div>

          <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent-soft)', marginBottom: '0.9rem' }}>Safe Intelligence</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em', lineHeight: 1.05, whiteSpace: 'pre-line', background: (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light') ? 'linear-gradient(180deg, #1e293b 0%, #2563eb 130%)' : 'linear-gradient(180deg, #ffffff 0%, #bcd2ef 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your\naccount'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
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

        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: '100%', padding: '0.95rem', border: 'none', borderRadius: '999px',
            background: 'linear-gradient(135deg, var(--glow-a) 0%, var(--glow-b) 55%, var(--glow-c) 100%)',
            color: '#fff', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.01em',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            boxShadow: '0 8px 26px rgba(59,130,246,0.45)', marginTop: '0.25rem',
          }}
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

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
