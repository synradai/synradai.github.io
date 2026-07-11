import { useState, useEffect } from 'react'
import { formatDate } from '../utils/format'
import { buzz } from '../utils/haptics'

// Count up to a number with an ease-out — instant under reduced motion.
function useCountUp(target, ms = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(target); return }
    let raf, start
    const tick = (t) => {
      if (start === undefined) start = t
      const p = Math.min((t - start) / ms, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

function StatTile({ value, label, delay }) {
  const n = useCountUp(value)
  return (
    <div className="rise-in" style={{ animationDelay: delay, backgroundColor: 'var(--bg-stat)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.75rem 0.4rem', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: '1.6rem', color: 'var(--text-primary)', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

// End-of-shift payoff: the moment sign-off lands, the day's work is shown back
// as something finished. Honest, not celebratory-blind — open hazards are
// called out, never glossed.
export default function ShiftWrapped({ shift, onFinish, onKeepWorking }) {
  useEffect(() => { buzz([30, 40, 60]) }, [])

  const rounds = shift.rounds || []
  const hazards = rounds.filter(r => r.tag === 'Hazard')
  const closed = hazards.filter(h => h.rectification || h.rectifiedPhoto)
  const openCount = hazards.length - closed.length
  const stats = [
    { label: 'Entries', value: rounds.length },
    { label: 'Hazards', value: hazards.length },
    { label: 'Closed Out', value: closed.length },
    { label: 'Actions', value: rounds.filter(r => r.tag === 'Action').length },
    { label: 'Near Misses', value: rounds.filter(r => r.tag === 'Near Miss').length },
    { label: 'Incidents', value: (shift.incidents || []).length },
  ]

  const start = shift.startTime ? new Date(shift.startTime) : null
  const mins = start ? Math.max(0, Math.round((Date.now() - start) / 60000)) : 0
  const duration = start ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'var(--bg-page)', overflowY: 'auto' }}>
      {/* aurora glow */}
      <div style={{ position: 'fixed', top: '-12%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 460, background: 'radial-gradient(circle, rgba(55,227,194,0.22), rgba(79,141,247,0.12) 45%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420, margin: '0 auto', padding: 'calc(env(safe-area-inset-top) + 2rem) 1.5rem calc(env(safe-area-inset-bottom) + 2rem)', position: 'relative' }}>
        <div className="rise-in" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.6rem', marginBottom: '0.5rem' }}>👏</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, var(--glow-a), var(--glow-b) 60%, var(--glow-c))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Shift wrapped.
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', fontWeight: 600 }}>
            {formatDate(shift.date)}{duration ? ` · ${duration} on site` : ''}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {stats.map((s, i) => <StatTile key={s.label} value={s.value} label={s.label} delay={`${0.08 + i * 0.06}s`} />)}
        </div>

        {hazards.length > 0 && (
          <div className="rise-in" style={{ animationDelay: '0.5s', textAlign: 'center', marginBottom: '1.75rem', fontSize: '0.82rem', fontWeight: 800, color: openCount === 0 ? 'var(--success-text)' : 'var(--warning-text)' }}>
            {openCount === 0
              ? '✓ Every hazard closed out. Tidy work.'
              : `⚡ ${openCount} hazard${openCount === 1 ? '' : 's'} still open — noted for handover.`}
          </div>
        )}

        <button
          onClick={onFinish}
          className="rise-in"
          style={{ animationDelay: '0.6s', width: '100%', padding: '0.95rem', border: 'none', borderRadius: '999px', background: 'linear-gradient(120deg, var(--glow-a) 0%, #6fd6f7 55%, var(--glow-b) 115%)', color: '#04182b', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 8px 26px rgba(55,227,194,0.28)' }}
        >
          Wrap up shift
        </button>
        <button
          onClick={onKeepWorking}
          className="rise-in"
          style={{ animationDelay: '0.65s', width: '100%', marginTop: '0.75rem', padding: '0.7rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Keep working
        </button>
      </div>
    </div>
  )
}
