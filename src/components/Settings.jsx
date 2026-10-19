import { useState } from 'react'
import { isBackendEnabled, supabase } from '../utils/supabase'
import { isBillingEnabled, openPortal } from '../utils/billing'
import { loadTerms, saveTerms, deidentifyText } from '../utils/deident'
import { sealVault } from '../utils/secureStore'
import TwoFactor from './TwoFactor'
import Legal from './Legal'
import { PageShell, SECTION_LABEL, CARD, INPUT, BTN_SECONDARY, BTN_MUTED } from './ui'

export default function Settings({ onBack, userEmail, onSignOut }) {
  const [showLegal, setShowLegal] = useState(false)
  const [delMode, setDelMode] = useState(false)
  const [delText, setDelText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [delErr, setDelErr] = useState('')

  const deleteAccount = async () => {
    setDeleting(true); setDelErr('')
    try {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      try { await sealVault() } catch (_) {}
      try { await supabase.auth.signOut() } catch (_) {}
      onSignOut?.()
    } catch (e) {
      setDelErr(e?.message || 'Could not delete account — try again, or email synradai@outlook.com.')
      setDeleting(false)
    }
  }
  // De-identification terms (company / sites / people to strip before upload).
  const initialTerms = loadTerms()
  const [company, setCompany] = useState(initialTerms.company || '')
  const [sites, setSites] = useState((initialTerms.sites || []).join(', '))
  const [people, setPeople] = useState((initialTerms.people || []).join(', '))
  const [deidentSaved, setDeidentSaved] = useState(false)

  const toList = (s) => s.split(',').map(x => x.trim()).filter(Boolean)
  const currentTerms = { company: company.trim(), sites: toList(sites), people: toList(people) }
  const saveDeident = () => {
    saveTerms(currentTerms)
    setDeidentSaved(true)
    setTimeout(() => setDeidentSaved(false), 2500)
  }
  const PREVIEW_SAMPLE = 'John Smith reported a near miss at North Pit for ACME Mining (call 0412 345 678).'

  return (
    <PageShell title="Settings" onBack={onBack}>
      {isBackendEnabled && (
        <div style={CARD}>
          <div style={SECTION_LABEL}>Account</div>
          {userEmail && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600 }}>
              Signed in as <span style={{ color: 'var(--accent-soft)', fontWeight: 700 }}>{userEmail}</span>
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isBillingEnabled && (
              <button onClick={() => openPortal().catch(() => {})} style={BTN_SECONDARY}>
                Manage Subscription
              </button>
            )}
            <button onClick={onSignOut} style={BTN_MUTED}>
              Sign Out
            </button>
          </div>

          {/* Danger zone — self-serve account deletion */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            {!delMode ? (
              <button onClick={() => { setDelMode(true); setDelErr(''); setDelText('') }} style={{ background: 'none', border: 'none', color: 'var(--error-text)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Delete my account
              </button>
            ) : (
              <div style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '0.5rem', padding: '0.875rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--error-text)', fontWeight: 700, margin: '0 0 0.4rem' }}>This permanently deletes your account and all your data.</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 0.6rem', lineHeight: 1.5 }}>Your shifts, incidents, reports, daily logs, learnings and Gaz chats will be erased and cannot be recovered. Type <b>DELETE</b> to confirm.</p>
                <input value={delText} onChange={e => setDelText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" style={{ ...INPUT, marginBottom: '0.6rem' }} />
                {delErr && <p style={{ fontSize: '0.72rem', color: 'var(--error-text)', fontWeight: 600, margin: '0 0 0.5rem' }}>{delErr}</p>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={deleteAccount} disabled={delText.trim().toUpperCase() !== 'DELETE' || deleting} style={{ padding: '0.55rem 1rem', backgroundColor: 'var(--danger)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-danger)', fontSize: '0.82rem', fontWeight: 800, cursor: (delText.trim().toUpperCase() === 'DELETE' && !deleting) ? 'pointer' : 'not-allowed', opacity: (delText.trim().toUpperCase() === 'DELETE' && !deleting) ? 1 : 0.4 }}>
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
                  <button onClick={() => { setDelMode(false); setDelErr('') }} disabled={deleting} style={{ padding: '0.55rem 1rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isBackendEnabled && <TwoFactor />}

      <div style={CARD}>
        <div style={SECTION_LABEL}>Privacy / De-identification</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
          List the names that should be stripped from your records before they leave this device.
          Emails and phone numbers are removed automatically. Photos already have their location/metadata removed.
        </p>

        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-soft)', marginBottom: '0.3rem' }}>Company name</div>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. ACME Mining" style={INPUT} />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-soft)', marginBottom: '0.3rem' }}>Site / location names <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>(comma-separated)</span></div>
          <input value={sites} onChange={e => setSites(e.target.value)} placeholder="North Pit, ROM pad, Workshop 2" style={INPUT} />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-soft)', marginBottom: '0.3rem' }}>People <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>(comma-separated)</span></div>
          <input value={people} onChange={e => setPeople(e.target.value)} placeholder="John Smith, Jane Doe" style={INPUT} />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-faint)', marginBottom: '0.3rem' }}>Preview</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, padding: '0.5rem 0.625rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
            {deidentifyText(PREVIEW_SAMPLE, currentTerms)}
          </div>
        </div>

        <button onClick={saveDeident} style={{ padding: '0.6rem 1.25rem', backgroundColor: deidentSaved ? 'var(--success-border)' : 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          {deidentSaved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div style={CARD}>
        <div style={SECTION_LABEL}>Legal &amp; Privacy</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
          How your data is handled, our terms, and the AI &amp; safety disclaimer.
        </p>
        <button onClick={() => setShowLegal(true)} style={BTN_SECONDARY}>
          View Legal &amp; Privacy
        </button>
      </div>

      <div style={{ ...CARD, padding: '1rem' }}>
        <div style={{ ...SECTION_LABEL, color: 'var(--text-faint)', marginBottom: '0.5rem' }}>About</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1.6, fontWeight: 500 }}>
          Safe Intelligence — built by <strong style={{ color: 'var(--text-muted)' }}>Synrad AI</strong>. Your data is stored securely in the cloud,
          isolated to your account, and encrypted in transit and at rest. Content you submit to the AI is processed by Anthropic (USA) —
          see Legal &amp; Privacy for details.
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', lineHeight: 1.5, fontWeight: 600, marginTop: '0.6rem' }}>
          © {new Date().getFullYear()} Synrad AI. All rights reserved. · synradai@outlook.com
        </p>
      </div>

      {showLegal && <Legal onClose={() => setShowLegal(false)} />}
    </PageShell>
  )
}
