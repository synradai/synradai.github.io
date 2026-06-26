import { useState } from 'react'
import { formatDateTime } from '../utils/format'
import { PageShell, EMPTY_PAGE, ExpandableCard, SECTION_LABEL, ShareButton } from './ui'

function reportText(r) {
  const field = (label, value) => value ? `${label}: ${value}` : null
  const lines = [
    `FIELD LEADERSHIP REPORT — ${formatDateTime(r.time)}`,
    '',
    field('Location/Area', r.location),
    field('Company Assessed', r.companyAssessed),
    field('Observer\'s Company', r.yourCompany),
    field('Activity Observed', r.activity),
    field('Positive Behaviours', r.positives && `\n${r.positives}`),
    field('At-Risk Behaviours', r.atRisk && `\n${r.atRisk}`),
    field('Hazards Identified', r.hazards && `\n${r.hazards}`),
    field('Actions Taken/Required', r.actions && `\n${r.actions}`),
    field('Notes', r.notes && `\n${r.notes}`),
  ].filter(Boolean)
  if (r.formalReport) lines.push('', '--- FORMAL REPORT ---', '', r.formalReport)
  return lines.join('\n')
}

export default function FieldLeadershipView({ reports, onBack }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <PageShell title="Field Leadership Reports" onBack={onBack}>
      {reports.length === 0 ? (
        <p style={EMPTY_PAGE}>No field leadership reports yet.</p>
      ) : reports.map(r => (
        <ExpandableCard
          key={r.id}
          expanded={expanded === r.id}
          onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
          accentBorder="var(--accent)"
          header={<div style={{ color: 'var(--accent-soft)', fontWeight: 700, fontSize: '0.85rem' }}>{formatDateTime(r.time)}</div>}
          sub={<>{r.companyAssessed || 'No company recorded'}{r.activity ? ` · ${r.activity}` : ''}</>}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <ShareButton title="Field Leadership Report" getText={() => reportText(r)} />
          </div>
          <DetailRow label="Location / Area" value={r.location} />
          <DetailRow label="Company Assessed" value={r.companyAssessed} />
          <DetailRow label="Your Company" value={r.yourCompany} />
          <DetailRow label="Activity Observed" value={r.activity} />
          <DetailRow label="Positive Behaviours" value={r.positives} color="var(--success-text)" />
          <DetailRow label="At-Risk Behaviours" value={r.atRisk} color="var(--warning-text)" />
          <DetailRow label="Hazards Identified" value={r.hazards} color="var(--error-text)" />
          <DetailRow label="Actions Taken / Required" value={r.actions} />
          <DetailRow label="Additional Notes" value={r.notes} />
          {r.photos?.length > 0 && (
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.3rem' }}>Photos ({r.photos.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {r.photos.map((p, idx) => (
                  <img key={idx} src={p} alt={`Photo ${idx + 1}`} style={{ maxHeight: '10rem', borderRadius: '0.5rem', objectFit: 'contain' }} />
                ))}
              </div>
            </div>
          )}
          {r.formalReport && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ ...SECTION_LABEL, marginBottom: '0.5rem' }}>Formal Report</div>
              <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'inherit', margin: 0, lineHeight: 1.6 }}>{r.formalReport}</pre>
            </div>
          )}
        </ExpandableCard>
      ))}
    </PageShell>
  )
}

function DetailRow({ label, value, color }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: color || 'var(--text-faint)', marginBottom: '0.15rem' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}
