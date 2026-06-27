import { useState, useRef, useEffect } from 'react'
import { generateId } from '../utils/storage'
import { callAnthropicAPI, buildAskSafetyPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { FullScreenModal, TEXTAREA, ErrorBox } from './ui'

const BUBBLE_BASE = { maxWidth: '85%', padding: '0.6rem 0.875rem', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }

export default function AskSafety({ entries, onAdd, onRemove, apiKey, learnings, onClose }) {
  // Fresh conversation every time you open Gaz. We still quietly persist each
  // Q&A via onAdd (for future history + question analytics), but the visible
  // chat starts clean on each open, Claude-style.
  const [session, setSession] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [session.length, loading])

  const ask = async () => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    setLoading(true); setError('')
    try {
      const priorQA = session.slice(-3).map(e => ({ question: e.question, answer: e.answer }))
      const answer = await callAnthropicAPI(apiKey, buildAskSafetyPrompt(q, learnings, priorQA), 400)
      const entry = { id: generateId(), time: new Date().toISOString(), question: q, answer }
      setSession(s => [...s, entry])
      onAdd(entry)
    } catch (e) {
      setError(e.message)
      setQuestion(q)
    } finally { setLoading(false) }
  }

  return (
    <FullScreenModal
      badge="👷"
      title="Ask Gaz"
      onClose={onClose}
      footer={
        <div>
          <ErrorBox style={{ marginBottom: '0.5rem' }}>{error}</ErrorBox>
          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: '0 0 0.5rem', fontWeight: 600 }}>No API key — go to Settings to enable Gaz.</p>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <SafetyTextarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask Gaz anything..."
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
      {session.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2.5rem 1rem', minHeight: '40vh' }}>
          <div style={{ fontSize: '2.75rem', marginBottom: '0.5rem' }}>👷</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>G'day, I'm Gaz.</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontWeight: 600, maxWidth: '20rem' }}>
            Your safety offsider. Ask me anything — a hazard, an incident, site rules, what the law says. Quick, straight answers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {session.map(entry => (
            <div key={entry.id}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, borderRadius: '1rem 1rem 0.25rem 1rem' }}>
                  {entry.question}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '1rem 1rem 1rem 0.25rem' }}>
                  {entry.answer}
                </div>
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
