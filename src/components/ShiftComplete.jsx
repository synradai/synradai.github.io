import { useEffect } from 'react'
import { buzz } from '../utils/haptics'
import { PrimaryButton } from './ui'

// The payoff. Shown full-screen the moment a shift is finished — a satisfying
// "clocked off" beat with a recap of what got captured, so the tedious part
// (the write-up) lands as an accomplishment instead of a dead end.
export default function ShiftComplete({ shift, advisorName, onDone }) {
  const raw = (advisorName || '').split('@')[0].split(/[ .]/)[0]
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''

  const rounds = shift?.rounds || []
  const actions = rounds.filter(r => r.tag === 'Action').length
  const incidents = (shift?.incidents || []).length

  // Rough, deliberately conservative: each captured + written-up item is a few
  // minutes of paperwork you didn't have to type. Motivational, not a claim.
  const items = rounds.length + incidents + (shift?.findingsReport ? 1 : 0)
  const mins = Math.max(10, items * 6)
  const timeSaved = mins >= 60 ? `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hr` : `${mins} min`

  useEffect(() => { buzz(35) }, [])

  const stats = [
    { val: rounds.length, label: 'Rounds' },
    { val: actions, label: 'Actions' },
    { val: incidents, label: 'Incidents' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: 'var(--bg-page)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top) + 1.5rem) 1.5rem calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
      <style>{`
        @keyframes sc-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes sc-ring { 0% { transform: scale(0.6); opacity: 0.7 } 100% { transform: scale(2.1); opacity: 0 } }
        @keyframes sc-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes sc-spark { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0 } }
        .sc-anim { animation: sc-rise 0.5s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .sc-pop, .sc-ring, .sc-anim, .sc-spark { animation: none !important; }
          .sc-pop { opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* ambient aurora, matching home */}
      <div style={{ position: 'absolute', top: '-12%', right: '-18%', width: 360, height: 360, background: 'radial-gradient(circle, rgba(55,227,194,0.22), rgba(79,141,247,0.10) 45%, transparent 70%)', filter: 'blur(22px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-20%', width: 320, height: 320, background: 'radial-gradient(circle, rgba(139,123,247,0.16), transparent 65%)', filter: 'blur(24px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {/* The signature orb, celebrating */}
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 1.75rem' }}>
          {/* expanding rings */}
          <div className="sc-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--glow-a)', animation: 'sc-ring 1.4s ease-out 0.15s both' }} />
          <div className="sc-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--glow-b)', animation: 'sc-ring 1.4s ease-out 0.35s both' }} />
          {/* sparks */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
            const ang = (i / 8) * Math.PI * 2
            const dist = 78
            return (
              <span key={i} className="sc-spark" style={{
                position: 'absolute', top: '50%', left: '50%', width: 7, height: 7, borderRadius: '50%', marginTop: -3.5, marginLeft: -3.5,
                background: i % 2 ? 'var(--glow-a)' : 'var(--glow-b)',
                '--dx': `${Math.cos(ang) * dist}px`, '--dy': `${Math.sin(ang) * dist}px`,
                animation: `sc-spark 0.9s ease-out ${0.25 + (i % 4) * 0.04}s both`,
              }} />
            )
          })}
          {/* orb */}
          <div className="sc-pop" style={{
            position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 32%, #d6fff4 0%, var(--glow-a) 55%, #1b3a6b 100%)',
            boxShadow: '0 0 40px rgba(55,227,194,0.5), inset 0 6px 12px rgba(255,255,255,0.35)',
            animation: 'sc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <span style={{ fontSize: '3.2rem', lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(4,24,43,0.4))' }}>✅</span>
          </div>
        </div>

        <h1 className="sc-anim" style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 0.5rem', lineHeight: 1.1, animationDelay: '0.15s' }}>
          <span style={{ background: 'linear-gradient(90deg, var(--glow-a), var(--glow-b) 60%, var(--glow-c))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Shift complete
          </span>
        </h1>
        <p className="sc-anim" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.55, margin: '0 0 1.6rem', animationDelay: '0.25s' }}>
          {first ? `Nice work, ${first}. ` : 'Nice work. '}Everything's written up and filed — nothing left for the crib room.
        </p>

        {/* Recap */}
        <div className="sc-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1rem', animationDelay: '0.35s' }}>
          {stats.map(({ val, label }) => (
            <div key={label} style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: '0.85rem', padding: '0.85rem 0.5rem' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>{val}</div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.3rem' }}>{label}</div>
            </div>
          ))}
        </div>

        <p className="sc-anim" style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', fontWeight: 700, margin: '0 0 1.75rem', animationDelay: '0.45s' }}>
          ≈ {timeSaved} of paperwork, sorted.
        </p>

        <div className="sc-anim" style={{ animationDelay: '0.55s' }}>
          <PrimaryButton onClick={onDone}>Back to home</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
