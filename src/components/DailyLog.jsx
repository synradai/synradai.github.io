import { useState } from 'react'
import { generateId } from '../utils/storage'
import { formatTime, formatDate } from '../utils/format'
import { callAnthropicAPI, buildDaySummaryPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { PageShell, SECTION_LABEL, TEXTAREA, EMPTY_PAGE, ErrorBox, ShareButton } from './ui'

const dayKey = (iso) => new Date(iso).toDateString()

// A personal, voice-first activity diary — "what I've been up to today" — kept
// so an advisor can answer "what did you get done?" on the spot. No photos.
export default function DailyLog({ entries, onAdd, onRemove, apiKey, onBack }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)

  const todayKey = new Date().toDateString()
  const sorted = [...entries].sort((a, b) => new Date(a.time) - new Date(b.time))
  const today = sorted.filter(e => dayKey(e.time) === todayKey)
  const earlier = sorted.filter(e => dayKey(e.time) !== todayKey)

  const earlierByDay = {}
  for (const e of earlier) (earlierByDay[dayKey(e.time)] ||= []).push(e)
  const earlierDays = Object.keys(earlierByDay).sort((a, b) => new Date(b) - new Date(a))

  const log = () => {
    if (!text.trim()) return
    onAdd({ id: generateId(), time: new Date().toISOString(), text: text.trim() })
    setText(''); setError('')
  }

  const sumUpDay = async () => {
    if (!today.length) return
    setSummarizing(true); setError('')
    try {
      const s = await callAnthropicAPI(apiKey, buildDaySummaryPrompt(today), 800)
      setSummary(s.trim())
    } catch (e) { setError(e.message) }
    finally { setSummarizing(false) }
  }

  const entryRow = (e, last) => (
    <div key={e.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.7rem 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 800, fontFamily: 'monospace', flexShrink: 0, paddingTop: '0.1rem', minWidth: '3rem' }}>{formatTime(e.time)}</span>
      <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.text}</p>
      <button onClick={() => onRemove(e.id)} aria-label="Delete" style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
    </div>
  )

  const listCard = (rows) => (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.3rem 1rem' }}>
      {rows.map((e, i) => entryRow(e, i === rows.length - 1))}
    </div>
  )

  return (
    <PageShell title="Daily Log" onBack={onBack}>
      {/* Quick add */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={SECTION_LABEL}>What are you up to?</div>
        <SafetyTextarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Tap the mic and talk — e.g. 'had the 10 o'clock pre-start, then did rounds and checked on the crew at the workshop...'"
          rows={6}
          style={{ ...TEXTAREA, minHeight: '9rem' }}
          apiKey={apiKey}
        />
        <ErrorBox style={{ marginTop: '0.5rem' }}>{error}</ErrorBox>
        <button
          onClick={log}
          disabled={!text.trim()}
          style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.9rem', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.4 }}
        >
          Log it
        </button>
      </div>

      {/* Today header + sum-up */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={SECTION_LABEL}>Today</div>
        {today.length > 0 && (
          <button
            onClick={sumUpDay}
            disabled={summarizing}
            style={{ padding: '0.35rem 0.8rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontWeight: 800, fontSize: '0.72rem', cursor: summarizing ? 'wait' : 'pointer' }}
          >
            {summarizing ? 'Summing up…' : '✨ Sum up my day'}
          </button>
        )}
      </div>

      {summary && (
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>Your day, summed up</span>
            <ShareButton title="My day" getText={() => summary} />
          </div>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={8} style={TEXTAREA} />
        </div>
      )}

      {today.length === 0
        ? <p style={{ ...EMPTY_PAGE, marginTop: 0, marginBottom: '1.5rem' }}>Nothing logged today yet — tap the mic and talk.</p>
        : <div style={{ marginBottom: '1.75rem' }}>{listCard(today)}</div>}

      {/* Earlier days */}
      {earlierDays.map(k => (
        <div key={k} style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...SECTION_LABEL, color: 'var(--text-muted)' }}>{formatDate(earlierByDay[k][0].time)}</div>
          {listCard(earlierByDay[k])}
        </div>
      ))}
    </PageShell>
  )
}
