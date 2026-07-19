import { useState, useRef } from 'react'
import { generateId, compressPhoto } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { STORAGE_KEYS } from '../constants'
import { callAnthropicAPI, buildFieldLeadershipPrompt } from '../utils/api'
import { rememberCompanies } from '../utils/companies'
import { useVoiceWalkthrough } from '../hooks/useVoiceWalkthrough'
import SafetyTextarea from './SafetyTextarea'
import CompanyField from './CompanyField'
import { CameraIcon, UploadIcon, MicIcon, StopIcon } from './icons'
import { FullScreenModal, MODAL_EXIT_MS, FIELD_LABEL, TEXTAREA, INPUT, ErrorBox, PrimaryButton, ExpandableTextarea } from './ui'

// The walkthrough now starts at the top of the form: say the company, it lands
// and the highlight moves on. Short fields auto-advance; the observation
// sections stay open until "next" / "skip".
const STEPS = [
  { key: 'companyAssessed', label: 'Company Assessed', auto: true, hint: 'Say the company being assessed' },
  { key: 'location', label: 'Location / Area', auto: true, hint: 'Say where on site — e.g. "ROM pad"' },
  { key: 'activity', label: 'Activity Observed', auto: true, hint: 'Say the activity — e.g. "mobile plant operation"' },
  { key: 'positives', label: 'Positive Behaviours', hint: 'Talk it through, then say "next" (or "skip")' },
  { key: 'atRisk', label: 'At-Risk Behaviours', hint: 'Talk it through, then say "next" (or "skip")' },
  { key: 'hazards', label: 'Hazards Identified', hint: 'Talk it through, then say "next" (or "skip")' },
  { key: 'actions', label: 'Actions Taken / Required', hint: 'Talk it through, then say "next" (or "skip")' },
  { key: 'notes', label: 'Additional Notes', hint: 'Anything else — say "done" to finish' },
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
  const [leaving, setLeaving] = useState(false)
  const photoRef = useRef()
  const uploadRef = useRef()
  const time = useRef(new Date().toISOString())
  const sectionRefs = useRef({})

  // Short fields get replaced (repeat yourself to correct it); the observation
  // sections accumulate as you talk.
  const replaceSetters = { companyAssessed: setCompanyAssessed, location: setLocation, activity: setActivity }
  const appendSetters = { positives: setPositives, atRisk: setAtRisk, hazards: setHazards, actions: setActions, notes: setNotes }

  const walk = useVoiceWalkthrough({
    steps: STEPS,
    onText: (key, t) => {
      if (replaceSetters[key]) { replaceSetters[key](t); return }
      appendSetters[key]?.(prev => { const cur = prev || ''; const sep = cur && !/\s$/.test(cur) ? ' ' : ''; return cur + sep + t })
    },
    onStep: (i) => {
      const el = sectionRefs.current[STEPS[i].key]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
    },
    onError: setError,
  })

  const isActive = (k) => walk.active && STEPS[walk.step].key === k
  const sectionStyle = (k) => ({ marginBottom: '1rem', borderRadius: '0.5rem', padding: isActive(k) ? '0.6rem' : 0, border: isActive(k) ? '1.5px solid var(--accent)' : '1.5px solid transparent', boxShadow: isActive(k) ? '0 0 16px rgba(255,157,61,0.35)' : 'none', transition: 'border-color 0.2s, box-shadow 0.2s' })
  // Grid cells manage their own bottom margin via the row.
  const cellStyle = (k) => ({ ...sectionStyle(k), marginBottom: 0 })

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

  // Save and cancel both play the modal's exit motion before unmounting.
  const save = () => {
    if (leaving) return
    walk.stop()
    try { localStorage.setItem(STORAGE_KEYS.FIELD_REPORT_COMPANY, yourCompany) } catch (_) {}
    rememberCompanies(companyAssessed, yourCompany)
    setLeaving(true)
    setTimeout(() => onSave({
      id: generateId(), time: time.current,
      location, companyAssessed, yourCompany, activity,
      positives, atRisk, hazards, actions, notes, photos,
      formalReport: report,
    }), MODAL_EXIT_MS)
  }

  const cancel = () => {
    if (leaving) return
    walk.stop()
    setLeaving(true)
    setTimeout(onClose, MODAL_EXIT_MS)
  }

  return (
    <FullScreenModal
      badge="📋"
      title="Field Leadership Report"
      onClose={() => { walk.stop(); onClose() }}
      leaving={leaving}
      footer={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={save} style={{ flex: 1, padding: '0.8rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
            Save Report
          </button>
          <button onClick={cancel} style={{ padding: '0.8rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      }
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '1rem' }}>{formatDateTime(time.current)}</div>

      {/* Voice walkthrough control */}
      {!walk.active ? (
        <button onClick={walk.start} style={{ width: '100%', marginBottom: '1.25rem', padding: '0.85rem', border: 'none', borderRadius: '0.75rem', background: 'linear-gradient(135deg, var(--glow-b), var(--glow-c))', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(255,157,61,0.35)' }}>
          <MicIcon size={18} /> Voice walkthrough — talk, boxes fill
        </button>
      ) : (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--accent)', borderRadius: '0.75rem', padding: '0.8rem 0.9rem', marginBottom: '1.25rem', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-soft)' }}>{walk.listening ? '● Listening' : 'Paused'} · {walk.step + 1}/{STEPS.length}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{STEPS[walk.step].label}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button onClick={walk.next} style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: '0.5rem', backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>{walk.step === STEPS.length - 1 ? 'Finish' : 'Next →'}</button>
              <button onClick={walk.stop} aria-label="Stop" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', backgroundColor: 'var(--error-bg-strong)', color: 'var(--error-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StopIcon size={13} /></button>
            </div>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', margin: '0.45rem 0 0', fontWeight: 600, lineHeight: 1.4 }}>{STEPS[walk.step].hint}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div ref={el => (sectionRefs.current.companyAssessed = el)} style={cellStyle('companyAssessed')}>
          <CompanyField label="Company Assessed" value={companyAssessed} onChange={setCompanyAssessed} placeholder="e.g. ABC Contracting" />
        </div>
        <CompanyField label="Your Company" value={yourCompany} onChange={setYourCompany} placeholder="Who you work for" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div ref={el => (sectionRefs.current.location = el)} style={cellStyle('location')}>
          <div style={FIELD_LABEL}>Location / Area</div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. ROM pad, workshop" style={INPUT} />
        </div>
        <div ref={el => (sectionRefs.current.activity = el)} style={cellStyle('activity')}>
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
                <button onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-danger)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
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
    </FullScreenModal>
  )
}
