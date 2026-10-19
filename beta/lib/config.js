import { FORMS, TAKE5_CHECKS, getForm } from '../config/forms.js'
import { MODULES } from '../config/modules.js'

export const CONFIG_KEYS = [
  { id: 'wording', label: 'Labels and wording', blurb: 'Titles and the sentences people read.' },
  { id: 'forms', label: 'Form fields', blurb: 'Field labels, required flags, and dropdown options.' },
  { id: 'modules', label: 'Modules', blurb: 'Which modules show, their names, and their order.' },
  { id: 'inspection_templates', label: 'Inspection templates', blurb: 'Checklist templates. Failed items become actions when inspections are filed.' },
  { id: 'training_matrix', label: 'Training matrix columns', blurb: 'Courses and tickets across the top of the matrix.' },
]

const ALWAYS_LOCKED = new Set([
  'actualSeverity',
  'potentialSeverity',
  'notifiable',
  'safeToStart',
  ...TAKE5_CHECKS.map((check) => check.key),
])

export const WORDING_FIELDS = [
  { key: 'homeTitle', label: 'Home title', multiline: false, fallback: 'Safe Intelligence' },
  {
    key: 'homeLede',
    label: 'Home introduction',
    multiline: true,
    fallback: 'HSE capture is live in this beta. The other modules are clickable previews with sample data, marked Preview.',
  },
  { key: 'hseTitle', label: 'HSE screen title', multiline: false, fallback: 'Capture' },
  {
    key: 'hseIntro',
    label: 'HSE introduction',
    multiline: true,
    fallback: 'Voice or typed.',
  },
  { key: 'registerTitle', label: 'Register title', multiline: false, fallback: 'All records' },
  {
    key: 'captureHint',
    label: 'Capture hint',
    multiline: true,
    fallback: 'Talk it through, or type. Say “done” to finish the long answers. People by role, not name.',
  },
]

export const INSPECTION_TEMPLATE_DEFAULTS = [
  {
    id: 'workplace',
    name: 'Workplace walk',
    items: [
      { id: 'housekeeping', label: 'Housekeeping and access are clear' },
      { id: 'ppe', label: 'PPE matches the task and is in good condition' },
      { id: 'plant', label: 'Plant is inspected, tagged, and parked safely' },
      { id: 'emergency', label: 'Emergency equipment and exits are clear' },
    ],
  },
  {
    id: 'area-prestart',
    name: 'Area prestart',
    items: [
      { id: 'isolations', label: 'Isolations are in place and tested' },
      { id: 'permits', label: 'Permits match the work' },
      { id: 'simops', label: 'Work above, below, and nearby is known' },
    ],
  },
]

export const TRAINING_MATRIX_DEFAULTS = {
  columns: ['White card', 'Site induction', 'First aid', 'Working at heights', 'Confined space'],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function slug(value) {
  const base = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32)
  return base || 'field'
}

export function isLockedField(field) {
  return Boolean(field?.required) || ALWAYS_LOCKED.has(field?.key)
}

export function resolveWording(saved) {
  const source = saved && typeof saved === 'object' ? saved : null
  return Object.fromEntries(WORDING_FIELDS.map((field) => {
    if (source && typeof source[field.key] === 'string') return [field.key, source[field.key]]
    return [field.key, field.fallback]
  }))
}

export function wordingDraft(saved) {
  return resolveWording(saved)
}

function optionLabels(field) {
  return (field.options || []).map((option) => option.label || option.value).filter(Boolean)
}

function projectField(field) {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    section: field.section || 'Extra',
    help: field.help || '',
    options: field.type === 'select' ? optionLabels(field) : [],
    hidden: false,
    locked: isLockedField(field),
    custom: false,
  }
}

export function formsDraft(saved) {
  const draft = {}
  for (const [kind, form] of Object.entries(FORMS)) {
    const override = saved && saved[kind] && typeof saved[kind] === 'object' ? saved[kind] : null
    const patches = new Map((override?.fields || []).map((field) => [field.key, field]))
    const fields = form.fields.map((field) => {
      const patch = patches.get(field.key)
      const projected = projectField(field)
      if (!patch) return projected
      return {
        ...projected,
        label: String(patch.label || projected.label),
        required: projected.locked ? projected.required : Boolean(patch.required),
        help: typeof patch.help === 'string' ? patch.help : projected.help,
        options: projected.type === 'select' && Array.isArray(patch.options)
          ? patch.options.map((option) => String(option)).filter(Boolean)
          : projected.options,
        hidden: projected.locked ? false : Boolean(patch.hidden),
      }
    })
    const known = new Set(fields.map((field) => field.key))
    for (const patch of override?.fields || []) {
      if (!patch || known.has(patch.key) || patch.custom === false) continue
      if (!patch.key || known.has(patch.key)) continue
      const type = ['text', 'textarea', 'select'].includes(patch.type) ? patch.type : 'text'
      fields.push({
        key: String(patch.key),
        label: String(patch.label || 'Extra field'),
        type,
        required: Boolean(patch.required),
        section: 'Extra',
        help: typeof patch.help === 'string' ? patch.help : '',
        options: type === 'select' && Array.isArray(patch.options) ? patch.options.map(String).filter(Boolean) : [],
        hidden: Boolean(patch.hidden),
        locked: false,
        custom: true,
      })
    }
    draft[kind] = {
      label: String(override?.label || form.label),
      fields,
    }
  }
  return draft
}

function asOptions(labels) {
  return (labels || []).filter(Boolean).map((label) => ({
    value: String(label),
    label: String(label),
    words: [String(label).toLowerCase()],
  }))
}

export function resolveForm(kind, saved) {
  let base
  try {
    base = getForm(kind)
  } catch {
    return null
  }
  const override = saved && saved[kind]
  if (!override) return base
  const patches = Array.isArray(override.fields) ? override.fields : []
  const used = new Set()
  const fields = []
  for (const patch of patches) {
    if (!patch?.key || used.has(patch.key)) continue
    used.add(patch.key)
    const baseField = base.fields.find((field) => field.key === patch.key)
    if (baseField) {
      if (patch.hidden && !isLockedField(baseField)) continue
      const next = {
        ...baseField,
        label: patch.label || baseField.label,
        help: typeof patch.help === 'string' ? patch.help : baseField.help,
      }
      if (!isLockedField(baseField) && typeof patch.required === 'boolean') next.required = patch.required
      if (baseField.type === 'select' && Array.isArray(patch.options) && patch.options.length) {
        next.options = asOptions(patch.options)
      }
      fields.push(next)
      continue
    }
    if (patch.hidden) continue
    const type = ['text', 'textarea', 'select'].includes(patch.type) ? patch.type : 'text'
    fields.push({
      key: String(patch.key),
      label: String(patch.label || 'Extra field'),
      type,
      required: Boolean(patch.required),
      section: 'Extra',
      help: typeof patch.help === 'string' ? patch.help : '',
      voice: type !== 'select',
      options: type === 'select' ? asOptions(patch.options) : undefined,
    })
  }
  for (const field of base.fields) {
    if (isLockedField(field) && !used.has(field.key)) fields.push(field)
  }
  return {
    ...base,
    label: override.label || base.label,
    fields: fields.length ? fields : base.fields,
  }
}

export function moduleRows(saved) {
  const patches = new Map((Array.isArray(saved) ? saved : []).filter((item) => item?.id).map((item) => [item.id, item]))
  return MODULES.map((mod, index) => {
    const patch = patches.get(mod.id)
    const locked = Boolean(mod.locked)
    return {
      id: mod.id,
      label: String(patch?.label || mod.label),
      question: mod.question,
      group: mod.group,
      href: mod.href,
      locked,
      adminEnabled: locked ? true : patch ? patch.enabled !== false : true,
      order: patch && Number.isFinite(Number(patch.order)) ? Number(patch.order) : index,
    }
  }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function visibleModules(rows, localPrefs = {}) {
  return (rows || []).filter((mod) => mod.locked || (mod.adminEnabled && localPrefs[mod.id] !== false))
}

export function modulesDraft(saved) {
  return moduleRows(saved).map((mod) => ({
    id: mod.id,
    label: mod.label,
    enabled: mod.adminEnabled,
    order: mod.order,
    locked: mod.locked,
  }))
}

export function resolveTemplates(saved) {
  if (!Array.isArray(saved)) return clone(INSPECTION_TEMPLATE_DEFAULTS)
  return saved.map((template, index) => {
    if (!template || typeof template !== 'object') return null
    const name = String(template.name || '').trim()
    if (!name) return null
    const items = (Array.isArray(template.items) ? template.items : []).map((item, itemIndex) => {
      const label = String(item?.label || '').trim()
      if (!label) return null
      return { id: String(item.id || `item_${index}_${itemIndex}`), label }
    }).filter(Boolean)
    return { id: String(template.id || `template_${index}`), name, items }
  }).filter(Boolean)
}

export function templatesDraft(saved) {
  return resolveTemplates(saved)
}

export function resolveMatrix(saved) {
  if (!saved || !Array.isArray(saved.columns)) return clone(TRAINING_MATRIX_DEFAULTS)
  return { columns: saved.columns.map((column) => String(column || '').trim()).filter(Boolean) }
}

export function matrixDraft(saved) {
  return resolveMatrix(saved)
}

export function initialDraft(key, stored) {
  if (key === 'wording') return wordingDraft(stored)
  if (key === 'forms') return formsDraft(stored)
  if (key === 'modules') return modulesDraft(stored)
  if (key === 'inspection_templates') return templatesDraft(stored)
  if (key === 'training_matrix') return matrixDraft(stored)
  return {}
}

export function prepareConfig(key, draft) {
  if (key === 'wording') {
    const next = {}
    for (const field of WORDING_FIELDS) {
      next[field.key] = String(draft?.[field.key] ?? '')
    }
    return next
  }
  if (key === 'forms') {
    const next = formsDraft(draft)
    for (const form of Object.values(next)) {
      if (!String(form.label || '').trim()) throw new Error('Each form needs a name.')
      for (const field of form.fields) {
        if (!String(field.label || '').trim()) throw new Error('Each field needs a label.')
        if (field.type === 'select' && !field.hidden && field.options.filter(Boolean).length === 0) {
          throw new Error(`${field.label} needs at least one option.`)
        }
      }
    }
    return next
  }
  if (key === 'modules') {
    const rows = Array.isArray(draft) ? draft : []
    if (!rows.some((row) => row.id === 'hse')) throw new Error('HSE stays on.')
    return rows.map((row, index) => ({
      id: row.id,
      label: String(row.label || '').trim() || row.id,
      enabled: row.id === 'hse' ? true : row.enabled !== false,
      order: index,
    }))
  }
  if (key === 'inspection_templates') {
    const templates = Array.isArray(draft) ? draft : []
    return templates.map((template, index) => {
      const name = String(template?.name || '').trim()
      if (!name) throw new Error('Each inspection template needs a name.')
      const items = (template.items || []).map((item, itemIndex) => {
        const label = String(item?.label || '').trim()
        if (!label) return null
        return { id: String(item.id || `item_${index}_${itemIndex}`), label }
      }).filter(Boolean)
      if (!items.length) throw new Error(`${name} needs at least one check.`)
      return { id: String(template.id || `template_${index}`), name, items }
    })
  }
  if (key === 'training_matrix') {
    const columns = (draft?.columns || []).map((column) => String(column || '').trim()).filter(Boolean)
    if (!columns.length) throw new Error('Add at least one training column.')
    return { columns }
  }
  throw new Error('Unknown setting.')
}

export function addCustomField(form, label, type) {
  const next = clone(form)
  const keyBase = `x_${slug(label)}`
  const taken = new Set(next.fields.map((field) => field.key))
  let key = keyBase
  let n = 2
  while (taken.has(key)) {
    key = `${keyBase}_${n}`
    n += 1
  }
  next.fields.push({
    key,
    label: String(label || 'Extra field').trim() || 'Extra field',
    type: ['text', 'textarea', 'select'].includes(type) ? type : 'text',
    required: false,
    section: 'Extra',
    help: '',
    options: type === 'select' ? ['Option 1'] : [],
    hidden: false,
    locked: false,
    custom: true,
  })
  return next
}
