import { useState } from 'react'
import { generateId } from '../utils/storage'
import { formatTime, formatDate } from '../utils/format'
import { callAnthropicAPI, buildDaySummaryPrompt } from '../utils/api'
import { buzz } from '../utils/haptics'
import SafetyTextarea from './SafetyTextarea'
import { MicIcon } from './icons'
import { PageShell, FullScreenModal, SECTION_LABEL, TEXTAREA, EMPTY_PAGE, ErrorBox, ShareButton, FullScreenButton, BTN_SECONDARY, CaptureBar, CAPTION_TEXTAREA } from './ui'

const dayKey = (iso) => new Date(iso).toDateString()
const hourLabel = (h) => { const ampm = h < 12 ? 'am' : 'pm'; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr} ${ampm}` }

// A personal, voice-first activity diary — "what I've been up to today" — kept
// so an advisor can answer "what did you get done?" on the spot. No photos.
export default function DailyLog({ entries, onAdd, onRemove, apiKey, onBack }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [composing, setComposing] = useState(false)

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
    buzz(20)
    setText(''); setError('')
    setComposing(false)
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

  const entryRow = (e) => (
    <div key={e.id} className="entry-in" style={{ display: 'flex', gap: '0.6rem', padding: '0.4rem 0', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0, paddingTop: '0.15rem', minWidth: '2.7rem' }}>{formatTime(e.time)}</span>
      <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.text}</p>
      <button onClick={() => onRemove(e.id)} aria-label="Delete" style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
    </div>
  )

  // Hourly timeline — entries bucketed under the hour they were logged, so the
  // day reads like a diary you can scan.
  const dayTimeline = (rows) => {
    const buckets = {}
    for (const e of rows) (buckets[new Date(e.time).getHours()] ||= []).push(e)
    const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b)
    return (
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
        {hours.map(h => (
          <div key={h} style={{ display: 'flex', gap: '0.85rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2.6rem', flexShrink: 0, fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-soft)', textAlign: 'right', paddingTop: '0.5rem' }}>{hourLabel(h)}</div>
            <div style={{ flex: 1, borderLeft: '2px solid var(--border-accent)', paddingLeft: '0.85rem' }}>
              {buckets[h].map(entryRow)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <PageShell title="Daily Log" onBack={onBack}>
      {/* Capture bar — opens the full-page composer */}
      <CaptureBar
        onClick={() => setComposing(true)}
        prompt="What are you up to? Tap and talk…"
        icon={<MicIcon size={18} />}
        style={{ marginBottom: '1.25rem' }}
      />

      {/* Full-page composer */}
      {composing && (
        <FullScreenModal
          badgeEl={
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)' }}>
              <MicIcon size={15} />
            </div>
          }
          title="Daily Log"
          onClose={() => setComposing(false)}
          footer={
            <button
              onClick={log}
              disabled={!text.trim()}
              style={{ width: '100%', padding: '0.8rem', border: 'none', borderRadius: '999px', background: text.trim() ? 'linear-gradient(135deg, var(--glow-b), var(--glow-c))' : 'var(--border)', color: text.trim() ? '#fff' : 'var(--text-faint)', fontWeight: 800, fontSize: '0.9rem', cursor: text.trim() ? 'pointer' : 'not-allowed', boxShadow: text.trim() ? '0 6px 20px rgba(79,141,247,0.35)' : 'none' }}
            >
              Log it
            </button>
          }
        >
          <SafetyTextarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Tap the mic and talk — e.g. 'had the 10 o'clock pre-start, then did rounds and checked on the crew at the workshop...'"
            rows={10}
            style={{ ...CAPTION_TEXTAREA, minHeight: '45vh' }}
            apiKey={apiKey}
          />
          <ErrorBox style={{ marginTop: '0.5rem' }}>{error}</ErrorBox>
        </FullScreenModal>
      )}

      {/* Today header + sum-up */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={SECTION_LABEL}>Today</div>
        {today.length > 0 && (
          <button
            onClick={sumUpDay}
            disabled={summarizing}
            style={{ ...BTN_SECONDARY, padding: '0.35rem 0.8rem', fontWeight: 800, fontSize: '0.72rem', cursor: summarizing ? 'wait' : 'pointer' }}
          >
            {summarizing ? 'Summing up…' : '✨ Sum up my day'}
          </button>
        )}
      </div>

      {summary && (
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Your day, summed up</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FullScreenButton label="Your day, summed up" value={summary} onChange={e => setSummary(e.target.value)} />
              <ShareButton title="My day" getText={() => summary} />
            </div>
          </div>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={8} style={TEXTAREA} />
        </div>
      )}

      {today.length === 0
        ? <p style={{ ...EMPTY_PAGE, marginTop: 0, marginBottom: '1.5rem' }}>Nothing logged today yet — tap the mic and talk.</p>
        : <div style={{ marginBottom: '1.75rem' }}>{dayTimeline(today)}</div>}

      {/* Earlier days */}
      {earlierDays.map(k => (
        <div key={k} style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...SECTION_LABEL, color: 'var(--text-muted)' }}>{formatDate(earlierByDay[k][0].time)}</div>
          {dayTimeline(earlierByDay[k])}
        </div>
      ))}
    </PageShell>
  )
}
