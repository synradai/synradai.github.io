import { useState, useRef } from 'react'
import { generateId } from '../../utils/storage'
import { formatDateTime } from '../../utils/format'
import SectionBlock from '../SectionBlock'
import SafetyTextarea from '../SafetyTextarea'
import { PhaseHeader, TEXTAREA, INPUT_FLEX, BTN_ADD, EMPTY_TEXT } from '../ui'

export default function IncomingHandover({ shift, updateShift, apiKey }) {
  const [newAction, setNewAction] = useState('')
  const [confirmed, setConfirmed] = useState([false, false])

  const ho = shift.handover || { notes: '', openActions: [], timestamp: shift.startTime }
  const update = (u) => updateShift({ handover: { ...ho, ...u } })

  const confirm = (i) => setConfirmed(prev => { const n = [...prev]; n[i] = !n[i]; return n })

  const addAction = () => {
    if (!newAction.trim()) return
    update({ openActions: [...(ho.openActions || []), { id: generateId(), text: newAction.trim(), done: false }] })
    setNewAction('')
  }
  const toggle = (id) => update({ openActions: ho.openActions.map(a => a.id === id ? { ...a, done: !a.done } : a) })
  const remove = (id) => update({ openActions: ho.openActions.filter(a => a.id !== id) })

  const open = (ho.openActions || []).filter(a => !a.done).length
  const closed = (ho.openActions || []).filter(a => a.done).length

  const ref1 = useRef()

  return (
    <div style={{ padding: '1.5rem 1rem' }}>
      <PhaseHeader
        phase={1}
        title="Incoming Handover"
        blurb="Receive the brief from the outgoing advisor. Log anything open, in-progress, or needing follow-up before you start rounds."
        meta={ho.timestamp ? `Shift started: ${formatDateTime(ho.timestamp)}` : null}
      />

      <div style={{ marginBottom: '1.75rem' }}>
        <SectionBlock
          title="Handover Notes"
          hint="Status from the outgoing shift"
          confirmed={confirmed[0]}
          onConfirm={() => confirm(0)}
          confirmLabel="notes"
          nextRef={ref1}
        >
          <SafetyTextarea
            value={ho.notes}
            onChange={e => update({ notes: e.target.value })}
            placeholder={`What's the current site status?\n\nE.g. Hot work permit on Crusher 2 still active until 14:00. Crew 4B near miss under investigation — crew have been briefed. Ball mill isolation still in place.`}
            rows={6}
            style={TEXTAREA}
            apiKey={apiKey}
          />
        </SectionBlock>
      </div>

      <div ref={ref1} style={{ marginBottom: '1.75rem', scrollMarginTop: '4rem' }}>
        <SectionBlock
          title="Open Actions"
          hint={open > 0 ? `${open} outstanding${closed > 0 ? `, ${closed} resolved` : ''}` : closed > 0 ? `All ${closed} resolved` : 'Carried over from previous shift'}
          confirmed={confirmed[1]}
          onConfirm={() => confirm(1)}
          confirmLabel="actions"
        >
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAction()}
              placeholder="e.g. Follow up on forklift pre-start — not completed last shift"
              style={INPUT_FLEX}
            />
            <button onClick={addAction} style={BTN_ADD}>Add</button>
          </div>

          {(ho.openActions || []).length === 0 ? (
            <p style={EMPTY_TEXT}>No open actions recorded. Clear handover.</p>
          ) : (ho.openActions || []).map(action => (
            <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '0.5rem', marginBottom: '0.4rem', opacity: action.done ? 0.55 : 1 }}>
              <button
                onClick={() => toggle(action.id)}
                style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: `1.5px solid ${action.done ? 'var(--accent)' : 'var(--border-accent)'}`,
                  backgroundColor: action.done ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                {action.done && <span style={{ color: 'var(--on-accent)', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </button>
              <span style={{ flex: 1, fontSize: '0.875rem', color: action.done ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: action.done ? 'line-through' : 'none' }}>
                {action.text}
              </span>
              <button onClick={() => remove(action.id)} style={{ color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>✕</button>
            </div>
          ))}
        </SectionBlock>
      </div>
    </div>
  )
}
