import { useEffect, useRef, useState } from 'react'
import {
  answerValue,
  assessSubmission,
  buildStopAction,
  loadLocalCodes,
  loadLocalSubmissions,
  loadPerson,
  notifyLocalQr,
  resolveQrForms,
  saveLocalAction,
  saveLocalSubmissions,
  savePerson,
  shrinkDataUrl,
  snapshotAnswers,
  supervisorFor,
  tooManySubmissions,
} from '../lib/qrForms.js'
import { isBackendEnabled, supabaseKey, supabaseUrl } from '../lib/supabase.js'
import { Button, Field } from './ui.jsx'

async function readFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that photo.'))
    reader.readAsDataURL(file)
  })
  return shrinkDataUrl(dataUrl)
}

function SignaturePad({ value, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const point = (event) => {
      const rect = canvas.getBoundingClientRect()
      const source = event.touches ? event.touches[0] : event
      return {
        x: (source.clientX - rect.left) * (canvas.width / rect.width),
        y: (source.clientY - rect.top) * (canvas.height / rect.height),
      }
    }
    const start = (event) => {
      drawing.current = true
      const at = point(event)
      ctx.strokeStyle = '#07101f'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(at.x, at.y)
      event.preventDefault()
    }
    const move = (event) => {
      if (!drawing.current) return
      const at = point(event)
      ctx.lineTo(at.x, at.y)
      ctx.stroke()
      event.preventDefault()
    }
    const end = () => {
      if (!drawing.current) return
      drawing.current = false
      onChangeRef.current(canvas.toDataURL('image/png'))
    }
    canvas.addEventListener('pointerdown', start)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    return () => {
      canvas.removeEventListener('pointerdown', start)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [])

  const clear = () => {
    const canvas = ref.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div>
      <canvas ref={ref} className="sign-pad" width={600} height={200} aria-label="Signature" />
      <div className="actions">
        {value ? <span className="muted">Signed</span> : <span className="muted">Sign with a finger or mouse.</span>}
        <button type="button" className="text-btn" onClick={clear}>Clear</button>
      </div>
    </div>
  )
}

export default function PublicForm({ token }) {
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [pack, setPack] = useState(null)
  const [person, setPerson] = useState(() => loadPerson())
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancel = false
    const fail = (message) => {
      if (!cancel) {
        setError(message)
        setPhase('error')
      }
    }
    ;(async () => {
      if (!isBackendEnabled) {
        const code = loadLocalCodes().find((item) => item.token === token && item.active)
        if (!code) return fail('This code is not valid.')
        if (code.targetType !== 'form') return fail('This code is not a form yet.')
        const form = resolveQrForms(null).find((item) => item.id === code.targetId)
        if (!form) return fail('This form is no longer available.')
        if (!cancel) {
          setPack({
            label: code.label || '',
            siteName: code.siteName || '',
            clientName: code.clientName || '',
            logoUrl: '',
            code,
            form: { ...form, version: 0 },
          })
          setPhase('form')
        }
        return
      }
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: supabaseKey,
            authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ op: 'open', token }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body.ok) return fail(body.error || 'This code is not valid.')
        if (!cancel) {
          setPack({
            label: body.label || '',
            siteName: body.siteName || '',
            clientName: body.clientName || '',
            logoUrl: body.logoUrl || '',
            form: body.form,
          })
          setPhase('form')
        }
      } catch {
        fail('This form could not be opened.')
      }
    })()
    return () => { cancel = true }
  }, [token])

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))

  const submit = async () => {
    if (!pack || busy) return
    const check = assessSubmission(pack.form, answers, person.name)
    if (check.errors.length) {
      setError(check.errors[0])
      return
    }
    setBusy(true)
    setError('')
    savePerson(person)
    try {
      if (!isBackendEnabled) {
        const freshCode = loadLocalCodes().find((item) => item.token === token && item.active) || pack.code
        const existing = loadLocalSubmissions()
        if (tooManySubmissions(existing, freshCode.id)) {
          setError('Too many forms from this code in the last hour.')
          return
        }
        const snapshot = snapshotAnswers(pack.form, answers)
        const submission = {
          id: crypto.randomUUID(),
          siteId: freshCode.siteId,
          qrId: freshCode.id,
          formId: pack.form.id,
          formVersion: pack.form.version || 0,
          formTitle: pack.form.title,
          areaLabel: pack.label,
          personName: person.name.trim(),
          company: person.company.trim(),
          role: person.role.trim(),
          answers: snapshot,
          failed: check.failed,
          stopped: check.stopped,
          actionId: '',
          createdAt: new Date().toISOString(),
        }
        if (check.stopped) {
          const remembered = supervisorFor(freshCode.siteId)
          const action = buildStopAction({
            submissionId: submission.id,
            formTitle: pack.form.title,
            label: pack.label,
            personName: submission.personName,
            failed: check.failed,
            supervisorId: freshCode.supervisorId || remembered.id,
            supervisorName: freshCode.supervisorName || remembered.name,
            siteId: freshCode.siteId,
            ruleset: 'general',
          })
          submission.actionId = action.id
          saveLocalAction(action)
        }
        saveLocalSubmissions([submission, ...existing])
        notifyLocalQr()
        setResult({ stopped: check.stopped, failed: check.failed })
        setPhase(check.stopped ? 'stop' : 'ok')
        return
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          op: 'submit',
          token,
          personName: person.name.trim(),
          company: person.company.trim(),
          role: person.role.trim(),
          answers,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(body.error || 'The form could not be filed.')
        return
      }
      setResult({ stopped: Boolean(body.stopped), failed: body.failed || [] })
      setPhase(body.stopped ? 'stop' : 'ok')
    } catch {
      setError('The form could not be filed.')
    } finally {
      setBusy(false)
    }
  }

  const brand = pack?.clientName || pack?.siteName || 'Safe Intelligence'

  return (
    <div className={`public-form${phase === 'stop' ? ' is-stop' : ''}`}>
      <p className="eyebrow">Safe Intelligence</p>
      <h1>{phase === 'stop' ? 'STOP THE JOB' : pack?.form?.title || 'Form'}</h1>
      {pack && phase !== 'stop' && (
        <p className="lede">
          {brand}
          {pack.label ? ` · ${pack.label}` : ''}
          {pack.siteName && pack.clientName ? ` · ${pack.siteName}` : ''}
        </p>
      )}
      {pack?.logoUrl && phase === 'form' ? <img className="public-logo" src={pack.logoUrl} alt="" /> : null}

      {phase === 'loading' && <p className="muted">Opening the form…</p>}
      {phase === 'error' && <p className="note">{error}</p>}

      {phase === 'form' && pack && (
        <>
          <p className="muted">A No on a critical check stops the job. Your name stays on this device for next time.</p>
          <Field label="Your name">
            <input value={person.name} autoComplete="name" onChange={(event) => setPerson({ ...person, name: event.target.value })} />
          </Field>
          <Field label="Company" hint="Optional">
            <input value={person.company} autoComplete="organization" onChange={(event) => setPerson({ ...person, company: event.target.value })} />
          </Field>
          <Field label="Role" hint="Optional">
            <input value={person.role} autoComplete="organization-title" onChange={(event) => setPerson({ ...person, role: event.target.value })} />
          </Field>
          {pack.form.questions.map((question) => (
            <Question
              key={question.id}
              question={question}
              value={answerValue(answers, question.id)}
              onChange={(value) => setAnswer(question.id, value)}
            />
          ))}
          {error && <p className="note">{error}</p>}
          <div className="actions">
            <Button type="button" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send form'}</Button>
          </div>
        </>
      )}

      {phase === 'stop' && (
        <div className="stop-screen">
          <p className="lede">Do not start. The site supervisor has an action in the app.</p>
          <ul>
            {(result?.failed || []).map((item) => <li key={item.id}>{item.label}</li>)}
          </ul>
        </div>
      )}

      {phase === 'ok' && (
        <div className="panel">
          <p>Filed. You can start.</p>
        </div>
      )}
    </div>
  )
}

function Question({ question, value, onChange }) {
  const label = question.critical ? `${question.label} (critical)` : question.label
  if (question.type === 'ynna') {
    return (
      <Field label={label} hint={question.help}>
        <div className="ynna" role="group" aria-label={question.label}>
          {[['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']].map(([id, text]) => (
            <button key={id} type="button" className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{text}</button>
          ))}
        </div>
      </Field>
    )
  }
  if (question.type === 'number') {
    return (
      <Field label={label} hint={question.help}>
        <input inputMode="decimal" value={value || ''} onChange={(event) => onChange(event.target.value)} />
      </Field>
    )
  }
  if (question.type === 'dropdown') {
    return (
      <Field label={label} hint={question.help}>
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose</option>
          {(question.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
    )
  }
  if (question.type === 'photo') {
    return (
      <Field label={label} hint={question.help}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            onChange(await readFile(file))
          }}
        />
        {typeof value === 'string' && value.startsWith('data:') ? <img className="public-photo" src={value} alt="" /> : null}
      </Field>
    )
  }
  if (question.type === 'signature') {
    return (
      <Field label={label} hint={question.help}>
        <SignaturePad value={value || ''} onChange={onChange} />
      </Field>
    )
  }
  return (
    <Field label={label} hint={question.help}>
      <textarea rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}
