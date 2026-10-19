import { exportReportPdf } from '../../src/utils/pdf.js'
import { resolveForm } from './config.js'
import { formatWhen } from './time.js'

function titleFor(record) {
  const names = { incident: 'Incident', hazard: 'Hazard', take5: 'Take 5', 'scene-check': 'Scene check' }
  return `Safe Intelligence — ${names[record.kind] || 'HSE record'}`
}

export async function exportRecordPdf(record, formsConfig) {
  const fields = record.fields || {}
  let rows = []
  const form = resolveForm(record.kind, formsConfig)
  if (form) {
    rows = form.fields
      .filter((field) => field.type !== 'photos' && fields[field.key])
      .map((field) => ({ label: field.label, value: String(fields[field.key]) }))
  } else {
    rows = Object.entries(fields).filter(([, value]) => value).map(([key, value]) => ({ label: key, value: String(value) }))
  }
  const blocks = [
    { type: 'meta', rows },
    {
      type: 'section',
      heading: 'Possible breach — verify',
      body: (record.flags || []).map((flag) => `${flag.notice}: ${flag.instrument}, ${flag.pinpoint}. ${flag.label || ''}`).join('\n\n') || 'None',
    },
  ]
  if (record.correctiveActions?.length) {
    blocks.push({
      type: 'section',
      heading: 'Corrective actions',
      body: record.correctiveActions.map((action) => `${action.done ? 'Done' : 'Open'} — ${action.text} (${action.ownerRole}, ${action.due})`).join('\n'),
    })
  }
  if (record.fiveWhys) {
    blocks.push({
      type: 'section',
      heading: 'Five whys',
      body: record.fiveWhys.whys.map((why, index) => `${index + 1}. ${why || '—'}`).join('\n') + `\n\nRoot cause: ${record.fiveWhys.rootCause || '—'}\nActions: ${record.fiveWhys.actions || '—'}`,
    })
  }
  const photos = fields.photos || record.scenePhotos || []
  if (photos.length) blocks.push({ type: 'photos', heading: 'Photos', photos })
  return exportReportPdf({
    filename: `safe-intelligence-${record.kind}-${record.id}.pdf`,
    title: titleFor(record),
    dateLabel: formatWhen(fields.occurredAt || record.createdAt),
    advisor: fields.reporter || '',
    blocks,
  })
}

export async function exportRegisterPdf(rows) {
  return exportReportPdf({
    filename: 'safe-intelligence-hse-register.pdf',
    title: 'HSE register',
    dateLabel: formatWhen(new Date().toISOString()),
    advisor: 'Safe Intelligence beta',
    blocks: [{
      type: 'section',
      heading: `${rows.length} record${rows.length === 1 ? '' : 's'}`,
      body: rows.map((row) => {
        const fields = row.fields || {}
        return `${fields.occurredAt || ''} · ${row.kind} · sev ${row.severity || '—'} · ${row.status} · ${fields.siteArea || ''}\n${fields.description || fields.task || fields.note || ''}`
      }).join('\n\n') || 'No records in this filter.',
    }],
  })
}
