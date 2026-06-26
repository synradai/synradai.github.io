import { useState, useRef } from 'react'
import { generateId, compressPhoto } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { STORAGE_KEYS, INCIDENT_TYPES } from '../constants'
import { callAnthropicAPI, buildIncidentPrompt, buildImageBlocks, buildJsaScanPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import DocScanner from './DocScanner'
import { FullScreenModal, FIELD_LABEL, TEXTAREA, INPUT, ErrorBox, PrimaryButton } from './ui'

const PICKER_BTN = { padding: '0.4rem 0.875rem', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }

function PhotoPicker({ photos, onAdd, onRemove, onScan, label }) {
  const ref = useRef()
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => ref.current?.click()} style={PICKER_BTN}>
          📷 {label}
        </button>
        {onScan && (
          <button onClick={onScan} style={PICKER_BTN}>
            📄 Doc Scan
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onAdd} style={{ display: 'none' }} />
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {photos.map((p, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img src={p} alt={`Photo ${idx + 1}`} style={{ height: '5.5rem', borderRadius: '0.5rem', objectFit: 'cover' }} />
              <button onClick={() => onRemove(idx)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-accent)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
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
  const time = useRef(new Date().toISOString())

  const addPhoto = (setter) => async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressPhoto(file)
    setter(prev => [...prev, compressed])
    e.target.value = ''
  }
  const removeAt = (setter) => (idx) => setter(prev => prev.filter((_, i) => i !== idx))

  const handleScanSave = (dataUrl) => {
    setJsaPhotos(prev => [...prev, dataUrl])
    setShowScanner(false)
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

  const save = () => {
    try { localStorage.setItem(STORAGE_KEYS.INCIDENT_COMPANY, companyName) } catch (_) {}
    onSave({
      id: generateId(), time: time.current,
      companyName, location, incidentType, personsInvolved, description,
      photos, jsaPhotos, jsaSummary, formalReport: report,
    })
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
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '1rem' }}>{formatDateTime(time.current)}</div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
        <span style={{ fontSize: '0.9rem', lineHeight: 1.2 }}>⚠</span>
        <p style={{ fontSize: '0.72rem', color: 'var(--warning-text)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          Generating a report sends these details to the Anthropic AI. For <strong>HR, psychosocial, or sensitive</strong> incidents, use initials or roles instead of full names.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={FIELD_LABEL}>Company</div>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. ABC Contracting" style={INPUT} />
        </div>
        <div>
          <div style={FIELD_LABEL}>Location / Area</div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. ROM pad, workshop" style={INPUT} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={FIELD_LABEL}>Type of Incident</div>
          <select value={incidentType} onChange={e => setIncidentType(e.target.value)} style={INPUT}>
            <option value="">Select type...</option>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={FIELD_LABEL}>Persons Involved</div>
          <input value={personsInvolved} onChange={e => setPersonsInvolved(e.target.value)} placeholder="Names / roles" style={INPUT} />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
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
        <ErrorBox style={{ marginTop: '0.6rem' }}>{jsaError}</ErrorBox>
        {jsaSummary && (
          <div style={{ marginTop: '0.6rem' }}>
            <div style={FIELD_LABEL}>JSA Summary (editable)</div>
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
          <div style={FIELD_LABEL}>Generated Report (editable)</div>
          <SafetyTextarea value={report} onChange={e => setReport(e.target.value)} rows={14} style={TEXTAREA} apiKey={apiKey} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1rem' }}>
        <button onClick={save} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--danger)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
          Save Incident
        </button>
        <button onClick={onClose} style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </FullScreenModal>
  )
}
