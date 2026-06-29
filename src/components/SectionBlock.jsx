export default function SectionBlock({ title, hint, children }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem',
      }}>
        <span style={FIELD_LABEL}>{title}</span>
        {hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{hint}</span>}
      </div>

      {children}
    </div>
  )
}

const FIELD_LABEL = {
  fontSize: '0.8rem', fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-soft)',
}
