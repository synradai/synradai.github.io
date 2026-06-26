import { useState } from 'react'
import { generateId } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { callAnthropicAPI, buildLearningPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { PageShell, SECTION_LABEL, TEXTAREA, EMPTY_PAGE, ErrorBox } from './ui'

export default function Learnings({ entries, onAdd, onRemove, apiKey, onBack }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tidy = async () => {
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      const tidied = await callAnthropicAPI(apiKey, buildLearningPrompt(text), 500)
      setText(tidied)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const save = () => {
    if (!text.trim()) return
    onAdd({ id: generateId(), time: new Date().toISOString(), text: text.trim() })
    setText('')
    setError('')
  }

  return (
    <PageShell title="Learnings" onBack={onBack}>
      {/* New entry */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={SECTION_LABEL}>New Lesson Learned</div>
        <SafetyTextarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What happened, what you'd do differently, what to watch for next time..."
          rows={4}
          style={TEXTAREA}
          apiKey={apiKey}
        />

        <ErrorBox style={{ marginTop: '0.5rem' }}>{error}</ErrorBox>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            onClick={tidy}
            disabled={loading || !text.trim()}
            style={{ flex: 1, padding: '0.625rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontWeight: 700, fontSize: '0.85rem', cursor: (!text.trim() || loading) ? 'not-allowed' : 'pointer', opacity: (!text.trim() || loading) ? 0.4 : 1 }}
          >
            {loading ? 'Tidying...' : 'Tidy with AI'}
          </button>
          <button
            onClick={save}
            disabled={!text.trim()}
            style={{ flex: 1, padding: '0.625rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.85rem', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.4 }}
          >
            Save Entry
          </button>
        </div>

        {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.5rem', fontWeight: 600 }}>No API key — go to Settings to enable AI tidy-up.</p>}
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <p style={EMPTY_PAGE}>No learnings recorded yet.</p>
      ) : [...entries].reverse().map(entry => (
        <div key={entry.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700 }}>{formatDateTime(entry.time)}</span>
            <button onClick={() => onRemove(entry.id)} style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>✕</button>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.text}</p>
        </div>
      ))}
    </PageShell>
  )
}
