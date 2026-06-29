import { useState, useRef } from 'react'
import { generateId, compressPhoto } from '../../utils/storage'
import { TAG_STYLES } from '../../constants'
import { formatTime, formatDateTime } from '../../utils/format'
import SafetyTextarea from '../SafetyTextarea'
import { CameraIcon, AlertCircleIcon } from '../icons'
import { FullScreenModal, PhaseHeader, SECTION_LABEL, TEXTAREA } from '../ui'

const TAGS = ['Hazard', 'Action', 'Observation', 'Near Miss']

export default function SiteRounds({ shift, updateShift, apiKey }) {
  const [text, setText] = useState('')
  const [tag, setTag] = useState('Observation')
  const [photo, setPhoto] = useState(null)
  const [rectification, setRectification] = useState('')
  const [rectifiedPhoto, setRectifiedPhoto] = useState(null)
  const [prevention, setPrevention] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('All')
  const photoRef = useRef()
  const rectifiedPhotoRef = useRef()

  const rounds = shift.rounds || []
  const selected = rounds.find(r => r.id === selectedId) || null

  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(await compressPhoto(file))
    e.target.value = ''
  }

  const handleRectifiedPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setRectifiedPhoto(await compressPhoto(file))
    e.target.value = ''
  }

  const addEntry = () => {
    if (!text.trim()) return
    const entry = { id: generateId(), time: new Date().toISOString(), text: text.trim(), tag, photo }
    if (tag === 'Hazard') {
      if (rectification.trim()) entry.rectification = rectification.trim()
      if (rectifiedPhoto) entry.rectifiedPhoto = rectifiedPhoto
    }
    if (tag === 'Near Miss') {
      if (prevention.trim()) entry.prevention = prevention.trim()
    }
    updateShift({ rounds: [...rounds, entry] })
    setText('')
    setPhoto(null)
    setRectification('')
    setRectifiedPhoto(null)
    setPrevention('')
  }

  const removeEntry = (id) => updateShift({ rounds: rounds.filter(r => r.id !== id) })
  const updateEntry = (id, changes) => updateShift({ rounds: rounds.map(r => r.id === id ? { ...r, ...changes } : r) })

  const visible = filter === 'All' ? rounds : rounds.filter(r => r.tag === filter)
  const countFor = (t) => rounds.filter(r => r.tag === t).length

  return (
    <div style={{ padding: '1.5rem 1rem' }}>
      <PhaseHeader
        phase={3}
        title="Site Rounds"
        blurb="Walk the site and log observations as you go. Use voice for speed, or type. Tag each entry so it's easy to sort later."
        meta={rounds.length > 0 ? `${rounds.length} ${rounds.length === 1 ? 'entry' : 'entries'} recorded this shift` : null}
      />

      {/* Entry form */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border-accent)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={SECTION_LABEL}>New Entry</div>

        {/* Tag selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {TAGS.map(t => {
            const s = TAG_STYLES[t]
            const active = tag === t
            const isHazard = t === 'Hazard'
            // Hazard always shows its colour + an alert icon so it stands out and
            // is quick to tap; the others stay quiet until selected.
            return (
              <button
                key={t}
                onClick={() => setTag(t)}
                style={{
                  padding: isHazard ? '0.4rem 0.9rem' : '0.3rem 0.75rem', borderRadius: '0.375rem',
                  border: `${isHazard ? 2 : 1.5}px solid ${active || isHazard ? s.border : 'var(--border)'}`,
                  backgroundColor: active || isHazard ? s.bg : 'transparent',
                  color: active || isHazard ? s.text : 'var(--text-faint)',
                  fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.05em', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  boxShadow: isHazard && active ? `0 0 12px ${s.border}` : 'none',
                }}
              >
                {isHazard && <AlertCircleIcon size={13} />}{t}
              </button>
            )
          })}
        </div>

        {/* Photo control */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            onClick={() => photoRef.current?.click()}
            style={{ padding: '0.45rem 0.75rem', border: 'none', borderRadius: '0.5rem', backgroundColor: 'var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <CameraIcon size={14} /> {tag === 'Hazard' ? 'HAZARD PHOTO' : 'PHOTO'}
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        </div>

        <SafetyTextarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe what you observed — be specific about location, what you saw, and any immediate action taken."
          rows={3}
          style={TEXTAREA}
          apiKey={apiKey}
        />

        {photo && (
          <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
            <img src={photo} alt="Entry" style={{ maxHeight: '6rem', borderRadius: '0.375rem', objectFit: 'contain' }} />
            <button
              onClick={() => setPhoto(null)}
              style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-accent)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>
          </div>
        )}

        {tag === 'Hazard' && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
              Rectification (optional)
            </div>
            <SafetyTextarea
              value={rectification}
              onChange={e => setRectification(e.target.value)}
              placeholder="How was the hazard fixed or controlled? Leave blank if still open."
              rows={2}
              style={TEXTAREA}
              apiKey={apiKey}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => rectifiedPhotoRef.current?.click()}
                style={{ padding: '0.45rem 0.75rem', border: 'none', borderRadius: '0.5rem', backgroundColor: 'var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <CameraIcon size={14} /> RECTIFIED PHOTO
              </button>
              <input ref={rectifiedPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleRectifiedPhoto} style={{ display: 'none' }} />
            </div>
            {rectifiedPhoto && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
                <img src={rectifiedPhoto} alt="Rectified hazard" style={{ maxHeight: '6rem', borderRadius: '0.375rem', objectFit: 'contain' }} />
                <button
                  onClick={() => setRectifiedPhoto(null)}
                  style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-accent)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {tag === 'Near Miss' && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
              Prevention (optional)
            </div>
            <SafetyTextarea
              value={prevention}
              onChange={e => setPrevention(e.target.value)}
              placeholder="What will be done to stop this happening again?"
              rows={2}
              style={TEXTAREA}
              apiKey={apiKey}
            />
          </div>
        )}

        <button
          onClick={addEntry}
          disabled={!text.trim()}
          style={{ marginTop: '0.75rem', width: '100%', padding: '0.625rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '0.875rem', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.4 }}
        >
          Log Entry
        </button>
      </div>

      {/* Running log */}
      {rounds.length > 0 && (
        <div>
          <div style={{ ...SECTION_LABEL, color: 'var(--text-faint)' }}>
            Entries Log — newest first
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <FilterChip label={`All (${rounds.length})`} active={filter === 'All'} onClick={() => setFilter('All')} />
            {TAGS.map(t => countFor(t) > 0 && (
              <FilterChip
                key={t}
                label={`${t} (${countFor(t)})`}
                active={filter === t}
                onClick={() => setFilter(filter === t ? 'All' : t)}
                tagStyle={TAG_STYLES[t]}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 600 }}>No {filter.toLowerCase()} entries.</p>
          ) : [...visible].reverse().map(entry => (
            <EntryCard key={entry.id} entry={entry} onRemove={() => removeEntry(entry.id)} onSelect={() => setSelectedId(entry.id)} />
          ))}
        </div>
      )}

      {selected && (
        <EntryDetail
          entry={selected}
          onClose={() => setSelectedId(null)}
          onRemove={() => { removeEntry(selected.id); setSelectedId(null) }}
          onUpdate={(changes) => updateEntry(selected.id, changes)}
          apiKey={apiKey}
        />
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick, tagStyle }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.25rem 0.65rem', borderRadius: '1rem',
        border: `1.5px solid ${active ? (tagStyle?.border || 'var(--accent)') : 'var(--border)'}`,
        backgroundColor: active ? (tagStyle?.bg || 'var(--bg-highlight)') : 'transparent',
        color: active ? (tagStyle?.text || 'var(--accent-soft)') : 'var(--text-faint)',
        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function EntryCard({ entry, onRemove, onSelect }) {
  const s = TAG_STYLES[entry.tag] || TAG_STYLES.Observation
  return (
    <div onClick={onSelect} style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${s.border}50`, borderLeft: `3px solid ${s.border}`, borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontWeight: 700 }}>{formatTime(entry.time)}</span>
          <span style={{ padding: '0.1rem 0.4rem', borderRadius: '0.25rem', backgroundColor: s.bg, color: s.text, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {entry.tag}
          </span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>✕</button>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{entry.text}</p>
      {entry.photo && <img src={entry.photo} alt="Entry" style={{ marginTop: '0.5rem', maxHeight: '8rem', borderRadius: '0.375rem', objectFit: 'contain' }} />}
      {entry.tag === 'Hazard' && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', fontWeight: 800, color: (entry.rectification || entry.rectifiedPhoto) ? 'var(--success-text)' : 'var(--text-faint)' }}>
          {(entry.rectification || entry.rectifiedPhoto) ? '✓ Rectified' : '○ Open — not yet rectified'}
        </div>
      )}
      {entry.tag === 'Near Miss' && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', fontWeight: 800, color: entry.prevention ? 'var(--success-text)' : 'var(--text-faint)' }}>
          {entry.prevention ? '✓ Prevention noted' : '○ No prevention noted yet'}
        </div>
      )}
    </div>
  )
}

function EntryDetail({ entry, onClose, onRemove, onUpdate, apiKey }) {
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(entry.text)
  const [draftTag, setDraftTag] = useState(entry.tag)
  const [draftRectification, setDraftRectification] = useState(entry.rectification || '')
  const [draftRectifiedPhoto, setDraftRectifiedPhoto] = useState(entry.rectifiedPhoto || null)
  const [draftPrevention, setDraftPrevention] = useState(entry.prevention || '')
  const rectifiedPhotoRef = useRef()
  const s = TAG_STYLES[entry.tag] || TAG_STYLES.Observation

  const handleRectifiedPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDraftRectifiedPhoto(await compressPhoto(file))
    e.target.value = ''
  }

  const startEdit = () => {
    setDraftText(entry.text)
    setDraftTag(entry.tag)
    setDraftRectification(entry.rectification || '')
    setDraftRectifiedPhoto(entry.rectifiedPhoto || null)
    setDraftPrevention(entry.prevention || '')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraftText(entry.text)
    setDraftTag(entry.tag)
    setDraftRectification(entry.rectification || '')
    setDraftRectifiedPhoto(entry.rectifiedPhoto || null)
    setDraftPrevention(entry.prevention || '')
    setEditing(false)
  }

  const saveEdit = () => {
    if (!draftText.trim()) return
    const changes = { text: draftText.trim(), tag: draftTag }
    if (draftTag === 'Hazard') {
      changes.rectification = draftRectification.trim() || undefined
      changes.rectifiedPhoto = draftRectifiedPhoto || undefined
    } else {
      changes.rectification = undefined
      changes.rectifiedPhoto = undefined
    }
    if (draftTag === 'Near Miss') {
      changes.prevention = draftPrevention.trim() || undefined
    } else {
      changes.prevention = undefined
    }
    onUpdate(changes)
    setEditing(false)
  }

  return (
    <FullScreenModal
      onClose={onClose}
      badgeEl={
        <>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '0.3rem', backgroundColor: s.bg, color: s.text, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {entry.tag}
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDateTime(entry.time)}</span>
        </>
      }
    >
      {editing ? (
        <>
          {/* Tag selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {TAGS.map(t => {
              const ts = TAG_STYLES[t]
              const active = draftTag === t
              return (
                <button
                  key={t}
                  onClick={() => setDraftTag(t)}
                  style={{
                    padding: '0.3rem 0.75rem', borderRadius: '0.375rem',
                    border: `1.5px solid ${active ? ts.border : 'var(--border)'}`,
                    backgroundColor: active ? ts.bg : 'transparent',
                    color: active ? ts.text : 'var(--text-faint)',
                    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.05em', cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>

          <SafetyTextarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            rows={6}
            style={TEXTAREA}
            apiKey={apiKey}
          />

          {draftTag === 'Hazard' && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
              <div style={SECTION_LABEL}>Rectification (optional)</div>
              <SafetyTextarea
                value={draftRectification}
                onChange={e => setDraftRectification(e.target.value)}
                placeholder="How was the hazard fixed or controlled? Leave blank if still open."
                rows={3}
                style={TEXTAREA}
                apiKey={apiKey}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => rectifiedPhotoRef.current?.click()}
                  style={{ padding: '0.45rem 0.75rem', border: 'none', borderRadius: '0.5rem', backgroundColor: 'var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CameraIcon size={14} /> RECTIFIED PHOTO
                </button>
                <input ref={rectifiedPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleRectifiedPhoto} style={{ display: 'none' }} />
              </div>
              {draftRectifiedPhoto && (
                <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
                  <img src={draftRectifiedPhoto} alt="Rectified hazard" style={{ maxHeight: '6rem', borderRadius: '0.375rem', objectFit: 'contain' }} />
                  <button
                    onClick={() => setDraftRectifiedPhoto(null)}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--danger)', border: 'none', color: 'var(--on-accent)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {draftTag === 'Near Miss' && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
              <div style={SECTION_LABEL}>Prevention (optional)</div>
              <SafetyTextarea
                value={draftPrevention}
                onChange={e => setDraftPrevention(e.target.value)}
                placeholder="What will be done to stop this happening again?"
                rows={3}
                style={TEXTAREA}
                apiKey={apiKey}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={saveEdit}
              disabled={!draftText.trim()}
              style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.875rem', cursor: draftText.trim() ? 'pointer' : 'not-allowed', opacity: draftText.trim() ? 1 : 0.4 }}
            >
              Save Changes
            </button>
            <button
              onClick={cancelEdit}
              style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.text}</p>

          {entry.photo && (
            <img src={entry.photo} alt="Entry" style={{ width: '100%', borderRadius: '0.5rem', objectFit: 'contain', marginBottom: '1rem' }} />
          )}

          {entry.tag === 'Hazard' && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
              <div style={SECTION_LABEL}>Rectification</div>
              {(entry.rectification || entry.rectifiedPhoto) ? (
                <>
                  {entry.rectification && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.rectification}</p>
                  )}
                  {entry.rectifiedPhoto && (
                    <img src={entry.rectifiedPhoto} alt="Rectified hazard" style={{ width: '100%', borderRadius: '0.5rem', objectFit: 'contain' }} />
                  )}
                </>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', fontWeight: 600, margin: 0 }}>
                  Not yet rectified. Edit this entry to record how it was fixed.
                </p>
              )}
            </div>
          )}

          {entry.tag === 'Near Miss' && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
              <div style={SECTION_LABEL}>Prevention</div>
              {entry.prevention ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.prevention}</p>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', fontWeight: 600, margin: 0 }}>
                  Not yet recorded. Edit this entry to add what will prevent a recurrence.
                </p>
              )}
            </div>
          )}

          <button
            onClick={startEdit}
            style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', borderRadius: '0.5rem', color: 'var(--accent-soft)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}
          >
            ✎ Edit Entry
          </button>

          <button
            onClick={onRemove}
            style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '0.5rem', color: 'var(--error-text)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Delete Entry
          </button>
        </>
      )}
    </FullScreenModal>
  )
}
