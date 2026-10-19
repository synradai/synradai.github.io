export function Button({ kind = 'primary', children, ...props }) {
  return <button className={`btn${kind === 'primary' ? '' : ` ${kind}`}`} {...props}>{children}</button>
}

export function Field({ label, hint, children, active }) {
  return (
    <label className={`field${active ? ' is-active' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}

export function FlagList({ flags }) {
  if (!flags?.length) return <p className="muted">No regulatory flags on this text.</p>
  return (
    <ul className="flags">
      {flags.map((flag) => (
        <li key={flag.id}>
          <strong>{flag.notice || 'Possible breach — verify'}</strong>
          <span>{flag.instrument}</span>
          <div>{flag.pinpoint}</div>
          {flag.label ? <p className="muted">{flag.label}</p> : null}
          {flag.why ? <p className="muted">{flag.why}</p> : null}
          {flag.unverified ? <p className="note">{flag.unverified}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export function OfflineBanner({ show, children }) {
  if (!show) return null
  return <div className="offline-banner">{children || 'Grok is not connected. This is an offline sample so you can review the screen. It is not a model result.'}</div>
}

export function PreviewBanner() {
  return <div className="preview-banner">Preview — sample data. This module is not wired to a live register.</div>
}
