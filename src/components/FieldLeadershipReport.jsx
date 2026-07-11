import { useState, useRef, useEffect } from 'react'
import { generateId, compressPhoto } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { STORAGE_KEYS } from '../constants'
import { callAnthropicAPI, buildFieldLeadershipPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { CameraIcon, UploadIcon, MicIcon, StopIcon } from './icons'
import { FullScreenModal, FIELD_LABEL, TEXTAREA, INPUT, ErrorBox, PrimaryButton, ExpandableTextarea } from './ui'

// The sections the voice walkthrough steps through, in order.
const STEPS = [
  { key: 'activity', label: 'Activity Observed' },
  { key: 'positives', label: 'Positive Behaviours' },
  { key: 'atRisk', label: 'At-Risk Behaviours' },
  { key: 'hazards', label: 'Hazards Identified' },
  { key: 'actions', label: 'Actions Taken / Required' },
  { key: 'notes', label: 'Additional Notes' },
]

export default function FieldLeadershipReport({ apiKey, onClose, onSave }) {
  const [location, setLocation] = useState('')
  const [companyAssessed, setCompanyAssessed] = useState('')
  const [yourCompany, setYourCompany] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.FIELD_REPORT_COMPANY) || '' } catch (_) { return '' }
  })
  const [activity, setActivity] = useState('')
  const [positives, setPositives] = useState('')
  const [atRisk, setAtRisk] = useState('')
  const [hazards, setHazards] = useState('')
  const [actions, setActions] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState([])
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const photoRef = useRef()
  const uploadRef = useRef()
  const time = useRef(new Date().toISOString())

  // --- Voice walkthrough: one mic that fills each section, hands-free --------
  const setters = { activity: setActivity, positives: setPositives, atRisk: setAtRisk, hazards: setHazards, actions: setActions, notes: setNotes }
  const [walk, setWalk] = useState(false)
  const [step, setStep] = useState(0)
  const [wListening, setWListening] = useState(false)
  const recRef = useRef(null)
  const walkRef = useRef(false)
  const stepRef = useRef(0)
  const sectionRefs = useRef({})

  const goToStep = (i) => {
    if (i >= STEPS.length) { stopWalk(); return }
    setStep(i); stepRef.current = i
    const el = sectionRefs.current[STEPS[i].key]
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  const appendToCurrent = (piece) => {
    const set = setters[STEPS[stepRef.current].key]
    set(prev => { const cur = prev || ''; const sep = cur && !/\s$/.test(cur) ? ' ' : ''; return cur + sep + piece })
  }

  const beginRec = (SR) => {
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const t = e.results[i][0].transcript.trim()
        const lc = t.toLowerCase().replace(/[.!?,]/g, '').trim()
        if (lc === 'next' || lc === 'next section' || lc === 'next one') { goToStep(stepRef.current + 1); continue }
        if (lc === 'skip' || lc === 'skip section' || lc === 'leave it') { goToStep(stepRef.current + 1); continue }
        if (lc === 'done' || lc === 'finish' || lc === 'stop' || lc === 'that\'s it') { stopWalk(); continue }
        appendToCurrent(t)
      }
    }
    rec.onend = () => { if (walkRef.current) { try { rec.start() } catch (_) {} } else setWListening(false) }
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return
      walkRef.current = false; setWalk(false); setWListening(false)
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') setError('Microphone permission denied — allow mic access in your settings.')
    }
    try { rec.start(); recRef.current = rec; setWListening(true) } catch (_) { setError('Could not start voice — try again.') }
  }

  const startWalk = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('Voice isn\'t supported in this browser. On iPhone, tap the microphone on your keyboard for each box instead.'); return }
    if (!window.isSecureContext) { setError('Voice needs a secure (HTTPS) connection.'); return }
    setError(''); setWalk(true); walkRef.current = true; setStep(0); stepRef.current = 0
    goToStep(0)
    beginRec(SR)
  }

  const stopWalk = () => { walkRef.current = false; try { recRef.current?.stop() } catch (_) {}; setWalk(false); setWListening(false) }
  useEffect(() => () => { walkRef.current = false; try { recRef.current?.stop() } catch (_) {} }, [])

  const isActive = (k) => walk && STEPS[step].key === k
  const sectionStyle = (k) => ({ marginBottom: '1rem', borderRadius: '0.5rem', padding: isActive(k) ? '0.6rem' : 0, border: isActive(k) ? '1.5px solid var(--accent)' : '1.5px solid transparent', boxShadow: isActive(k) ? '0 0 16px rgba(79,141,247,0.35)' : 'none', transition: 'border-color 0.2s, box-shadow 0.2s' })

  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressPhoto(file)
    setPhotos(prev => [...prev, compressed])
    e.target.value = ''
  }
  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx))

  const generate = async () => {
    if (!companyAssessed.trim()) { setError('Add the company being assessed first.'); return }
    setLoading(true); setError('')
    try {
      const fields = { location, companyAssessed, yourCompany, activity, positives, atRisk, hazards, actions, notes }
      const text = await callAnthropicAPI(apiKey, buildFieldLeadershipPrompt(fields, time.current))
      setReport(text)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const save = () => {
    try { localStorage.setItem(STORAGE_KEYS.FIELD_REPORT_COMPANY, yourCompany) } catch (_) {}
    onSave({
      id: generateId(), time: time.current,
      location, companyAssessed, yourCompany, activity,
      positives, atRisk, hazards, actions, notes, photos,
      formalReport: report,
    })
  }

  return (
    <FullScreenModal badge="📋" title="Field Leadership Report" onClose={() => { stopWalk(); onClose() }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '1rem' }}>{formatDateTime(time.current)}</div>

      {/* Voice walkthrough control */}
      {!walk ? (
        <button onClick={startWalk} style={{ width: '100%', marginBottom: '1.25rem', padding: '0.85rem', border: 'none', borderRadius: '0.75rem', background: 'linear-gradient(135deg, var(--glow-b), var(--glow-c))', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(79,141,247,0.35)' }}>
          <MicIcon size={18} /> Voice walkthrough — fill by talking
        </button>
      ) : (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--accent)', borderRadius: '0.75rem', padding: '0.8rem 0.9rem', marginBottom: '1.25rem', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-soft)' }}>{wListening ? '● Listening' : 'Paused'} · {step + 1}/{STEPS.length}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{STEPS[step].label}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button onClick={() => goToStep(step + 1)} style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: '0.5rem', backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>{step === STEPS.length - 1 ? 'Finish' : 'Next →'}</button>
              <button onClick={stopWalk} aria-label="Stop" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', backgroundColor: 'var(--error-bg-strong)', color: 'var(--error-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StopIcon size={13} /></button>
            </div>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', margin: '0.45rem 0 0', fontWeight: 600, lineHeight: 1.4 }}>Talk this section, then tap <strong>Next</strong> (or just say "next"). Say "skip" to leave one blank, "done" to finish.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={FIELD_LABEL}>Company Assessed</div>
          <input value={companyAssessed} onChange={e => setCompanyAssessed(e.target.value)} placeholder="e.g. ABC Contracting" style={INPUT} />
        </div>
        <div>
          <div style={FIELD_LABEL}>Your Company</div>
          <input value={yourCompany} onChange={e => setYourCompany(e.target.value)} placeholder="Who you work for" style={INPUT} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={FIELD_LABEL}>Location / Area</div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. ROM pad, workshop" style={INPUT} />
        </div>
        <div ref={el => (sectionRefs.current.activity = el)} style={sectionStyle('activity')}>
          <div style={FIELD_LABEL}>Activity Observed</div>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. mobile plant operation" style={INPUT} />
        </div>
      </div>

      <div ref={el => (sectionRefs.current.positives = el)} style={sectionStyle('positives')}>
        <div style={{ ...FIELD_LABEL, color: 'var(--success-text)' }}>Positive Behaviours</div>
        <SafetyTextarea value={positives} onChange={e => setPositives(e.target.value)} placeholder="What was being done well — PPE, procedures followed, good communication..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div ref={el => (sectionRefs.current.atRisk = el)} style={sectionStyle('atRisk')}>
        <div style={{ ...FIELD_LABEL, color: 'var(--warning-text)' }}>At-Risk Behaviours</div>
        <SafetyTextarea value={atRisk} onChange={e => setAtRisk(e.target.value)} placeholder="Any unsafe acts observed and the conversation/feedback given..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div ref={el => (sectionRefs.current.hazards = el)} style={sectionStyle('hazards')}>
        <div style={{ ...FIELD_LABEL, color: 'var(--error-text)' }}>Hazards Identified</div>
        <SafetyTextarea value={hazards} onChange={e => setHazards(e.target.value)} placeholder="Hazards found and their status..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div ref={el => (sectionRefs.current.actions = el)} style={sectionStyle('actions')}>
        <div style={FIELD_LABEL}>Actions Taken / Required</div>
        <SafetyTextarea value={actions} onChange={e => setActions(e.target.value)} placeholder="What was actioned on the spot, and what still needs follow-up..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div ref={el => (sectionRefs.current.notes = el)} style={sectionStyle('notes')}>
        <div style={FIELD_LABEL}>Additional Notes</div>
        <SafetyTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else worth recording..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Photos</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => photoRef.current?.click()} style={{ padding: '0.45rem 0.875rem', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <CameraIcon size={15} /> Camera
          </button>
          <button onClick={() => uploadRef.current?.click()} style={{ padding: '0.45rem 0.875rem', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <UploadIcon size={15} /> Upload
          </button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        <input ref={uploadRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {photos.map((p, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={p} alt={`Photo ${idx + 1}`} style={{ height: '5.5rem', borderRadius: '0.5rem', objectFit: 'cover' }} />
                <button onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-accent)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

      <PrimaryButton onClick={generate} disabled={!companyAssessed.trim()} loading={loading} style={{ marginBottom: '0.75rem' }}>
        {loading ? 'Generating Report...' : 'Generate Formal Report (AI)'}
      </PrimaryButton>

      {report && (
        <div style={{ marginBottom: '1rem' }}>
          <ExpandableTextarea label="Generated Report (editable)" value={report} onChange={e => setReport(e.target.value)} rows={14} apiKey={apiKey} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1rem' }}>
        <button onClick={save} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
          Save Report
        </button>
        <button onClick={() => { stopWalk(); onClose() }} style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </FullScreenModal>
  )
}
