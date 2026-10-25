import { useEffect, useRef } from 'react'

const STEPS = ['Email', 'Code']

export function AuthSteps({ step }) {
  return (
    <div className="auth-steps">
      <div className="step-labels">
        {STEPS.map((label, index) => (
          <span key={label} className={index + 1 === step ? 'on' : ''}>{index + 1} {label}</span>
        ))}
      </div>
      <div className="stepper" aria-hidden="true">
        {STEPS.map((label, index) => (
          <span key={label} className={index < step ? 'dot on' : 'dot'} />
        ))}
      </div>
    </div>
  )
}

export function CodeField({ value, onChange, onComplete, label = '6-digit code', disabled = false }) {
  const sent = useRef('')

  useEffect(() => {
    if (disabled) return
    if (value.length === 6 && sent.current !== value) {
      sent.current = value
      onComplete(value)
    }
    if (value.length < 6) sent.current = ''
  }, [value, onComplete, disabled])

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        disabled={disabled}
        maxLength={6}
        style={{ fontFamily: 'monospace', letterSpacing: '0.3em', textAlign: 'center' }}
      />
    </label>
  )
}
