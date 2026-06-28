import { useState } from 'react'
import { callAnthropicAPI, isProxyMode } from '../utils/api'
import { isBackendEnabled } from '../utils/supabase'
import { isBillingEnabled, openPortal } from '../utils/billing'
import { loadTerms, saveTerms, deidentifyText } from '../utils/deident'
import TwoFactor from './TwoFactor'
import Legal from './Legal'
import { PageShell, SECTION_LABEL, CARD, INPUT } from './ui'

// Strip whitespace and invisible characters that sneak in when copying keys
// from email/notes apps (zero-width spaces, line breaks, smart quotes, etc.)
function cleanKey(raw) {
  return (raw || '').replace(/[^A-Za-z0-9_-]/g, '')
}

export default function Settings({ apiKey, onSave, onBack, userEmail, onSignOut }) {
  const [key, setKey] = useState(apiKey)
  const [visible, setVisible] = useState(false)
  const [showLegal, setShowLegal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok: bool, msg: string }

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

  const cleaned = cleanKey(key)
  const looksWrong = cleaned && !cleaned.startsWith('sk-ant-')

  const handleSave = () => {
    setKey(cleaned)
    onSave(cleaned)
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 2500)
  }

  const testKey = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await callAnthropicAPI(cleaned, 'Reply with the word: ok', 5)
      setTestResult({ ok: true, msg: '✓ Key works — AI features are good to go.' })
    } catch (e) {
      const sent = `Key sent: ${cleaned.slice(0, 14)}...${cleaned.slice(-4)} (${cleaned.length} characters — a full key is usually 100-110).`
      let hint = ''
      if (/invalid x-api-key/i.test(e.message)) {
        hint = cleaned.length < 95
          ? 'The key looks too short — part of it was missed when copying. In the Anthropic console, use the Copy button next to the key (don\'t select it by hand), then paste here again.'
          : 'Anthropic doesn\'t recognise this key. It may have been deleted/revoked, or belong to a different account than you expect. Create a brand-new key, use the Copy button, and paste it here in one go.'
      } else if (/credit balance/i.test(e.message)) {
        hint = 'The key is VALID but the account has no API credits. Go to console.anthropic.com → Billing and add credits — the API is billed separately from a Claude.ai subscription.'
      }
      setTestResult({ ok: false, msg: `${e.message}\n\n${sent}${hint ? `\n\n${hint}` : ''}` })
    } finally {
      setTesting(false)
    }
  }

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
              <button onClick={() => openPortal().catch(() => {})} style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
                Manage Subscription
              </button>
            )}
            <button onClick={onSignOut} style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {isBackendEnabled && <TwoFactor />}

      {!isProxyMode && (
      <div style={CARD}>
        <div style={SECTION_LABEL}>Anthropic API Key</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6, fontWeight: 500 }}>
          Required for AI-generated reports and handover notes. Get your key from{' '}
          <span style={{ color: 'var(--accent-soft)', fontWeight: 700 }}>console.anthropic.com</span>.
          Stored only in your browser — sent directly to Anthropic, nowhere else.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={e => { setKey(e.target.value); setTestResult(null) }}
            placeholder="sk-ant-..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            style={{ ...INPUT, width: undefined, flex: 1, fontFamily: 'monospace' }}
          />
          <button onClick={() => setVisible(v => !v)} style={{ padding: '0 1rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>

        {cleaned && (
          <p style={{ fontSize: '0.7rem', color: looksWrong ? 'var(--warning-text)' : 'var(--text-faint)', marginBottom: '0.75rem', fontWeight: 600 }}>
            {looksWrong
              ? `⚠ Doesn't look like an Anthropic key — should start with sk-ant-. Check you copied the key itself, not its name.`
              : `Key: ${cleaned.slice(0, 10)}...${cleaned.slice(-4)} (${cleaned.length} characters)`}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleSave} style={{ padding: '0.6rem 1.25rem', backgroundColor: saved ? 'var(--success-border)' : 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
            {saved ? '✓ Saved' : 'Save Key'}
          </button>
          <button
            onClick={testKey}
            disabled={!cleaned || testing}
            style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontSize: '0.875rem', fontWeight: 700, cursor: (!cleaned || testing) ? 'not-allowed' : 'pointer', opacity: (!cleaned || testing) ? 0.5 : 1 }}
          >
            {testing ? 'Testing...' : 'Test Key'}
          </button>
          {key && (
            <button onClick={() => { setKey(''); onSave(''); setTestResult(null) }} style={{ padding: '0.6rem 1rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>

        {testResult && (
          <div style={{
            marginTop: '0.75rem', padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
            backgroundColor: testResult.ok ? 'var(--success-bg)' : 'var(--error-bg)',
            border: `1px solid ${testResult.ok ? 'var(--success-border)' : 'var(--error-border)'}`,
            color: testResult.ok ? 'var(--success-text)' : 'var(--error-text)',
          }}>
            {testResult.msg}
            {!testResult.ok && /invalid/i.test(testResult.msg) && (
              <div style={{ marginTop: '0.4rem', fontWeight: 500 }}>
                This key isn't being accepted by Anthropic. Go to console.anthropic.com → API Keys, create a new key, copy the full key in one go, paste it here, then Save and Test again.
              </div>
            )}
          </div>
        )}
      </div>
      )}

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
        <button onClick={() => setShowLegal(true)} style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          View Legal &amp; Privacy
        </button>
      </div>

      <div style={{ ...CARD, padding: '1rem' }}>
        <div style={{ ...SECTION_LABEL, color: 'var(--text-faint)', marginBottom: '0.5rem' }}>About</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1.6, fontWeight: 500 }}>
          Safe Intelligence by Synrad AI. Your data is stored securely in the cloud, isolated to your account,
          and encrypted in transit and at rest. Content you submit to the AI is processed by Anthropic (USA) —
          see Legal &amp; Privacy for details.
        </p>
      </div>

      {showLegal && <Legal onClose={() => setShowLegal(false)} />}
    </PageShell>
  )
}
