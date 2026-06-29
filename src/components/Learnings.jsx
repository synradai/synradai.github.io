import { useState, useRef, useEffect } from 'react'
import { generateId } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { callAnthropicAPI, buildLearningPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { FullScreenModal, TEXTAREA, ErrorBox } from './ui'

export default function Learnings({ entries, onAdd, onRemove, apiKey, onBack }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  // Oldest first so new lessons land at the bottom, by the input (fills up).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length])

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
    setText(''); setError('')
  }

  return (
    <FullScreenModal
      badge="💡"
      title="Learnings"
      onClose={onBack}
      footer={
        <div>
          <ErrorBox style={{ marginBottom: '0.5rem' }}>{error}</ErrorBox>
          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: '0 0 0.5rem', fontWeight: 600 }}>No API key — go to Settings to enable AI tidy-up.</p>}
          <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-accent)', borderRadius: '1rem', padding: '0.6rem 0.75rem' }}>
            <SafetyTextarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What happened, what you'd do differently, what to watch for next time..."
              rows={4}
              style={{ ...TEXTAREA, border: 'none', backgroundColor: 'transparent', resize: 'none', minHeight: '6rem', padding: '0.25rem 0' }}
              apiKey={apiKey}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button
                onClick={tidy}
                disabled={loading || !text.trim()}
                style={{ flex: 1, padding: '0.6rem', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: '0.6rem', color: 'var(--accent-soft)', fontWeight: 700, fontSize: '0.82rem', cursor: (!text.trim() || loading) ? 'not-allowed' : 'pointer', opacity: (!text.trim() || loading) ? 0.4 : 1 }}
              >
                {loading ? 'Tidying…' : '✨ Tidy with AI'}
              </button>
              <button
                onClick={save}
                disabled={!text.trim()}
                style={{ flex: 1, padding: '0.6rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.6rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.82rem', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.4 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      }
    >
      {entries.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem 1rem', minHeight: '40vh' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>💡</div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, maxWidth: '18rem', lineHeight: 1.5 }}>
            Jot down lessons learned as they happen. They build up here — and Gaz uses them to tailor his answers to you.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(entry => (
            <div key={entry.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.85rem', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-soft)', fontWeight: 700 }}>{formatDateTime(entry.time)}</span>
                <button onClick={() => onRemove(entry.id)} aria-label="Delete" style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </FullScreenModal>
  )
}
