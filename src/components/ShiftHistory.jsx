import { useState } from 'react'
import { TAG_STYLES } from '../constants'
import { formatDate, formatTime } from '../utils/format'
import { PageShell, EMPTY_PAGE, ExpandableCard, ShareButton } from './ui'

function shiftText(shift) {
  const lines = [`SHIFT SUMMARY — ${formatDate(shift.date)}`, `Started ${formatTime(shift.startTime)}`]
  if (shift.handover?.notes) lines.push('', 'INCOMING HANDOVER:', shift.handover.notes)
  if (shift.rounds?.length) {
    lines.push('', `SITE ROUNDS (${shift.rounds.length}):`)
    shift.rounds.forEach(r => {
      let line = `[${formatTime(r.time)}] [${r.tag}] ${r.text}`
      if (r.tag === 'Hazard') line += r.rectification ? ` (RECTIFIED: ${r.rectification})` : ' (STATUS: open / not yet rectified)'
      if (r.tag === 'Near Miss' && r.prevention) line += ` (PREVENTION: ${r.prevention})`
      lines.push(line)
    })
  }
  if (shift.findingsReport) lines.push('', 'FINDINGS REPORT:', shift.findingsReport)
  if (shift.incidents?.length) {
    lines.push('', `INCIDENTS (${shift.incidents.length}):`)
    shift.incidents.forEach(i => lines.push(`[${formatTime(i.time)}]${i.incidentType ? ` [${i.incidentType}]` : ''} ${i.description}`))
  }
  if (shift.debrief?.handoverNotes) lines.push('', 'OUTGOING HANDOVER:', shift.debrief.handoverNotes)
  if (shift.debrief?.signoffName) lines.push('', `Signed off: ${shift.debrief.signoffName}${shift.debrief.signoffTime ? ` at ${shift.debrief.signoffTime}` : ''}`)
  return lines.join('\n')
}

export default function ShiftHistory({ history, onBack }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <PageShell title="Shift History" onBack={onBack}>
      {history.length === 0 ? (
        <p style={EMPTY_PAGE}>No shift history yet.</p>
      ) : history.map(shift => (
        <ExpandableCard
          key={shift.id}
          expanded={expanded === shift.id}
          onToggle={() => setExpanded(expanded === shift.id ? null : shift.id)}
          header={<div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{formatDate(shift.date)}</div>}
          sub={
            <>
              {formatTime(shift.startTime)} · Phase {(shift.phase || 0) + 1}/5 · {shift.rounds?.length || 0} entries
              {shift.incidents?.length > 0 && <span style={{ color: 'var(--error-text)', marginLeft: '0.5rem' }}>· {shift.incidents.length} incident{shift.incidents.length > 1 ? 's' : ''}</span>}
            </>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <ShareButton title="Shift Summary" getText={() => shiftText(shift)} />
          </div>
          <ShiftDetail shift={shift} />
        </ExpandableCard>
      ))}
    </PageShell>
  )
}

function ShiftDetail({ shift }) {
  return (
    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
      {shift.handover?.notes && (
        <Section title="Incoming Handover Notes">
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{shift.handover.notes}</p>
        </Section>
      )}

      {shift.rounds?.length > 0 && (
        <Section title={`Site Rounds (${shift.rounds.length})`}>
          {shift.rounds.map(r => {
            const s = TAG_STYLES[r.tag] || TAG_STYLES.Observation
            return (
              <div key={r.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', flexShrink: 0, fontWeight: 600 }}>
                  {formatTime(r.time)}
                </span>
                <span style={{ padding: '0 0.4rem', borderRadius: '0.25rem', backgroundColor: s.bg, color: s.text, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, lineHeight: '1.4' }}>
                  {r.tag}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', minWidth: 0 }}>
                  {r.text}
                  {r.tag === 'Hazard' && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '0.15rem', color: r.rectification ? 'var(--success-text)' : 'var(--text-faint)' }}>
                      {r.rectification ? `✓ Rectified: ${r.rectification}` : '○ Open — not yet rectified'}
                    </div>
                  )}
                  {r.tag === 'Near Miss' && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '0.15rem', color: r.prevention ? 'var(--success-text)' : 'var(--text-faint)' }}>
                      {r.prevention ? `✓ Prevention: ${r.prevention}` : '○ No prevention noted yet'}
                    </div>
                  )}
                </span>
              </div>
            )
          })}
        </Section>
      )}

      {shift.findingsReport && (
        <Section title="Findings Report">
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'inherit' }}>{shift.findingsReport}</pre>
        </Section>
      )}

      {shift.incidents?.length > 0 && (
        <Section title={`Incidents (${shift.incidents.length})`}>
          {shift.incidents.map(inc => (
            <div key={inc.id} style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', borderLeft: '3px solid var(--error-border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--error-text)', marginBottom: '0.25rem', fontWeight: 700 }}>
                {formatTime(inc.time)}{inc.incidentType ? ` · ${inc.incidentType}` : ''}{inc.companyName ? ` · ${inc.companyName}` : ''}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{inc.description}</p>
            </div>
          ))}
        </Section>
      )}

      {shift.debrief?.signoffName && (
        <Section title="Sign-off">
          <p style={{ fontSize: '0.8rem', color: 'var(--success-text)', fontWeight: 700 }}>
            ✓ {shift.debrief.signoffName}{shift.debrief.signoffTime && ` — ${shift.debrief.signoffTime}`}
          </p>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: '0.5rem' }}>{title}</div>
      {children}
    </div>
  )
}
