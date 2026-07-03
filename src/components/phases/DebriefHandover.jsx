import { useState, useRef } from 'react'
import { callAnthropicAPI, buildHandoverPrompt } from '../../utils/api'
import { generateId } from '../../utils/storage'
import { formatTime } from '../../utils/format'
import SectionBlock from '../SectionBlock'
import SafetyTextarea from '../SafetyTextarea'
import { PhaseHeader, TEXTAREA, INPUT_FLEX, BTN_ADD, ErrorBox, ShareButton, FullScreenButton } from '../ui'

export default function DebriefHandover({ shift, updateShift, apiKey }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newAction, setNewAction] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState([false, false, false])
  const confirm = (i) => setConfirmed(prev => { const n = [...prev]; n[i] = !n[i]; return n })

  const deb = shift.debrief || { handoverNotes: '', outstandingActions: [], signoffName: '', signoffTime: '' }
  const update = (u) => updateShift({ debrief: { ...deb, ...u } })

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const text = await callAnthropicAPI(apiKey, buildHandoverPrompt(shift))
      update({ handoverNotes: text })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const addAction = () => {
    if (!newAction.trim()) return
    update({ outstandingActions: [...(deb.outstandingActions || []), { id: generateId(), text: newAction.trim(), done: false }] })
    setNewAction('')
  }

  const toggleAction = (id) => update({ outstandingActions: deb.outstandingActions.map(a => a.id === id ? { ...a, done: !a.done } : a) })

  const signOff = () => {
    if (!deb.signoffName.trim()) return
    update({ signoffTime: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) })
    confirm(2)
  }

  const copy = () => {
    navigator.clipboard.writeText(deb.handoverNotes || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const roundsActions = (shift.rounds || []).filter(r => r.tag === 'Action')

  const ref1 = useRef()
  const ref2 = useRef()

  return (
    <div style={{ padding: '1.5rem 1rem', paddingBottom: '3rem' }}>
      <PhaseHeader
        phase={5}
        title="Debrief + Handover"
        blurb="Wrap up the shift. Draft handover notes for the incoming advisor, clear outstanding actions, and sign off."
      />

      {/* Handover Notes */}
      <div style={{ marginBottom: '1.75rem' }}>
        <SectionBlock
          title="Handover Notes"
          hint="Draft with AI or write manually"
          confirmed={confirmed[0]}
          onConfirm={() => confirm(0)}
          confirmLabel="notes"
          nextRef={ref1}
        >
          <button
            onClick={generate}
            disabled={loading}
            style={{ width: '100%', padding: '0.875rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: '0.75rem' }}
          >
            {loading ? 'Drafting...' : deb.handoverNotes ? 'Redraft (AI)' : 'Draft Handover Notes (AI)'}
          </button>

          {!apiKey && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textAlign: 'center', marginBottom: '0.5rem', fontWeight: 600 }}>No API key — go to Settings</p>}

          <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

          {deb.handoverNotes && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <FullScreenButton label="Shift Handover Notes" value={deb.handoverNotes || ''} onChange={e => update({ handoverNotes: e.target.value })} />
              <ShareButton title="Shift Handover Notes" getText={() => deb.handoverNotes || ''} />
              <button onClick={copy} style={{ padding: '0.2rem 0.5rem', border: 'none', borderRadius: '0.25rem', backgroundColor: copied ? 'var(--success-border)' : 'var(--border)', color: copied ? 'var(--success-text)' : 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
          <SafetyTextarea
            value={deb.handoverNotes || ''}
            onChange={e => update({ handoverNotes: e.target.value })}
            placeholder={`What does the incoming advisor need to know?\n\nE.g. Site status, active permits, outstanding issues, crew updates, anything that needs eyes on it tonight.`}
            rows={12}
            style={{ ...TEXTAREA, fontSize: '0.8rem' }}
            apiKey={apiKey}
          />
        </SectionBlock>
      </div>

      {/* Outstanding Actions */}
      <div ref={ref1} style={{ marginBottom: '1.75rem', scrollMarginTop: '4rem' }}>
        <SectionBlock
          title="Outstanding Actions"
          hint={roundsActions.length > 0 ? `${roundsActions.length} from rounds + manual` : 'Manual adds'}
          confirmed={confirmed[1]}
          onConfirm={() => confirm(1)}
          confirmLabel="actions"
          nextRef={ref2}
        >
          {roundsActions.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginBottom: '0.4rem', fontWeight: 700 }}>— From site rounds:</div>
              {roundsActions.map(r => (
                <div key={r.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', marginBottom: '0.3rem', backgroundColor: 'var(--bg-highlight)', borderLeft: '3px solid var(--accent-strong)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', flexShrink: 0, marginTop: '0.1rem', fontWeight: 700 }}>{formatTime(r.time)}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-soft)' }}>{r.text}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAction()}
              placeholder="Add outstanding action..."
              style={INPUT_FLEX}
            />
            <button onClick={addAction} style={BTN_ADD}>Add</button>
          </div>

          {(deb.outstandingActions || []).map(action => (
            <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '0.4rem', opacity: action.done ? 0.6 : 1 }}>
              <button
                onClick={() => toggleAction(action.id)}
                style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${action.done ? 'var(--accent)' : 'var(--border-accent)'}`, backgroundColor: action.done ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                {action.done && <span style={{ color: 'var(--on-accent)', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </button>
              <span style={{ flex: 1, fontSize: '0.875rem', color: action.done ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: action.done ? 'line-through' : 'none' }}>{action.text}</span>
            </div>
          ))}
        </SectionBlock>
      </div>

      {/* Sign-off */}
      <div ref={ref2} style={{ scrollMarginTop: '4rem' }}>
        <SectionBlock
          title="End of Shift Sign-Off"
          hint="Time recorded automatically on sign-off"
          confirmed={confirmed[2]}
          onConfirm={() => confirm(2)}
          confirmLabel="sign-off"
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: '0 0 0.75rem', fontWeight: 600 }}>
            Confirms handover is complete.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              value={deb.signoffName}
              onChange={e => update({ signoffName: e.target.value })}
              placeholder="Your full name"
              style={INPUT_FLEX}
            />
            <button
              onClick={signOff}
              disabled={!deb.signoffName.trim()}
              style={{ ...BTN_ADD, opacity: deb.signoffName.trim() ? 1 : 0.4, cursor: deb.signoffName.trim() ? 'pointer' : 'not-allowed' }}
            >
              Sign Off
            </button>
          </div>
          {deb.signoffTime && (
            <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 800 }}>
              ✓ Signed off at {deb.signoffTime}{deb.signoffName && ` — ${deb.signoffName}`}
            </div>
          )}
        </SectionBlock>
      </div>
    </div>
  )
}
