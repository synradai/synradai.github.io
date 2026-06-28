import { useState } from 'react'
import { formatDate, formatTime } from '../utils/format'
import { PageShell, EMPTY_PAGE, ExpandableCard, SECTION_LABEL, ShareButton, PdfButton } from './ui'

function incidentText(inc) {
  const field = (label, value) => value ? `${label}: ${value}` : null
  const lines = [
    `INCIDENT REPORT — ${formatDate(inc.shiftDate || inc.time)} ${formatTime(inc.time)}`,
    '',
    field('Company', inc.companyName),
    field('Location / Area', inc.location),
    field('Type of Incident', inc.incidentType),
    field('Persons Involved', inc.personsInvolved),
    field('Description', inc.description && `\n${inc.description}`),
  ].filter(Boolean)
  if (inc.jsaSummary) lines.push('', '--- JSA / PERMIT SUMMARY ---', '', inc.jsaSummary)
  if (inc.formalReport) lines.push('', '--- FORMAL REPORT ---', '', inc.formalReport)
  return lines.join('\n')
}

function incidentReportPdf(inc, photos, advisor) {
  const dateLabel = `${formatDate(inc.shiftDate || inc.time)} · ${formatTime(inc.time)}`
  return {
    filename: `incident-report-${(inc.shiftDate || inc.time || '').slice(0, 10)}.pdf`,
    title: 'Incident Report',
    dateLabel,
    advisor,
    blocks: [
      { type: 'meta', rows: [
        { label: 'Company', value: inc.companyName },
        { label: 'Location / Area', value: inc.location },
        { label: 'Type of Incident', value: inc.incidentType },
        { label: 'Persons Involved', value: inc.personsInvolved },
      ] },
      { type: 'section', heading: 'Description', body: inc.description },
      { type: 'photos', heading: 'Photos', photos },
      { type: 'section', heading: 'JSA / Permit Summary', body: inc.jsaSummary },
      { type: 'photos', heading: 'JSA / Permit Documents', photos: inc.jsaPhotos },
      { type: 'section', heading: 'Formal Report', body: inc.formalReport },
    ],
  }
}

export default function IncidentsView({ incidents, onBack, advisorName = '' }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <PageShell title="Incidents" onBack={onBack}>
      {incidents.length === 0 ? (
        <p style={EMPTY_PAGE}>No incidents recorded.</p>
      ) : incidents.map(inc => {
        const photos = inc.photos || (inc.photo ? [inc.photo] : [])
        return (
          <ExpandableCard
            key={inc.id}
            expanded={expanded === inc.id}
            onToggle={() => setExpanded(expanded === inc.id ? null : inc.id)}
            accentBorder="var(--error-border)"
            header={<div style={{ color: 'var(--error-text)', fontWeight: 700, fontSize: '0.85rem' }}>{formatDate(inc.shiftDate || inc.time)} · {formatTime(inc.time)}{inc.incidentType ? ` · ${inc.incidentType}` : ''}</div>}
            sub={inc.companyName ? `${inc.companyName}${inc.location ? ` · ${inc.location}` : ''}` : inc.description}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ShareButton title="Incident Report" getText={() => incidentText(inc)} />
              <PdfButton getReport={() => incidentReportPdf(inc, photos, advisorName)} />
            </div>
            <DetailRow label="Company" value={inc.companyName} />
            <DetailRow label="Location / Area" value={inc.location} />
            <DetailRow label="Type of Incident" value={inc.incidentType} />
            <DetailRow label="Persons Involved" value={inc.personsInvolved} />
            <DetailRow label="Description" value={inc.description} />
            {photos.length > 0 && (
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.3rem' }}>Photos ({photos.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {photos.map((p, idx) => (
                    <img key={idx} src={p} alt={`Photo ${idx + 1}`} style={{ maxHeight: '10rem', borderRadius: '0.5rem', objectFit: 'contain' }} />
                  ))}
                </div>
              </div>
            )}
            {inc.jsaPhotos?.length > 0 && (
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '0.3rem' }}>JSA / Permit Documents ({inc.jsaPhotos.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {inc.jsaPhotos.map((p, idx) => (
                    <img key={idx} src={p} alt={`JSA ${idx + 1}`} style={{ maxHeight: '10rem', borderRadius: '0.5rem', objectFit: 'contain' }} />
                  ))}
                </div>
              </div>
            )}
            {inc.jsaSummary && (
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ ...SECTION_LABEL, marginBottom: '0.3rem' }}>JSA / Permit Summary</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{inc.jsaSummary}</p>
              </div>
            )}
            {inc.formalReport && (
              <>
                <div style={{ ...SECTION_LABEL, marginBottom: '0.5rem' }}>Formal Report</div>
                <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'inherit', margin: 0, lineHeight: 1.6 }}>{inc.formalReport}</pre>
              </>
            )}
          </ExpandableCard>
        )
      })}
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
