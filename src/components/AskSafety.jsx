import { useState, useRef, useEffect } from 'react'
import { generateId } from '../utils/storage'
import { callAnthropicAPI, buildAskSafetyPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { FullScreenModal, TEXTAREA, ErrorBox } from './ui'

const BUBBLE_BASE = { maxWidth: '85%', padding: '0.6rem 0.875rem', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }

// Cycled while Gaz is thinking — keep 'em short and cheeky.
const THINKING = [
  'Gaz is having a squiz…',
  'Gaz is scratchin his head…',
  'Gaz is checkin the SWMS…',
  'Gaz is flickin through the reg book…',
  'Gaz is havin a yarn with head office…',
  'Gaz is sussin it out…',
  'Gaz is havin a gander…',
  'Gaz is crunchin the hazards…',
  'Gaz is consultin the hard hat…',
  'Gaz is duckin out for a smoko…',
  'Gaz is diggin through the codes…',
  'Gaz is reckonin on it…',
  'Gaz is doin a quick risk assessment…',
  'Gaz is checkin his clipboard…',
  'Gaz is havin a proper think, mate…',
  "Gaz is just at the pub, it's Friday lol…",
  'Gaz is on smoko, give him a sec…',
  'Gaz is findin his hi-vis…',
  'Gaz is gettin his steel caps on…',
  "Gaz reckons it's nearly knock-off…",
  'Gaz is dodgin the supervisor…',
  'Gaz is back from the crib room…',
  'Gaz is fillin out a permit…',
  'Gaz is on the two-way…',
  'Gaz is squintin at the SDS…',
  'Gaz is double-checkin the isolation…',
  'Gaz is countin the witches hats…',
  'Gaz is havin a chinwag with the sparkies…',
  'Gaz is lookin for his clipboard… again…',
  'Gaz is just finishin his pie…',
  'Gaz is on the blower to the boss…',
  "Gaz is checkin if it's an RDO…",
  'Gaz is wranglin the paperwork…',
  'Gaz is duckin a toolbox talk…',
  'Gaz spilled his coffee, hang on…',
  'Gaz reckons that’s a bloody good question…',
  'Gaz is waitin on the bus, FIFO life…',
  'Gaz is checkin the muster point…',
]
const randThinking = () => THINKING[Math.floor(Math.random() * THINKING.length)]

const nowISO = () => new Date().toISOString()
const titleFrom = (q) => (q.length > 42 ? q.slice(0, 42).trim() + '…' : q)

// Pair up a flat message list into {question, answer} for prompt context.
function pairsFrom(msgs) {
  const out = []
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role === 'user') {
      const next = msgs[i + 1]
      out.push({ question: msgs[i].text, answer: next && next.role === 'assistant' ? next.text : '' })
    }
  }
  return out
}

export default function AskSafety({ initialChats = [], onPersist, apiKey, learnings, onClose }) {
  // Conversations live here and sync up to the app for persistence. Opening
  // Gaz starts a fresh chat (activeId = null); past chats sit in the drawer.
  const [chats, setChats] = useState(initialChats)
  const [activeId, setActiveId] = useState(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [thinking, setThinking] = useState(THINKING[0])
  const bottomRef = useRef(null)

  useEffect(() => { onPersist && onPersist(chats) }, [chats])

  // Cycle the cheeky "thinking" line while Gaz works.
  useEffect(() => {
    if (!loading) return
    setThinking(randThinking())
    const id = setInterval(() => setThinking(randThinking()), 1900)
    return () => clearInterval(id)
  }, [loading])

  const activeChat = chats.find(c => c.id === activeId)
  const messages = activeChat ? activeChat.messages : []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, loading])

  const newChat = () => { setActiveId(null); setQuestion(''); setError(''); setDrawerOpen(false) }
  const openChat = (id) => { setActiveId(id); setError(''); setDrawerOpen(false) }
  const deleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const ask = async () => {
    const q = question.trim()
    if (!q || loading) return
    setQuestion(''); setError(''); setLoading(true)

    const prior = pairsFrom(messages).slice(-3)
    const isNew = !activeId
    const convId = activeId || generateId()
    const userMsg = { role: 'user', text: q }

    setChats(prev => isNew
      ? [{ id: convId, title: titleFrom(q), createdAt: nowISO(), updatedAt: nowISO(), messages: [userMsg] }, ...prev]
      : prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: nowISO() } : c)
    )
    if (isNew) setActiveId(convId)

    try {
      const answer = await callAnthropicAPI(apiKey, buildAskSafetyPrompt(q, learnings, prior), 400)
      const aMsg = { role: 'assistant', text: answer }
      setChats(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, aMsg], updatedAt: nowISO() } : c))
    } catch (e) {
      setError(e.message)
      setQuestion(q)
      // Roll back the unanswered question; drop the chat if it was brand new.
      setChats(prev => prev.flatMap(c => {
        if (c.id !== convId) return [c]
        const msgs = c.messages.slice(0, -1)
        return msgs.length ? [{ ...c, messages: msgs }] : []
      }))
      if (isNew) setActiveId(null)
    } finally { setLoading(false) }
  }

  const hamburger = (
    <button
      onClick={() => setDrawerOpen(true)}
      aria-label="Previous chats"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem 0.35rem', display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      {[0, 1, 2].map(i => <span key={i} style={{ display: 'block', width: 18, height: 2, borderRadius: 2, backgroundColor: 'currentColor' }} />)}
    </button>
  )

  const drawer = drawerOpen ? (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex' }}>
      <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: '82%', maxWidth: 320, backgroundColor: 'var(--bg-panel)', borderRight: '1px solid var(--border-accent)', height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={newChat}
            style={{ width: '100%', padding: '0.7rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.6rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ＋ New chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', padding: '0.4rem 0.6rem' }}>Previous chats</div>
          {chats.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', padding: '0.4rem 0.6rem', fontWeight: 600 }}>No chats yet — ask Gaz something.</p>
          ) : (
            chats.map(c => (
              <div
                key={c.id}
                onClick={() => openChat(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.6rem', borderRadius: '0.5rem', cursor: 'pointer', backgroundColor: c.id === activeId ? 'var(--border-accent)' : 'transparent', marginBottom: 2 }}
              >
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }}
                  aria-label="Delete chat"
                  style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem', flexShrink: 0 }}
                >×</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <FullScreenModal
      badge="👷"
      title="Ask Gaz"
      onClose={onClose}
      headerLeft={hamburger}
      overlay={drawer}
      footer={
        <div>
          <ErrorBox style={{ marginBottom: '0.5rem' }}>{error}</ErrorBox>
          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', margin: '0 0 0.5rem', fontWeight: 600 }}>No API key — go to Settings to enable Gaz.</p>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-accent)', borderRadius: '1.4rem', padding: '0.5rem 0.5rem 0.5rem 0.9rem' }}>
            <div style={{ flex: 1 }}>
              <SafetyTextarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask Gaz anything..."
                rows={1}
                minimal
                style={{ ...TEXTAREA, resize: 'none', border: 'none', backgroundColor: 'transparent', padding: '0.4rem 0', minHeight: '1.6rem' }}
                apiKey={apiKey}
              />
            </div>
            <button
              onClick={ask}
              disabled={loading || !question.trim() || !apiKey}
              aria-label="Send"
              style={{
                width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none',
                background: (loading || !question.trim() || !apiKey) ? 'var(--border)' : 'linear-gradient(135deg, var(--glow-a), var(--glow-c))',
                color: '#fff', fontWeight: 800, fontSize: '1.15rem', lineHeight: 1,
                cursor: (loading || !question.trim() || !apiKey) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || !question.trim() || !apiKey) ? 'none' : '0 0 16px rgba(59,130,246,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {loading ? '…' : '↑'}
            </button>
          </div>
        </div>
      }
    >
      {messages.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2.5rem 1rem', minHeight: '40vh' }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', margin: '0 auto 1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem',
            background: 'radial-gradient(circle at 50% 34%, #bfdbfe 0%, var(--glow-a) 60%, #1e3a8a 100%)',
            boxShadow: '0 0 42px 6px rgba(59,130,246,0.45), inset 0 6px 12px rgba(255,255,255,0.3)',
          }}>👷</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>G'day, I'm Gaz.</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontWeight: 600, maxWidth: '20rem' }}>
            Your safety offsider. Ask me anything — a hazard, an incident, site rules, what the law says. Quick, straight answers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, borderRadius: '1rem 1rem 0.25rem 1rem' }}>
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '1rem 1rem 1rem 0.25rem' }}>
                  {m.text}
                </div>
              </div>
            )
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ ...BUBBLE_BASE, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-faint)', borderRadius: '1rem 1rem 1rem 0.25rem', fontStyle: 'italic' }}>
                {thinking}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </FullScreenModal>
  )
}
