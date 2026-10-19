import { useEffect, useMemo, useRef, useState } from 'react'
import { getForm, matchOption, missingRequired, take5Blocked } from '../config/forms.js'
import { resolveForm } from '../lib/config.js'
import { assessReport, severityMeta, SEVERITY_SCALE, triageSummary } from '../config/severity.js'
import { useVoiceWalkthrough } from '../../src/hooks/useVoiceWalkthrough.js'
import { compressPhoto } from '../../src/utils/storage.js'
import { buildRecord } from '../lib/record.js'
import { nameWarning } from '../lib/roles.js'
import { perthDateTimeLocal } from '../lib/time.js'
import { go } from '../lib/routes.js'
import Reporting from './Reporting.jsx'
import { Button, Field, OfflineBanner } from './ui.jsx'

const SEV_COLOR = ['#3ee0a8', '#8fd98a', '#ffb15a', '#ff8a4a', '#ff6b7a']

function blankValues(form, siteName, reporter) {
  const values = {}
  for (const field of form.fields) {
    if (field.type === 'datetime') values[field.key] = perthDateTimeLocal()
    else if (field.type === 'photos') values[field.key] = []
    else if (field.key === 'reporter') values[field.key] = reporter || 'HSE adviser'
    else if (field.key === 'siteArea') values[field.key] = siteName || ''
    else values[field.key] = ''
  }
  return values
}

export default function CaptureForm({ app, kind, initial, source = 'typed', banner }) {
  const form = useMemo(() => resolveForm(kind, app.formsConfig) || getForm(kind), [kind, app.formsConfig])
  const steps = useMemo(() => form.fields.filter((field) => field.voice).map((field) => ({
    key: field.key,
    label: field.label,
    auto: Boolean(field.auto),
    hint: field.hint || field.label,
  })), [form])
  const refs = useRef({})
  const offlineSample = Boolean(initial?.offline)
  const [values, setValues] = useState(() => {
    const { offline, kind: prefillKind, ...rest } = initial || {}
    let staged = {}
    try {
      const raw = sessionStorage.getItem('si-beta-prefill')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!parsed.kind || parsed.kind === kind) {
          const { kind: _kind, ...fields } = parsed
          staged = fields
          sessionStorage.removeItem('si-beta-prefill')
        }
      }
    } catch { /* ignore bad prefill */ }
    return { ...blankValues(form, app.site.siteName, 'HSE adviser'), ...rest, ...staged }
  })
  const [error, setError] = useState('')
  const [usedVoice, setUsedVoice] = useState(false)

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    setValues((prev) => {
      let changed = false
      const next = { ...prev }
      for (const field of form.fields) {
        if (next[field.key] !== undefined) continue
        changed = true
        if (field.type === 'datetime') next[field.key] = perthDateTimeLocal()
        else if (field.type === 'photos') next[field.key] = []
        else next[field.key] = ''
      }
      return changed ? next : prev
    })
  }, [form])

  const walk = useVoiceWalkthrough({
    steps,
    onText: (key, transcript) => {
      const field = form.fields.find((item) => item.key === key)
      if (!field) return
      if (field.type === 'select' || field.type === 'yesno') {
        const match = matchOption(field, transcript)
        if (!match) return 'stay'
        set(key, match)
        return
      }
      if (field.type === 'textarea') {
        setValues((prev) => {
          const cur = prev[key] || ''
          const sep = cur && !/\s$/.test(cur) ? ' ' : ''
          return { ...prev, [key]: cur + sep + transcript }
        })
        return
      }
      set(key, transcript)
    },
    onStep: (index) => {
      const el = refs.current[steps[index]?.key]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40)
    },
    onError: setError,
  })

  const addPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const photos = values.photos || []
    if (photos.length >= 4) { setError('Four photos is the limit on one record.'); return }
    const compressed = await compressPhoto(file)
    set('photos', [...photos, compressed])
  }

  const save = (event) => {
    event?.preventDefault()
    const missing = missingRequired(kind, values, form)
    if (missing.length) { setError(`Still needed: ${missing.join(', ')}.`); return }
    walk.stop()
    const record = buildRecord({
      kind,
      fields: values,
      source: usedVoice ? 'voice' : source,
      ruleset: app.site.ruleset || 'general',
      prior: app.rows,
    })
    app.addRecord(record)
    go(record.fiveWhys ? `#/hse/investigate/${record.id}` : `#/hse/record/${record.id}`)
  }

  const decision = kind === 'take5' ? null : assessReport(values, { prior: app.rows })
  const stopped = kind === 'take5' ? take5Blocked(values) : []

  return (
    <form onSubmit={save}>
      <p className="eyebrow">HSE · {form.label}</p>
      <h1>{source === 'scan' ? `Review ${form.label}` : form.label}</h1>
      <p className="lede">{app.wording?.captureHint || 'Talk it through, or type. Say “done” to finish the long answers. People by role, not name.'}</p>
      {banner}
      <OfflineBanner show={offlineSample} />
      {stopped.length > 0 && (
        <p className="note">Stop. A No means the task does not start. Tell the supervisor. Still open: {stopped.join(' ')}</p>
      )}

      {!walk.active ? (
        <Button type="button" onClick={() => { setUsedVoice(true); setError(''); walk.start() }}>Voice walkthrough</Button>
      ) : (
        <div className="voice">
          <div>
            <div className="eyebrow">{walk.listening ? 'Listening' : 'Paused'} · {walk.step + 1}/{steps.length}</div>
            <strong>{steps[walk.step]?.label}</strong>
            <div className="hint">{steps[walk.step]?.hint}</div>
          </div>
          <div className="actions">
            <Button type="button" onClick={walk.next}>{walk.step === steps.length - 1 ? 'Finish' : 'Next'}</Button>
            <Button type="button" kind="ghost" onClick={walk.stop}>Stop</Button>
          </div>
        </div>
      )}

      {form.fields.map((field, index) => {
        const active = walk.active && steps[walk.step]?.key === field.key
        const section = field.section && field.section !== form.fields[index - 1]?.section
          ? <h2 key={`${field.key}-section`}>{field.section}</h2>
          : null
        if (field.type === 'note') {
          return <div key={field.key}>{section}<p className="muted">{field.help}</p></div>
        }
        if (field.type === 'photos') {
          return (
            <div key={field.key}>
              {section}
            <div className="field">
              <span className="field-label">{field.label}</span>
              <div className="actions">
                <label className="btn ghost">Camera<input type="file" accept="image/*" capture="environment" onChange={addPhoto} hidden /></label>
                <label className="btn ghost">Upload<input type="file" accept="image/*" onChange={addPhoto} hidden /></label>
              </div>
              <div className="photos">
                {(values.photos || []).map((photo, index) => (
                  <button type="button" key={index} onClick={() => set('photos', values.photos.filter((_, i) => i !== index))} title="Remove photo">
                    <img src={photo} alt="" />
                  </button>
                ))}
              </div>
              <span className="help">{field.help}</span>
            </div>
            </div>
          )
        }
        if (field.type === 'severity') {
          const level = Number(values[field.key])
          return (
            <div key={field.key}>
              {section}
            <div className="field">
              <span className="field-label">{field.label}</span>
              <div className="severity" role="radiogroup" aria-label={field.label}>
                {SEVERITY_SCALE.map((item) => (
                  <button
                    type="button"
                    key={item.level}
                    className={`sev${level === item.level ? ' on' : ''}`}
                    style={level === item.level ? { background: SEV_COLOR[item.level - 1] } : undefined}
                    onClick={() => set(field.key, item.level)}
                    aria-checked={level === item.level}
                    role="radio"
                  >
                    {item.level}
                    <small>{item.label}</small>
                  </button>
                ))}
              </div>
              <span className="help">{level ? severityMeta(level)?.hint : field.help}</span>
            </div>
            </div>
          )
        }
        const warning = field.key === 'peopleRoles' ? nameWarning(values[field.key]) : ''
        const inputType = field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : 'text'
        return (
          <div key={field.key} ref={(node) => { refs.current[field.key] = node }}>
            {section}
            <Field label={field.label} hint={warning || field.help} active={active}>
              {field.type === 'textarea' ? (
                <textarea value={values[field.key] || ''} placeholder={field.placeholder} onChange={(event) => set(field.key, event.target.value)} />
              ) : field.type === 'select' || field.type === 'yesno' ? (
                <select value={values[field.key] || ''} onChange={(event) => set(field.key, event.target.value)}>
                  <option value="">Choose</option>
                  {field.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : (
                <input
                  type={inputType}
                  value={values[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={(event) => set(field.key, event.target.value)}
                />
              )}
            </Field>
          </div>
        )
      })}

      {decision?.driving > 0 && (
        <p className="note">
          Driving severity {decision.driving} (actual {decision.actual || '—'}, potential {decision.potential || '—'}). {triageSummary(decision.driving)}
          {decision.notifiable ? ' The notifiable check forces this to level 4 or above.' : ''}
          {decision.icamReasons.length > 0 ? ` ICAM: ${decision.icamReasons.join(' ')}` : ''}
        </p>
      )}
      {(decision?.notifiable || decision?.driving >= 4) && <Reporting ruleset={app.site.ruleset} forced />}

      {error && <p className="note">{error}</p>}
      <div className="actions">
        <Button type="submit">File {form.label}</Button>
        <Button type="button" kind="ghost" onClick={() => { walk.stop(); go('#/hse') }}>Cancel</Button>
      </div>
    </form>
  )
}
