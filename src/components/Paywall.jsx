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

        <ErrorBox style={{ marginBottom: '0.75rem', textAlign: 'left' }}>{error}</ErrorBox>

        <PrimaryButton onClick={subscribe} loading={loading}>
          {loading ? 'Opening checkout…' : 'Subscribe'}
        </PrimaryButton>

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
