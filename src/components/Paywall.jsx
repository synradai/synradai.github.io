import { useState } from 'react'
import { startCheckout } from '../utils/billing'
import { PrimaryButton, ErrorBox } from './ui'

// Shown when the free trial has ended and there's no active subscription.
// Sign-out stays available so a user can switch accounts.
export default function Paywall({ onSignOut, expired }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subscribe = async () => {
    setLoading(true); setError('')
    try {
      await startCheckout() // redirects to Stripe
    } catch (e) {
      setError(e?.message || 'Could not start checkout.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          {expired ? 'Your trial has ended' : 'Subscribe to continue'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6, fontWeight: 600 }}>
          Keep full access to shift tracking, incident reports, and AI write-ups.
          Your saved records are safe and will be here when you subscribe.
        </p>

        {/* Price card — the number someone actually needs to decide */}
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '1rem', padding: '1.4rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--accent)', marginBottom: '0.6rem' }}>
            Early supporter pricing
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.15rem' }}>
            <span style={{ fontSize: '2.9rem', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg, var(--glow-a), var(--accent))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              $29
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)' }}>/month</span>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            for your first 6 months
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-faint)', marginTop: '0.2rem' }}>
            then $49/month · cancel anytime
          </div>
        </div>

        <ErrorBox style={{ marginBottom: '0.75rem', textAlign: 'left' }}>{error}</ErrorBox>

        <PrimaryButton onClick={subscribe} loading={loading}>
          {loading ? 'Opening checkout…' : 'Subscribe'}
        </PrimaryButton>

        <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600, margin: '0.9rem 0 0', lineHeight: 1.5 }}>
          Secure checkout via Stripe. No lock-in — cancel any time from Settings.
        </p>

        <button
          onClick={onSignOut}
          style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
