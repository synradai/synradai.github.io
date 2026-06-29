// Shared design tokens and layout primitives.
// Every screen builds from these so spacing, type, and controls stay consistent.

import { useState } from 'react'
import { shareText } from '../utils/share'
import { exportReportPdf } from '../utils/pdf'
import { DocIcon } from './icons'
import SafetyTextarea from './SafetyTextarea'

/* ---------- tokens ---------- */

// Tiny uppercase section heading (cards, page sections)
export const SECTION_LABEL = { fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: '0.75rem' }

// Form field heading
export const FIELD_LABEL = { fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-soft)', marginBottom: '0.4rem' }

export const TEXTAREA = { width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }

export const INPUT = { width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit' }

// Input that sits in a flex row next to a button
export const INPUT_FLEX = { ...INPUT, width: undefined, flex: 1, padding: '0.5rem 0.75rem' }

// Small "Add" button next to an INPUT_FLEX
export const BTN_ADD = { padding: '0 1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }

export const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem' }

export const EMPTY_TEXT = { fontSize: '0.75rem', color: 'var(--text-faint)', margin: 0, fontWeight: 600 }

export const EMPTY_PAGE = { textAlign: 'center', color: 'var(--text-faint)', fontWeight: 600, marginTop: '3rem' }

/* ---------- components ---------- */

// Full page with a safe-area header that closes top-right (✕) — same pattern as
// FullScreenModal so every screen is consistent — and a centred 720px column.
export function PageShell({ title, onBack, children }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      <div style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-soft)', letterSpacing: '0.02em' }}>{title}</span>
          <button onClick={onBack} aria-label="Close" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}>×</button>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

// Full-screen overlay with a pinned safe-area header and scrollable body.
// `badge` renders inside a coloured circle (or pass `badgeEl` for custom chips).
export function FullScreenModal({ badge, badgeColor = 'var(--accent)', badgeEl, title, titleColor = 'var(--accent-soft)', headerBg = 'var(--bg-panel)', headerBorder = 'var(--border-accent)', onClose, footer, headerLeft, overlay, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'var(--bg-header)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: headerBg, borderBottom: `1px solid ${headerBorder}`, padding: '0.875rem 1rem', paddingTop: 'calc(0.875rem + env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {headerLeft}
          {badgeEl || (
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1, color: 'var(--on-accent)', fontWeight: 800 }}>{badge}</span>
            </div>
          )}
          {title && <span style={{ fontWeight: 800, fontSize: '0.9rem', color: titleColor, letterSpacing: '0.02em' }}>{title}</span>}
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}>×</button>
      </div>
      <div style={{ padding: '1rem', paddingBottom: footer ? '1rem' : 'calc(1rem + env(safe-area-inset-bottom))', overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
      {footer && (
        <div style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-panel)', padding: '0.75rem 1rem', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          {footer}
        </div>
      )}
      {overlay}
    </div>
  )
}

export function ErrorBox({ children, style }) {
  if (!children) return null
  return (
    <div style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '0.5rem', padding: '0.625rem', color: 'var(--error-text)', fontSize: '0.8rem', fontWeight: 600, ...style }}>
      {children}
    </div>
  )
}

// Full-width primary action button with loading/disabled handling.
export function PrimaryButton({ onClick, disabled, loading, children, danger, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '0.875rem',
        backgroundColor: danger ? 'var(--danger)' : 'var(--accent)',
        border: 'none', borderRadius: '0.75rem',
        color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.9rem',
        cursor: loading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.5 : loading ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// Standard phase intro: "Phase N of 5" + title + description + optional meta line.
export function PhaseHeader({ phase, title, blurb, meta }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.75rem' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent)', marginBottom: '0.25rem' }}>Phase {phase} of 5</div>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.3rem' }}>{title}</h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, fontWeight: 600 }}>{blurb}</p>
      {meta && <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.5rem', fontWeight: 600 }}>{meta}</div>}
    </div>
  )
}

// Share via the native share sheet (or copy on desktop), with inline feedback.
// `getText` is called at tap time so the latest content is shared.
export function ShareButton({ title, getText, label = 'Share', style }) {
  const [status, setStatus] = useState('')

  const handle = async () => {
    const result = await shareText(title, getText())
    if (result === 'copied') { setStatus('✓ Copied'); setTimeout(() => setStatus(''), 2000) }
    else if (result === 'failed') { setStatus('Failed'); setTimeout(() => setStatus(''), 2000) }
  }

  return (
    <button
      onClick={handle}
      style={{ padding: '0.25rem 0.625rem', border: 'none', borderRadius: '0.25rem', backgroundColor: status === '✓ Copied' ? 'var(--success-border)' : 'var(--border)', color: status === '✓ Copied' ? 'var(--success-text)' : 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, ...style }}
    >
      {status || `↗ ${label}`}
    </button>
  )
}

// Build + share a presentable PDF (photos inline). `getReport` is called at tap
// time and returns { filename, title, dateLabel, advisor, blocks }.
export function PdfButton({ getReport, label = 'PDF', style }) {
  const [status, setStatus] = useState('')

  const handle = async () => {
    setStatus('…')
    try {
      const r = await exportReportPdf(getReport())
      setStatus(r === 'failed' ? 'Failed' : (r === 'downloaded' ? '✓ Saved' : (r === 'shared' ? '✓ Sent' : '')))
    } catch (_) { setStatus('Failed') }
    setTimeout(() => setStatus(''), 2500)
  }

  return (
    <button
      onClick={handle}
      style={{ padding: '0.25rem 0.625rem', border: 'none', borderRadius: '0.25rem', backgroundColor: status.startsWith('✓') ? 'var(--success-border)' : 'var(--accent)', color: status.startsWith('✓') ? 'var(--success-text)' : 'var(--on-accent)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', ...style }}
    >
      {status || <><DocIcon size={13} /> {label}</>}
    </button>
  )
}

// A labelled SafetyTextarea with a "⤢ Full screen" button that opens a big,
// clean, scrollable editor (keyboard kept, no icon clutter). Works on any screen.
export function ExpandableTextarea({ label, value, onChange, placeholder, rows = 4, apiKey, labelColor }) {
  const [big, setBig] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem', gap: '0.5rem' }}>
        <div style={{ ...FIELD_LABEL, marginBottom: 0, ...(labelColor ? { color: labelColor } : {}) }}>{label}</div>
        <button onClick={() => setBig(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>⤢ Full screen</button>
      </div>
      <SafetyTextarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={TEXTAREA} apiKey={apiKey} />
      {big && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', paddingTop: 'calc(0.875rem + env(safe-area-inset-top))', borderBottom: '1px solid var(--border-accent)', backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-soft)' }}>{label}</span>
            <button onClick={() => setBig(false)} aria-label="Done" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}>×</button>
          </div>
          <textarea value={value} onChange={onChange} autoFocus style={{ flex: 1, width: '100%', border: 'none', outline: 'none', resize: 'none', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.7, padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', fontFamily: 'inherit' }} />
        </div>
      )}
    </>
  )
}

// Standalone "⤢ Full screen" button (drop it into a custom header). Opens a big
// clean editor over everything; keyboard kept, no clutter.
export function FullScreenButton({ label = 'Note', value, onChange }) {
  const [big, setBig] = useState(false)
  return (
    <>
      <button onClick={() => setBig(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: '0.25rem 0.4rem', whiteSpace: 'nowrap' }}>⤢ Full screen</button>
      {big && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', paddingTop: 'calc(0.875rem + env(safe-area-inset-top))', borderBottom: '1px solid var(--border-accent)', backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-soft)' }}>{label}</span>
            <button onClick={() => setBig(false)} aria-label="Done" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}>×</button>
          </div>
          <textarea value={value} onChange={onChange} autoFocus style={{ flex: 1, width: '100%', border: 'none', outline: 'none', resize: 'none', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.7, padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', fontFamily: 'inherit' }} />
        </div>
      )}
    </>
  )
}

// Collapsible list card with a header row and expandable detail (history/incident/report lists).
export function ExpandableCard({ expanded, onToggle, accentBorder, header, sub, children }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: accentBorder ? `3px solid ${accentBorder}` : '1px solid var(--border)', borderRadius: '0.75rem', marginBottom: '0.75rem', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', padding: '1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', gap: '0.75rem' }}
      >
        <div style={{ minWidth: 0 }}>
          {header}
          {sub && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sub}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--accent)', fontSize: '0.8rem', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem' }}>
          {children}
        </div>
      )}
    </div>
  )
}
