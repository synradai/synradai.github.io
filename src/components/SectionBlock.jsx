export default function SectionBlock({ title, hint, confirmed, onConfirm, confirmLabel = 'Confirm', nextRef, children }) {
  const handleConfirm = () => {
    onConfirm()
    if (!confirmed && nextRef?.current) {
      setTimeout(() => nextRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            backgroundColor: confirmed ? 'var(--success)' : 'var(--border)',
            border: `1.5px solid ${confirmed ? 'var(--success)' : 'var(--border-strong)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            {confirmed && <span style={{ color: 'var(--on-accent)', fontSize: '0.55rem', fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={FIELD_LABEL}>{title}</span>
        </div>
        {hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{hint}</span>}
      </div>

      {children}

      <button
        onClick={handleConfirm}
        style={{
          marginTop: '0.75rem', width: '100%', padding: '0.55rem 0.75rem',
          border: `1.5px solid ${confirmed ? 'var(--success)' : 'var(--border-accent)'}`,
          borderRadius: '0.5rem',
          backgroundColor: confirmed ? 'var(--success-bg)' : 'var(--bg-panel)',
          color: confirmed ? 'var(--success-text)' : 'var(--accent)',
          fontSize: '0.75rem', fontWeight: 700,
          cursor: 'pointer', textAlign: 'center',
          transition: 'all 0.2s',
        }}
      >
        {confirmed ? `✓ ${confirmLabel} confirmed — tap to revise` : `Confirm ${confirmLabel} →`}
      </button>
    </div>
  )
}

const FIELD_LABEL = {
  fontSize: '0.8rem', fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-soft)',
}
