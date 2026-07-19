import { useState, useRef } from 'react'
import { generateId, compressPhoto } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { STORAGE_KEYS, INCIDENT_TYPES } from '../constants'
import { callAnthropicAPI, buildIncidentPrompt, buildImageBlocks, buildJsaScanPrompt } from '../utils/api'
import { rememberCompanies } from '../utils/companies'
import { useVoiceWalkthrough } from '../hooks/useVoiceWalkthrough'
import SafetyTextarea from './SafetyTextarea'
import DocScanner from './DocScanner'
import CompanyField from './CompanyField'
import { CameraIcon, DocIcon, UploadIcon, MicIcon, StopIcon } from './icons'
import { FullScreenModal, MODAL_EXIT_MS, FIELD_LABEL, TEXTAREA, INPUT, ErrorBox, PrimaryButton } from './ui'

const PICKER_BTN = { padding: '0.45rem 0.875rem', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }

// Voice walkthrough order — short fields auto-advance (say it, box fills,
// highlight moves on); the description stays open until "done".
const STEPS = [
  { key: 'company', label: 'Company', auto: true, hint: 'Say the company name' },
  { key: 'location', label: 'Location / Area', auto: true, hint: 'Say where on site — e.g. "ROM pad"' },
  { key: 'type', label: 'Type of Incident', auto: true, hint: 'Say one: near miss, first aid, medical, property damage, environmental, vehicle, psychosocial, HR, other' },
  { key: 'persons', label: 'Persons Involved', auto: true, hint: 'Say the names or roles' },
  { key: 'description', label: 'Description', hint: 'Talk through what happened — say "done" to finish' },
]

// Map whatever was said to one of the INCIDENT_TYPES, or null if nothing fits.
function matchIncidentType(spoken) {
  const lc = spoken.toLowerCase()
  if (lc.includes('near') || lc.includes('miss')) return 'Near Miss'
  if (lc.includes('first aid') || lc.includes('first-aid')) return 'First Aid'
  if (lc.includes('medical')) return 'Medical Treatment'
  if (lc.includes('property') || lc.includes('equipment') || lc.includes('damage')) return 'Property / Equipment Damage'
  if (lc.includes('environment')) return 'Environmental'
  if (lc.includes('vehicle') || lc.includes('mobile') || lc.includes('plant')) return 'Vehicle / Mobile Plant'
  if (lc.includes('psycho') || lc.includes('mental')) return 'Psychosocial'
  if (/\bhr\b/.test(lc) || lc.includes('human resources')) return 'HR'
  if (lc.includes('other')) return 'Other'
  return null
}

function PhotoPicker({ photos, onAdd, onRemove, onScan }) {
  const camRef = useRef()
  const upRef = useRef()
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => camRef.current?.click()} style={PICKER_BTN}>
          <CameraIcon size={15} /> Camera
        </button>
        <button onClick={() => upRef.current?.click()} style={PICKER_BTN}>
          <UploadIcon size={15} /> Upload
        </button>
        {onScan && (
          <button onClick={onScan} style={PICKER_BTN}>
            <DocIcon size={15} /> Doc Scan
          </button>
        )}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onAdd} style={{ display: 'none' }} />
      <input ref={upRef} type="file" accept="image/*" onChange={onAdd} style={{ display: 'none' }} />
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {photos.map((p, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img src={p} alt={`Photo ${idx + 1}`} style={{ height: '5.5rem', borderRadius: '0.5rem', objectFit: 'cover' }} />
              <button onClick={() => onRemove(idx)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-danger)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function IncidentReport({ apiKey, onClose, onSave }) {
  const [companyName, setCompanyName] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.INCIDENT_COMPANY) || '' } catch (_) { return '' }
  })
  const [location, setLocation] = useState('')
  const [incidentType, setIncidentType] = useState('')
  const [personsInvolved, setPersonsInvolved] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [jsaPhotos, setJsaPhotos] = useState([])
  const [jsaSummary, setJsaSummary] = useState('')
  const [jsaLoading, setJsaLoading] = useState(false)
  const [jsaError, setJsaError] = useState('')
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [bigText, setBigText] = useState(null) // null | 'jsa' | 'report' — full-screen read/edit
  const [typeMiss, setTypeMiss] = useState(false) // spoken type didn't match — stay + hint
  const [leaving, setLeaving] = useState(false)
  const time = useRef(new Date().toISOString())
  const sectionRefs = useRef({})

  // --- Voice walkthrough: say the company → box fills → highlight moves on --
  const setters = { company: setCompanyName, location: setLocation, persons: setPersonsInvolved }
  const walk = useVoiceWalkthrough({
    steps: STEPS,
    onText: (key, t) => {
      if (key === 'type') {
        const m = matchIncidentType(t)
        if (!m) { setTypeMiss(true); return 'stay' }
        setTypeMiss(false); setIncidentType(m)
        return
      }
      if (key === 'description') {
        setDescription(prev => { const cur = prev || ''; const sep = cur && !/\s$/.test(cur) ? ' ' : ''; return cur + sep + t })
        return
      }
      setters[key]?.(t)
    },
    onStep: (i) => {
      setTypeMiss(false)
      const el = sectionRefs.current[STEPS[i].key]
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
    },
    onError: setError,
  })

  const isActive = (k) => walk.active && STEPS[walk.step].key === k
  const sectionStyle = (k) => ({ borderRadius: '0.5rem', padding: isActive(k) ? '0.5rem' : 0, border: isActive(k) ? '1.5px solid var(--accent)' : '1.5px solid transparent', boxShadow: isActive(k) ? '0 0 16px rgba(255,157,61,0.35)' : 'none', transition: 'border-color 0.2s, box-shadow 0.2s' })

  const addPhoto = (setter) => async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressPhoto(file)
    setter(prev => [...prev, compressed])
    e.target.value = ''
  }
  const removeAt = (setter) => (idx) => setter(prev => prev.filter((_, i) => i !== idx))

  // Scan → immediately read to de-identified text, then DISCARD the image so no
  // company branding/logos/site info is ever stored. Only the safety text is kept.
  const handleScanSave = async (dataUrl) => {
    setShowScanner(false)
    setJsaLoading(true); setJsaError('')
    try {
      const content = [...buildImageBlocks([dataUrl]), { type: 'text', text: buildJsaScanPrompt() }]
      const text = await callAnthropicAPI(apiKey, content, 600)
      setJsaSummary(prev => (prev ? prev + '\n\n' : '') + text.trim())
    } catch (e) {
      setJsaError(e.message || 'Could not read the document — try again.')
    } finally {
      setJsaLoading(false)
    }
  }

  const scanJsa = async () => {
    if (!jsaPhotos.length) return
    setJsaLoading(true); setJsaError('')
    try {
      const content = [...buildImageBlocks(jsaPhotos), { type: 'text', text: buildJsaScanPrompt() }]
      const text = await callAnthropicAPI(apiKey, content, 600)
      setJsaSummary(text)
    } catch (e) { setJsaError(e.message) }
    finally { setJsaLoading(false) }
  }

  const generate = async () => {
    if (!description.trim()) { setError('Add a description first.'); return }
    setLoading(true); setError('')
    try {
      const fields = { companyName, location, incidentType, personsInvolved, description, jsaSummary }
      const text = await callAnthropicAPI(apiKey, buildIncidentPrompt(fields, time.current))
      setReport(text)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Save and cancel both play the modal's exit motion before unmounting.
  const save = () => {
    if (leaving) return
    walk.stop()
    try { localStorage.setItem(STORAGE_KEYS.INCIDENT_COMPANY, companyName) } catch (_) {}
    rememberCompanies(companyName)
    setLeaving(true)
    setTimeout(() => onSave({
      id: generateId(), time: time.current,
      companyName, location, incidentType, personsInvolved, description,
      photos, jsaPhotos, jsaSummary, formalReport: report,
    }), MODAL_EXIT_MS)
  }

  const cancel = () => {
    if (leaving) return
    walk.stop()
    setLeaving(true)
    setTimeout(onClose, MODAL_EXIT_MS)
  }

  if (showScanner) {
    return <DocScanner onClose={() => setShowScanner(false)} onSave={handleScanSave} />
  }

  return (
    <FullScreenModal
      badge="!"
      badgeColor="var(--danger)"
      title="Incident Report"
      titleColor="var(--error-text)"
      headerBg="var(--error-bg)"
      headerBorder="var(--error-border)"
      onClose={onClose}
      leaving={leaving}
      footer={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={save} style={{ flex: 1, padding: '0.8rem', backgroundColor: 'var(--danger)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-danger)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
            Save Incident
          </button>
          <button onClick={cancel} style={{ padding: '0.8rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      }
      overlay={bigText && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', paddingTop: 'calc(0.875rem + env(safe-area-inset-top))', borderBottom: '1px solid var(--border-accent)', backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-soft)' }}>{bigText === 'jsa' ? 'JSA / Permit Summary' : 'Incident Report'}</span>
            <button onClick={() => setBigText(null)} aria-label="Done" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}>×</button>
          </div>
          <textarea
            value={bigText === 'jsa' ? jsaSummary : report}
            onChange={e => (bigText === 'jsa' ? setJsaSummary(e.target.value) : setReport(e.target.value))}
            autoFocus
            style={{ flex: 1, width: '100%', border: 'none', outline: 'none', resize: 'none', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.7, padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', fontFamily: 'inherit' }}
          />
        </div>
      )}
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '1rem' }}>{formatDateTime(time.current)}</div>

      {/* Voice walkthrough — one mic fills every box in order */}
      {!walk.active ? (
        <button onClick={walk.start} style={{ width: '100%', marginBottom: '1rem', padding: '0.85rem', border: 'none', borderRadius: '0.75rem', background: 'linear-gradient(135deg, var(--glow-b), var(--glow-c))', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 6px 20px rgba(255,157,61,0.35)' }}>
          <MicIcon size={18} /> Voice walkthrough — talk, boxes fill
        </button>
      ) : (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--accent)', borderRadius: '0.75rem', padding: '0.8rem 0.9rem', marginBottom: '1rem', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
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
          <p style={{ fontSize: '0.68rem', color: typeMiss ? 'var(--warning-text)' : 'var(--text-faint)', margin: '0.45rem 0 0', fontWeight: 600, lineHeight: 1.4 }}>
            {typeMiss ? 'Didn\'t catch a type — say e.g. "near miss" or "first aid", or tap the dropdown.' : STEPS[walk.step].hint}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
        <span style={{ fontSize: '0.9rem', lineHeight: 1.2 }}>⚠</span>
        <p style={{ fontSize: '0.72rem', color: 'var(--warning-text)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          Generating a report sends these details to the Anthropic AI. For <strong>HR, psychosocial, or sensitive</strong> incidents, use initials or roles instead of full names.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div ref={el => (sectionRefs.current.company = el)} style={sectionStyle('company')}>
          <CompanyField label="Company" value={companyName} onChange={setCompanyName} placeholder="e.g. ABC Contracting" />
        </div>
        <div ref={el => (sectionRefs.current.location = el)} style={sectionStyle('location')}>
          <div style={FIELD_LABEL}>Location / Area</div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. ROM pad, workshop" style={INPUT} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div ref={el => (sectionRefs.current.type = el)} style={sectionStyle('type')}>
          <div style={FIELD_LABEL}>Type of Incident</div>
          <select value={incidentType} onChange={e => setIncidentType(e.target.value)} style={INPUT}>
            <option value="">Select type...</option>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div ref={el => (sectionRefs.current.persons = el)} style={sectionStyle('persons')}>
          <div style={FIELD_LABEL}>Persons Involved</div>
          <input value={personsInvolved} onChange={e => setPersonsInvolved(e.target.value)} placeholder="Names / roles" style={INPUT} />
        </div>
      </div>

      <div ref={el => (sectionRefs.current.description = el)} style={{ ...sectionStyle('description'), marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Description</div>
        <SafetyTextarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What happened, where on site, who was involved, what immediate actions were taken."
          rows={4}
          style={TEXTAREA}
          apiKey={apiKey}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Photos</div>
        <PhotoPicker photos={photos} onAdd={addPhoto(setPhotos)} onRemove={removeAt(setPhotos)} label="Add Photo" />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>JSA / Permit Documents</div>
        <PhotoPicker photos={jsaPhotos} onAdd={addPhoto(setJsaPhotos)} onRemove={removeAt(setJsaPhotos)} onScan={() => setShowScanner(true)} label="Add Photo" />
        {jsaPhotos.length > 0 && (
          <PrimaryButton onClick={scanJsa} loading={jsaLoading} style={{ marginTop: '0.6rem' }}>
            {jsaLoading ? 'Reading Document...' : 'Read JSA / Permit (AI)'}
          </PrimaryButton>
        )}
        {jsaLoading && jsaPhotos.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--accent-soft)', fontWeight: 700, marginTop: '0.6rem' }}>Reading scanned document — stripping company details…</p>
        )}
        <ErrorBox style={{ marginTop: '0.6rem' }}>{jsaError}</ErrorBox>
        {jsaSummary && (
          <div style={{ marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <div style={{ ...FIELD_LABEL, marginBottom: 0 }}>JSA Summary (editable)</div>
              <button onClick={() => setBigText('jsa')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>⤢ Full screen</button>
            </div>
            <SafetyTextarea value={jsaSummary} onChange={e => setJsaSummary(e.target.value)} rows={4} style={TEXTAREA} apiKey={apiKey} />
          </div>
        )}
      </div>

      <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

      <PrimaryButton onClick={generate} disabled={!description.trim()} loading={loading} style={{ marginBottom: '0.75rem' }}>
        {loading ? 'Generating Report...' : 'Generate Formal Report (AI)'}
      </PrimaryButton>

      {report && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <div style={{ ...FIELD_LABEL, marginBottom: 0 }}>Generated Report (editable)</div>
            <button onClick={() => setBigText('report')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>⤢ Full screen</button>
          </div>
          <SafetyTextarea value={report} onChange={e => setReport(e.target.value)} rows={14} style={TEXTAREA} apiKey={apiKey} />
        </div>
      )}
    </FullScreenModal>
  )
}
