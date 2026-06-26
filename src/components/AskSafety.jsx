import { useState, useRef, useEffect } from 'react'
import { generateId } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { callAnthropicAPI, buildAskSafetyPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { FullScreenModal, TEXTAREA, ErrorBox } from './ui'

const BUBBLE_BASE = { maxWidth: '85%', padding: '0.6rem 0.875rem', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }

export default function AskSafety({ entries, onAdd, onRemove, apiKey, learnings, onClose }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, loading])

  const ask = async () => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    setLoading(true); setError('')
    try {
      const priorQA = entries.slice(-3).map(e => ({ question: e.question, answer: e.answer }))
      const answer = await callAnthropicAPI(apiKey, buildAskSafetyPrompt(q, learnings, priorQA), 400)
      onAdd({ id: generateId(), time: new Date().toISOString(), question: q, answer })
    } catch (e) {
      setError(e.message)
      setQuestion(q)
    } finally { setLoading(false) }
  }

  return (
    <FullScreenModal
      badge="✨"
      title="Ask AI Safety"
      onClose={onClose}
      footer={
        <div>
          <ErrorBox style={{ marginBottom: '0.5rem' }}>{error}</ErrorBox>
          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: '0 0 0.5rem', fontWeight: 600 }}>No API key — go to Settings to enable Ask AI Safety.</p>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <SafetyTextarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask a safety question..."
                rows={2}
                style={{ ...TEXTAREA, resize: 'none' }}
                apiKey={apiKey}
              />
            </div>
            <button
              onClick={ask}
              disabled={loading || !question.trim() || !apiKey}
              style={{ padding: '0.7rem 1.1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.875rem', cursor: (loading || !question.trim() || !apiKey) ? 'not-allowed' : 'pointer', opacity: (loading || !question.trim() || !apiKey) ? 0.5 : 1, flexShrink: 0 }}
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      }
    >
      {entries.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
            Get a quick answer based on Australian WHS/mining law, common practice at major operators (FMG, BHP, Rio Tinto, Woodside), incident investigation methods (ICAM, TapRooT, 5 Whys, etc.), and your own logged Learnings. Ask follow-ups — it remembers the last few messages.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {entries.map(entry => (
            <div key={entry.id}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, borderRadius: '1rem 1rem 0.25rem 1rem' }}>
                  {entry.question}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '1rem 1rem 1rem 0.25rem' }}>
                  {entry.answer}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 600 }}>{formatDateTime(entry.time)}</span>
                <button onClick={() => onRemove(entry.id)} style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, padding: 0 }}>Remove</button>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-faint)', borderRadius: '1rem 1rem 1rem 0.25rem', fontStyle: 'italic' }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </FullScreenModal>
  )
}
