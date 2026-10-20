const DATE = /^\d{4}-\d{2}-\d{2}$/

function pad(value) {
  return String(value).padStart(2, '0')
}

function wallParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(value || ''))
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
  }
}

export function addHours(value, hours) {
  const parts = wallParts(value)
  if (!parts) return ''
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) + hours * 60 * 60 * 1000)
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}`
}

export function addDays(value, days) {
  const parts = wallParts(value)
  if (!parts) return ''
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function readLodgement(record) {
  const saved = record?.lodgement && typeof record.lodgement === 'object' ? record.lodgement : {}
  const fields = record?.fields || {}
  const has = (key) => Object.prototype.hasOwnProperty.call(saved, key)
  return {
    called: has('called') ? Boolean(saved.called) : String(fields.notifiedWorkSafe || '').toLowerCase() === 'yes',
    scene: has('scene') ? Boolean(saved.scene) : String(fields.scenePreserved || '').toLowerCase() === 'yes',
    writtenRequested: Boolean(saved.writtenRequested),
    written: Boolean(saved.written),
    dangerousGoods: Boolean(saved.dangerousGoods),
    dg: Boolean(saved.dg),
    reference: has('reference') ? String(saved.reference || '') : String(fields.notifiedRef || ''),
    lodgedOn: String(saved.lodgedOn || ''),
    lodgedBy: String(saved.lodgedBy || ''),
  }
}

export function lodgementError(lodgement) {
  const reference = String(lodgement?.reference || '').trim()
  const lodgedOn = String(lodgement?.lodgedOn || '')
  const lodgedBy = String(lodgement?.lodgedBy || '').trim()
  if (!reference && !lodgedOn && !lodgedBy) return ''
  if (!reference) return 'Add the WorkSafe reference number.'
  if (!DATE.test(lodgedOn)) return 'Add the date it was lodged.'
  if (!lodgedBy) return 'Add who lodged it.'
  return ''
}

export function flagNotifiable(record) {
  const fields = { ...(record?.fields || {}), notifiable: 'Yes' }
  const severity = Math.max(Number(record?.severity) || 0, 4)
  const reasons = Array.isArray(record?.icamReasons) ? record.icamReasons.filter(Boolean) : []
  if (!reasons.includes('The notifiable check is yes.')) reasons.push('The notifiable check is yes.')
  return {
    notifiable: true,
    severity,
    path: 'escalate',
    icam: true,
    icamReasons: reasons,
    fields,
  }
}

export function notifiableChecklist(record, lodgement, today) {
  const occurred = record?.fields?.occurredAt || record?.createdAt || ''
  const occurredDay = String(occurred).slice(0, 10)
  const writtenAt = lodgement.writtenRequested ? addHours(occurred, 48) : ''
  const dgOn = lodgement.dangerousGoods ? addDays(occurred, 21) : ''
  const late = (day, done) => Boolean(day && DATE.test(String(today || '')) && !done && String(day).slice(0, 10) < today)
  const items = [
    {
      id: 'called',
      label: 'Notified WorkSafe immediately',
      deadline: 'Immediately, by the fastest means (s.38).',
      done: lodgement.called,
      overdue: late(occurredDay, lodgement.called),
    },
    {
      id: 'scene',
      label: 'Scene left as it is until an inspector directs otherwise',
      deadline: 's.39. No fixed clock.',
      done: lodgement.scene,
      overdue: false,
    },
  ]
  if (lodgement.writtenRequested) {
    items.push({
      id: 'written',
      label: 'Written notice sent',
      deadline: writtenAt ? `Within 48 hours of the incident: ${writtenAt.replace('T', ' ')}.` : 'Within 48 hours of WorkSafe asking (s.38).',
      done: lodgement.written,
      overdue: late(writtenAt, lodgement.written),
    })
  }
  if (lodgement.dangerousGoods) {
    items.push({
      id: 'dg',
      label: 'Dangerous goods report lodged',
      deadline: dgOn ? `Within 21 days: ${dgOn}.` : 'Within 21 days of the incident.',
      done: lodgement.dg,
      overdue: late(dgOn, lodgement.dg),
    })
  }
  return items
}
