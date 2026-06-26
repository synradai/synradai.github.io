import { useState } from 'react'
import { callAnthropicAPI, buildFindingsPrompt } from '../../utils/api'
import { TAG_STYLES } from '../../constants'
import SectionBlock from '../SectionBlock'
import SafetyTextarea from '../SafetyTextarea'
import { PhaseHeader, TEXTAREA, ErrorBox, ShareButton } from '../ui'

export default function FindingsMeeting({ shift, updateShift, apiKey }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState([false])
  const confirm = (i) => setConfirmed(prev => { const n = [...prev]; n[i] = !n[i]; return n })

  const report = shift.findingsReport || ''
  const rounds = shift.rounds || []

  const generate = async () => {
    if (!rounds.length) { setError('No site rounds entries to summarise.'); return }
    setLoading(true); setError('')
    try {
      const text = await callAnthropicAPI(apiKey, buildFindingsPrompt(rounds))
      updateShift({ findingsReport: text })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const copy = () => {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tagCounts = ['Hazard', 'Action', 'Near Miss', 'Observation'].map(tag => ({
    tag, count: rounds.filter(r => r.tag === tag).length,
  }))

  return (
    <div style={{ padding: '1.5rem 1rem' }}>
      <PhaseHeader
        phase={4}
        title="Findings Meeting"
        blurb="Present what you found on rounds. Generate a structured report from today's entries — edit it before you present."
      />

      {/* Stats */}
      {rounds.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {tagCounts.map(({ tag, count }) => {
            const s = TAG_STYLES[tag] || TAG_STYLES.Observation
            return (
              <div key={tag} style={{ backgroundColor: s.bg, border: `1px solid ${s.border}40`, borderRadius: '0.5rem', padding: '0.625rem', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color: s.text }}>{count}</div>
                <div style={{ fontSize: '0.65rem', color: s.text, marginTop: '0.2rem', fontWeight: 700, opacity: 0.8 }}>{tag}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginBottom: '1.75rem' }}>
        <SectionBlock
          title="Findings Report"
          hint={report ? 'AI generated — edit before presenting' : 'Generate from rounds entries'}
          confirmed={confirmed[0]}
          onConfirm={() => confirm(0)}
          confirmLabel="report"
        >
          <button
            onClick={generate}
            disabled={loading}
            style={{ width: '100%', padding: '0.875rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: '0.75rem' }}
          >
            {loading ? 'Generating Report...' : report ? 'Regenerate (AI)' : 'Generate Findings Report (AI)'}
          </button>

          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textAlign: 'center', marginBottom: '0.5rem', fontWeight: 600 }}>No API key — go to Settings</p>}
          {!rounds.length && <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center', marginBottom: '0.5rem', fontWeight: 600 }}>No rounds entries yet — go to Site Rounds to log observations first.</p>}

          <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

          {report && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <ShareButton title="Findings Report" getText={() => shift.findingsReport || ''} />
                <button
                  onClick={copy}
                  style={{ padding: '0.25rem 0.625rem', border: 'none', borderRadius: '0.25rem', backgroundColor: copied ? 'var(--success-border)' : 'var(--border)', color: copied ? 'var(--success-text)' : 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <SafetyTextarea
                value={report}
                onChange={e => updateShift({ findingsReport: e.target.value })}
                rows={22}
                style={{ ...TEXTAREA, fontSize: '0.8rem' }}
                apiKey={apiKey}
              />
            </>
          )}
        </SectionBlock>
      </div>
    </div>
  )
}
