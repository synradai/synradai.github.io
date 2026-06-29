import { useState, useRef } from 'react'
import { generateId, compressPhoto } from '../utils/storage'
import { formatDateTime } from '../utils/format'
import { STORAGE_KEYS } from '../constants'
import { callAnthropicAPI, buildFieldLeadershipPrompt } from '../utils/api'
import SafetyTextarea from './SafetyTextarea'
import { CameraIcon } from './icons'
import { FullScreenModal, FIELD_LABEL, TEXTAREA, INPUT, ErrorBox, PrimaryButton } from './ui'

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
  const time = useRef(new Date().toISOString())

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
    <FullScreenModal badge="📋" title="Field Leadership Report" onClose={onClose}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '1rem' }}>{formatDateTime(time.current)}</div>

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
        <div>
          <div style={FIELD_LABEL}>Activity Observed</div>
          <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. mobile plant operation" style={INPUT} />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ ...FIELD_LABEL, color: 'var(--success-text)' }}>Positive Behaviours</div>
        <SafetyTextarea value={positives} onChange={e => setPositives(e.target.value)} placeholder="What was being done well — PPE, procedures followed, good communication..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ ...FIELD_LABEL, color: 'var(--warning-text)' }}>At-Risk Behaviours</div>
        <SafetyTextarea value={atRisk} onChange={e => setAtRisk(e.target.value)} placeholder="Any unsafe acts observed and the conversation/feedback given..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ ...FIELD_LABEL, color: 'var(--error-text)' }}>Hazards Identified</div>
        <SafetyTextarea value={hazards} onChange={e => setHazards(e.target.value)} placeholder="Hazards found and their status..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Actions Taken / Required</div>
        <SafetyTextarea value={actions} onChange={e => setActions(e.target.value)} placeholder="What was actioned on the spot, and what still needs follow-up..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Additional Notes</div>
        <SafetyTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else worth recording..." rows={3} style={TEXTAREA} apiKey={apiKey} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={FIELD_LABEL}>Photos</div>
        <button onClick={() => photoRef.current?.click()} style={{ padding: '0.45rem 0.875rem', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-panel)', color: 'var(--accent-soft)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <CameraIcon size={15} /> Add Photo
        </button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
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
          <div style={FIELD_LABEL}>Generated Report (editable)</div>
          <SafetyTextarea value={report} onChange={e => setReport(e.target.value)} rows={14} style={TEXTAREA} apiKey={apiKey} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1rem' }}>
        <button onClick={save} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
          Save Report
        </button>
        <button onClick={onClose} style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </FullScreenModal>
  )
}
