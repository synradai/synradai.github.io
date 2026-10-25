import { perthDate } from './time.js'

export const QUESTION_TYPES = ['ynna', 'text', 'number', 'photo', 'signature', 'dropdown']
export const HOUR_LIMIT = 20
export const PERSON_KEY = 'si-beta-qr-person'
const CODES_KEY = 'si-beta-qr-codes'
const SUBS_KEY = 'si-beta-qr-submissions'
const ACTIONS_KEY = 'si-beta-qr-actions'
const SUPERVISORS_KEY = 'si-beta-qr-supervisors'

const ynna = (id, label) => ({ id, type: 'ynna', label, required: true, critical: true, help: '', options: [] })
const text = (id, label, required, help = '') => ({ id, type: 'text', label, required, critical: false, help, options: [] })

export const DEFAULT_QR_FORMS = [
  {
    id: 'take5',
    title: 'Take 5',
    questions: [
      text('task', 'What is the task?', true),
      ynna('stopped', 'I stopped and thought about this task'),
      ynna('ppe', 'I have the right equipment and PPE'),
      ynna('hazards', 'Hazards are controlled'),
      ynna('emergency', 'I know the emergency response'),
      ynna('safe', 'It is safe to start'),
      text('notes', 'Notes', false),
      { id: 'photo', type: 'photo', label: 'Photo', required: false, critical: false, help: '', options: [] },
      { id: 'sign', type: 'signature', label: 'Signature', required: true, critical: false, help: '', options: [] },
    ],
  },
  {
    id: 'jha',
    title: 'JHA',
    questions: [
      text('job', 'Job or task', true),
      text('steps', 'Steps and hazards', true),
      ynna('controls', 'Controls are in place'),
      ynna('briefed', 'People are briefed'),
      ynna('permits', 'Permits are in place if this work needs them'),
      ynna('residual', 'Residual risk is acceptable'),
      { id: 'sign', type: 'signature', label: 'Signature', required: true, critical: false, help: '', options: [] },
    ],
  },
  {
    id: 'prestart',
    title: 'Vehicle and plant prestart',
    questions: [
      text('asset', 'Vehicle or plant', true),
      {
        id: 'km',
        type: 'number',
        label: 'Odometer (km)',
        required: false,
        critical: false,
        help: 'Enter kilometres, engine hours, or both.',
        options: [],
      },
      { id: 'hours', type: 'number', label: 'Engine hours', required: false, critical: false, help: '', options: [] },
      ynna('fluids', 'Fluids and leaks are ok'),
      ynna('tyres', 'Tyres or tracks are ok'),
      ynna('lights', 'Lights and warnings are ok'),
      ynna('guards', 'Guards are in place'),
      ynna('brakes', 'Brakes are ok'),
      text('defects', 'Defect notes', false),
      { id: 'defect-photo', type: 'photo', label: 'Defect photo', required: false, critical: false, help: '', options: [] },
      { id: 'sign', type: 'signature', label: 'Signature', required: true, critical: false, help: '', options: [] },
    ],
  },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function slug(value) {
  const base = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
  return base || 'question'
}

function optionList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

export function prepareQrForms(draft) {
  const forms = Array.isArray(draft) ? draft : []
  if (!forms.length) throw new Error('Add at least one form.')
  const seen = new Set()
  return forms.map((form, index) => {
    const title = String(form?.title || '').trim()
    if (!title) throw new Error('Each form needs a name.')
    let id = String(form?.id || slug(title) || `form-${index + 1}`)
    if (seen.has(id)) id = `${id}-${index + 1}`
    seen.add(id)
    const questions = (form?.questions || []).map((question, questionIndex) => {
      const label = String(question?.label || '').trim()
      if (!label) throw new Error(`${title} has a question with no label.`)
      const type = QUESTION_TYPES.includes(question?.type) ? question.type : 'text'
      const options = optionList(question?.options)
      if (type === 'dropdown' && !options.length) throw new Error(`${label} needs at least one option.`)
      return {
        id: String(question?.id || `${slug(label)}-${questionIndex + 1}`),
        type,
        label,
        required: Boolean(question?.required),
        critical: type === 'ynna' && Boolean(question?.critical),
        help: String(question?.help || '').trim(),
        options: type === 'dropdown' ? options : [],
      }
    })
    if (!questions.length) throw new Error(`${title} needs at least one question.`)
    return { id, title, questions }
  })
}

export function qrFormsDraft(stored) {
  const source = Array.isArray(stored) && stored.length ? stored : DEFAULT_QR_FORMS
  try {
    return prepareQrForms(source).map((form) => ({
      ...form,
      questions: form.questions.map((question) => ({
        ...question,
        options: question.options.join(', '),
      })),
    }))
  } catch {
    return clone(DEFAULT_QR_FORMS).map((form) => ({
      ...form,
      questions: form.questions.map((question) => ({
        ...question,
        options: '',
      })),
    }))
  }
}

export function resolveQrForms(stored) {
  if (!Array.isArray(stored) || !stored.length) return clone(DEFAULT_QR_FORMS)
  try {
    return prepareQrForms(stored)
  } catch {
    return clone(DEFAULT_QR_FORMS)
  }
}

export function answerValue(answers, id) {
  const raw = answers?.[id]
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value
  return raw
}

export function assessSubmission(form, answers, personName) {
  const errors = []
  if (!String(personName || '').trim()) errors.push('Add your name.')
  const failed = []
  for (const question of form?.questions || []) {
    const value = answerValue(answers, question.id)
    const empty = value == null || value === ''
    if (question.type === 'ynna') {
      const picked = value === 'yes' || value === 'no' || value === 'na'
      if (question.required && !picked) errors.push(`${question.label} needs an answer.`)
      if (question.critical && value === 'no') failed.push({ id: question.id, label: question.label })
    } else if (question.type === 'dropdown') {
      const options = question.options || []
      if (!empty && !options.includes(value)) errors.push(`${question.label} is not one of the options.`)
      if (question.required && (empty || !options.includes(value))) errors.push(`${question.label} needs an answer.`)
    } else if (question.type === 'number') {
      if (!empty && Number.isNaN(Number(value))) errors.push(`${question.label} needs a number.`)
      if (question.required && empty) errors.push(`${question.label} needs an answer.`)
    } else if (question.required && empty) {
      errors.push(`${question.label} needs an answer.`)
    }
  }
  return { errors, failed, stopped: failed.length > 0 }
}

export function tooManySubmissions(rows, qrId, now = Date.now()) {
  const hour = 60 * 60 * 1000
  const count = (rows || []).filter((row) => row.qrId === qrId && now - new Date(row.createdAt).getTime() < hour).length
  return count >= HOUR_LIMIT
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function formUrl(token) {
  const hash = `#/f/${encodeURIComponent(token)}`
  if (typeof window === 'undefined') return `https://synradai.github.io/beta/${hash}`
  const base = import.meta.env?.BASE_URL || '/beta/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${prefix}${hash}`
}

export function buildStopAction({
  submissionId,
  formTitle,
  label,
  personName,
  failed,
  supervisorId = '',
  supervisorName = '',
  siteId = '',
  ruleset = 'general',
}) {
  const now = new Date().toISOString()
  return {
    id: `stop-${submissionId}`,
    kind: 'action',
    source: 'qr',
    createdAt: now,
    updatedAt: now,
    ruleset: ruleset || 'general',
    severity: null,
    path: null,
    status: 'open',
    siteId: siteId || '',
    fields: {
      title: `Stop the job — ${formTitle} — ${label || 'site'}`,
      owner: supervisorName || 'Site supervisor',
      ownerId: supervisorId || '',
      due: perthDate(),
      note: `${personName} stopped on: ${(failed || []).map((item) => item.label).join('; ')}`,
      occurredAt: now.slice(0, 16),
      emailHook: 'pending',
    },
    links: [{ id: submissionId, kind: 'form_submission' }],
    flags: [],
    correctiveActions: [],
    closeOut: null,
    fiveWhys: null,
    icam: false,
    icamReasons: [],
  }
}

export function snapshotAnswers(form, answers) {
  const snapshot = {}
  for (const question of form?.questions || []) {
    snapshot[question.id] = {
      id: question.id,
      label: question.label,
      type: question.type,
      value: answerValue(answers, question.id) ?? '',
    }
  }
  return snapshot
}

export function displayAnswer(entry) {
  const value = entry?.value
  if (entry?.type === 'ynna') {
    if (value === 'yes') return 'Yes'
    if (value === 'no') return 'No'
    if (value === 'na') return 'N/A'
    return ''
  }
  if (entry?.type === 'photo' || entry?.type === 'signature') return value ? 'Attached' : ''
  if (value == null) return ''
  return String(value)
}

function browserStore() {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

function readList(key) {
  const store = browserStore()
  if (!store) return []
  try {
    const value = JSON.parse(store.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeList(key, rows) {
  const store = browserStore()
  if (!store) return
  store.setItem(key, JSON.stringify(rows))
}

export function loadLocalCodes() {
  return readList(CODES_KEY)
}

export function saveLocalCodes(rows) {
  writeList(CODES_KEY, rows)
}

export function loadLocalSubmissions() {
  return readList(SUBS_KEY)
}

export function saveLocalSubmissions(rows) {
  writeList(SUBS_KEY, rows.slice(0, 200))
}

export function loadLocalActions() {
  return readList(ACTIONS_KEY)
}

export function saveLocalAction(row) {
  const rows = readList(ACTIONS_KEY)
  if (!rows.some((item) => item.id === row.id)) rows.unshift(row)
  writeList(ACTIONS_KEY, rows.slice(0, 200))
}

export function loadPerson() {
  const store = browserStore()
  if (!store) return { name: '', company: '', role: '' }
  try {
    const value = JSON.parse(store.getItem(PERSON_KEY) || '{}')
    return {
      name: String(value?.name || ''),
      company: String(value?.company || ''),
      role: String(value?.role || ''),
    }
  } catch {
    return { name: '', company: '', role: '' }
  }
}

export function savePerson(person) {
  const store = browserStore()
  if (!store) return
  store.setItem(PERSON_KEY, JSON.stringify({
    name: String(person?.name || '').trim(),
    company: String(person?.company || '').trim(),
    role: String(person?.role || '').trim(),
  }))
}

export function rememberSupervisor(siteId, name, supervisorId = '') {
  const store = browserStore()
  if (!store || !siteId) return
  const current = readObject(SUPERVISORS_KEY)
  current[siteId] = { name: String(name || '').trim(), id: String(supervisorId || '') }
  store.setItem(SUPERVISORS_KEY, JSON.stringify(current))
}

export function supervisorFor(siteId) {
  const row = readObject(SUPERVISORS_KEY)[siteId] || {}
  return { name: String(row.name || ''), id: String(row.id || '') }
}

function readObject(key) {
  const store = browserStore()
  if (!store) return {}
  try {
    const value = JSON.parse(store.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

export function notifyLocalQr() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('si-qr-local'))
}

export function submissionsCsv(rows) {
  const header = ['when', 'form', 'version', 'person', 'company', 'role', 'area', 'stopped', 'failed', 'action']
  const lines = [header.join(',')]
  for (const row of rows || []) {
    const failed = (row.failed || []).map((item) => item.label || item.id).join('; ')
    const cells = [
      row.createdAt || '',
      row.formTitle || '',
      row.formVersion ?? '',
      row.personName || '',
      row.company || '',
      row.role || '',
      row.areaLabel || '',
      row.stopped ? 'yes' : 'no',
      failed,
      row.actionId || '',
    ]
    lines.push(cells.map(csvCell).join(','))
  }
  return lines.join('\n')
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function mapQrCode(row) {
  return {
    id: row.id,
    token: row.token,
    siteId: row.site_id,
    targetType: row.target_type,
    targetId: row.target_id,
    label: row.label || '',
    active: row.active !== false,
    createdAt: row.created_at,
  }
}

export function mapSubmission(row) {
  return {
    id: row.id,
    siteId: row.site_id,
    qrId: row.qr_id,
    formId: row.form_id,
    formVersion: row.form_version || 0,
    formTitle: row.form_title || '',
    areaLabel: row.area_label || '',
    personName: row.person_name || '',
    company: row.company || '',
    role: row.role || '',
    answers: row.answers || {},
    failed: Array.isArray(row.failed) ? row.failed : [],
    stopped: Boolean(row.stopped),
    actionId: row.action_id || '',
    createdAt: row.created_at,
  }
}

export function shrinkDataUrl(dataUrl, maxChars = 380000) {
  if (!dataUrl || typeof document === 'undefined' || dataUrl.length <= maxChars) {
    return Promise.resolve(dataUrl || '')
  }
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1200 / (image.width || 1))
      canvas.width = Math.max(1, Math.round((image.width || 1) * scale))
      canvas.height = Math.max(1, Math.round((image.height || 1) * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      let quality = 0.72
      let out = canvas.toDataURL('image/jpeg', quality)
      while (out.length > maxChars && quality > 0.4) {
        quality -= 0.1
        out = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(out)
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}
