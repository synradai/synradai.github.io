import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { FIELD_LABEL, INPUT, ErrorBox } from './ui'

// Shown when Supabase's auth state fires PASSWORD_RECOVERY — the user has
// just landed back from the reset-link email and needs to set a new password
// before continuing into the app.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onDone()
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
          <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent-soft)', marginBottom: '0.9rem' }}>Safe Intelligence</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Set a new password</h1>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={FIELD_LABEL}>New password</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" style={INPUT} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={FIELD_LABEL}>Confirm password</div>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={INPUT}
          />
        </div>

        <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: '100%', padding: '0.95rem', border: 'none', borderRadius: '999px',
            background: 'linear-gradient(135deg, var(--glow-a) 0%, var(--glow-b) 55%, var(--glow-c) 100%)',
            color: '#fff', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.01em',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            boxShadow: '0 8px 26px rgba(255,157,61,0.45)',
          }}
        >
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </div>
    </div>
  )
}
