import { useMemo, useState } from 'react'
import { getKnownCompanies } from '../utils/companies'
import { FIELD_LABEL, INPUT } from './ui'

// Company input with memory — chips of remembered companies appear under the
// box (most-used first) and filter as you type. Tap one instead of typing.
// `onChange` receives the plain string.
export default function CompanyField({ label, value, onChange, placeholder }) {
  const known = useMemo(() => getKnownCompanies(), [])
  const [focused, setFocused] = useState(false)

  const q = (value || '').trim().toLowerCase()
  const matches = known
    .filter(n => !q || (n.toLowerCase().includes(q) && n.toLowerCase() !== q))
    .slice(0, 5)
  // Chips show while typing in the field, or any time the box is empty —
  // so a remembered company is always one tap away.
  const showChips = matches.length > 0 && (focused || !q)

  return (
    <div>
      <div style={FIELD_LABEL}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        style={INPUT}
      />
      {showChips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
          {matches.map(n => (
            <button
              key={n}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(n); setFocused(false) }}
              style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', border: '1px solid var(--border-accent)', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
