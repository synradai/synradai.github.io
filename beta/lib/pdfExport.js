import { exportReportPdf } from './reportPdf.js'
import { resolveForm } from './config.js'
import { recordsToPdfBody } from './exportRecords.js'
import { readInvestigation } from './investigation.js'
import { formatWhen } from './time.js'

function titleFor(record) {
  const names = { incident: 'Incident', hazard: 'Hazard', take5: 'Take 5', 'scene-check': 'Scene check' }
  return `Safe Intelligence — ${names[record.kind] || 'HSE record'}`
}

export async function exportRecordPdf(record, formsConfig, brand = {}) {
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
    const whys = record.fiveWhys.whys || []
    blocks.push({
      type: 'section',
      heading: 'Five whys',
      body: whys.map((why, index) => `${index + 1}. ${typeof why === 'string' ? why : (why?.why || '—')}`).join('\n') + `\n\nRoot cause: ${record.fiveWhys.rootCause || '—'}\nActions: ${record.fiveWhys.actions || '—'}`,
    })
  }
  if (record.investigation) {
    const item = record.investigation
    blocks.push({
      type: 'section',
      heading: 'ICAM investigation',
      body: [
        `Team: ${(item.team || []).map((member) => `${member.name || '—'} (${member.role || 'role'})`).join('; ') || '—'}`,
        `Timeline: ${(item.timeline || []).map((step) => `${step.when || ''} ${step.event || ''}`).join('\n') || '—'}`,
        `Evidence: ${(item.evidence || []).map((entry) => entry.note).filter(Boolean).join('\n') || '—'}`,
        `Absent or failed defences: ${item.defences || '—'}`,
        `Individual and team actions: ${item.individual || '—'}`,
        `Task and environment: ${item.conditions || '—'}`,
        `Organisational factors: ${item.organisational || '—'}`,
        `Root factors: ${item.root || '—'}`,
        `Contributing factors: ${item.contributing || '—'}`,
        `Sign-off: ${item.signOffName || '—'} (${item.signOffRole || '—'}) ${item.signOffOn || ''}`,
      ].join('\n\n'),
    })
    if (item.photos?.length) blocks.push({ type: 'photos', heading: 'Investigation evidence', photos: item.photos })
  }
  const photos = fields.photos || record.scenePhotos || []
  if (photos.length) blocks.push({ type: 'photos', heading: 'Photos', photos })
  return exportReportPdf({
    filename: `safe-intelligence-${record.kind}-${record.id}.pdf`,
    title: titleFor(record),
    dateLabel: formatWhen(fields.occurredAt || record.createdAt),
    advisor: fields.reporter || '',
    clientName: brand.clientName || '',
    logo: brand.logo || '',
    blocks,
  })
}

export async function exportInvestigationPdf(record, brand = {}) {
  const item = readInvestigation(record)
  return exportReportPdf({
    filename: `safe-intelligence-investigation-${record.id}.pdf`,
    title: 'ICAM investigation',
    dateLabel: formatWhen(record.fields?.occurredAt || record.createdAt),
    advisor: item.signOffRole || '',
    clientName: brand.clientName || '',
    logo: brand.logo || '',
    blocks: [
      {
        type: 'section',
        heading: 'Incident',
        body: `${record.fields?.siteArea || ''}\n${record.fields?.description || ''}`,
      },
      {
        type: 'section',
        heading: 'Team',
        body: item.team.map((member) => `${member.name} · ${member.role}`).join('\n') || 'None',
      },
      {
        type: 'section',
        heading: 'Sequence of events',
        body: item.timeline.map((step) => `${step.when} — ${step.event}`).join('\n') || 'None',
      },
      {
        type: 'section',
        heading: 'ICAM',
        body: [
          `Absent or failed defences: ${item.defences || '—'}`,
          `Individual and team actions: ${item.individual || '—'}`,
          `Task and environmental conditions: ${item.conditions || '—'}`,
          `Organisational factors: ${item.organisational || '—'}`,
          `Root factors: ${item.root || '—'}`,
          `Contributing factors: ${item.contributing || '—'}`,
        ].join('\n\n'),
      },
      {
        type: 'section',
        heading: 'Sign-off',
        body: item.signOffOn ? `${item.signOffName} (${item.signOffRole}) on ${item.signOffOn}` : 'Not signed off',
      },
      ...(item.photos.length ? [{ type: 'photos', heading: 'Evidence', photos: item.photos }] : []),
    ],
  })
}

export async function exportRangePdf(rows, from, to, brand = {}) {
  return exportReportPdf({
    filename: `safe-intelligence-${from}-to-${to}.pdf`,
    title: 'HSE records',
    dateLabel: `${from} to ${to}`,
    advisor: 'Safe Intelligence beta',
    clientName: brand.clientName || '',
    logo: brand.logo || '',
    blocks: [{
      type: 'section',
      heading: `${rows.length} record${rows.length === 1 ? '' : 's'}`,
      body: recordsToPdfBody(rows),
    }],
  })
}

export async function exportRegisterPdf(rows, brand = {}) {
  return exportReportPdf({
    filename: 'safe-intelligence-hse-register.pdf',
    title: 'HSE register',
    dateLabel: formatWhen(new Date().toISOString()),
    advisor: 'Safe Intelligence beta',
    clientName: brand.clientName || '',
    logo: brand.logo || '',
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
