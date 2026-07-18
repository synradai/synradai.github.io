// Transient "filed ✓" pill — the little dopamine hit after every save.
// Pops in at the bottom, holds a beat, fades out. Purely visual; the caller
// owns the timing (App clears the tick after ~1.4s).
export default function SaveTick({ label }) {
  if (!label) return null
  return (
    <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 4000, pointerEvents: 'none' }}>
      <style>{`
        @keyframes tick-pop {
          0% { transform: translateY(16px) scale(0.85); opacity: 0 }
          18% { transform: translateY(0) scale(1.03); opacity: 1 }
          26% { transform: scale(1) }
          78% { transform: translateY(0); opacity: 1 }
          100% { transform: translateY(6px); opacity: 0 }
        }
        @media (prefers-reduced-motion: reduce) { .tick-pill { animation: none !important } }
      `}</style>
      <div className="tick-pill" style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '999px',
        backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45), 0 0 18px rgba(255,122,26,0.25)',
        animation: 'tick-pop 1.4s ease both',
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
          background: 'radial-gradient(circle at 50% 32%, #ffe4c4 0%, var(--glow-a) 60%, #6b2d08 100%)',
          boxShadow: '0 0 10px rgba(255,122,26,0.5)', color: '#171310', fontWeight: 800,
        }}>✓</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>{label}</span>
      </div>
    </div>
  )
}
