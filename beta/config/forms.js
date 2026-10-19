// HSE field definitions for Safe Intelligence beta.
// Adjust this file after an HSE review — the capture screens read it directly.
// People are recorded by role, not by name.

export const FORM_KINDS = [
  {
    id: 'incident',
    label: 'Incident',
    blurb: 'Something that happened — injury, damage, or a near miss.',
  },
  {
    id: 'hazard',
    label: 'Hazard',
    blurb: 'Something that could hurt someone if it is left as it is.',
  },
  {
    id: 'take5',
    label: 'Take 5',
    blurb: 'A short check before the task: hazards, controls, fit for work.',
  },
]

const WHEN = {
  key: 'occurredAt',
  label: 'Date and time',
  type: 'datetime',
  required: true,
  help: 'Defaults to now, Western Australia time.',
}

const WHERE = {
  key: 'siteArea',
  label: 'Site / area',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  placeholder: 'e.g. ROM pad, workshop bay 2, laydown',
  hint: 'Say the area — for example ROM pad',
}

const PEOPLE = {
  key: 'peopleRoles',
  label: 'People involved (role, not name)',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  placeholder: 'e.g. excavator operator, spotter, supervisor',
  hint: 'Roles only. No names.',
  help: 'Write the job, not the person. Names stay off the record.',
}

const ACTIONS = {
  key: 'immediateActions',
  label: 'Immediate actions',
  type: 'textarea',
  voice: true,
  placeholder: 'What was done straight away to make it safe?',
  hint: 'What was done straight away? Say done when you finish.',
}

const PHOTOS = {
  key: 'photos',
  label: 'Photos',
  type: 'photos',
  help: 'Photos are re-encoded on this device, which strips camera location data.',
}

const SEVERITY = {
  key: 'severity',
  label: 'Severity',
  type: 'severity',
  required: true,
  help: '1–3 file corrective actions and can be closed out. 4–5 open a five-whys investigation.',
}

const REPORTER = {
  key: 'reporter',
  label: 'Reporter',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  placeholder: 'e.g. HSE adviser',
  hint: 'Your role, or your name if the site requires it',
}

const ENERGY = {
  key: 'energy',
  label: 'Energy / hazard type',
  type: 'select',
  required: true,
  voice: true,
  auto: true,
  hint: 'Say one: vehicle, fall, dropped object, electricity, isolation, chemical, fire, confined space, psychosocial, or other',
  options: [
    { value: 'Vehicles / mobile plant', label: 'Vehicles / mobile plant', words: ['vehicle', 'plant', 'truck', 'light vehicle'] },
    { value: 'Fall from height', label: 'Fall from height', words: ['fall', 'height', 'heights'] },
    { value: 'Falling objects', label: 'Falling objects', words: ['dropped', 'falling object', 'object'] },
    { value: 'Electricity', label: 'Electricity', words: ['electric', 'power'] },
    { value: 'Stored energy / isolation', label: 'Stored energy / isolation', words: ['isolat', 'stored', 'lock'] },
    { value: 'Hazardous substances', label: 'Hazardous substances', words: ['chemical', 'substance', 'gas', 'fume'] },
    { value: 'Fire', label: 'Fire', words: ['fire', 'hot work'] },
    { value: 'Confined space', label: 'Confined space', words: ['confined'] },
    { value: 'Psychosocial', label: 'Psychosocial', words: ['psycho', 'bully', 'fatigue', 'mental'] },
    { value: 'Other', label: 'Other', words: ['other'] },
  ],
}

export const FORMS = {
  incident: {
    id: 'incident',
    label: 'Incident',
    fields: [
      WHEN,
      WHERE,
      {
        key: 'description',
        label: 'What happened',
        type: 'textarea',
        required: true,
        voice: true,
        placeholder: 'What happened, in the order it happened.',
        hint: 'Talk through what happened. Say done when you finish.',
      },
      PEOPLE,
      ACTIONS,
      PHOTOS,
      SEVERITY,
      REPORTER,
    ],
  },
  hazard: {
    id: 'hazard',
    label: 'Hazard',
    fields: [
      WHEN,
      WHERE,
      {
        key: 'description',
        label: 'What is the hazard',
        type: 'textarea',
        required: true,
        voice: true,
        placeholder: 'What could hurt someone, and how.',
        hint: 'Describe the hazard. Say done when you finish.',
      },
      ENERGY,
      PEOPLE,
      ACTIONS,
      PHOTOS,
      SEVERITY,
      REPORTER,
    ],
  },
  take5: {
    id: 'take5',
    label: 'Take 5',
    fields: [
      WHEN,
      WHERE,
      {
        key: 'task',
        label: 'Task',
        type: 'text',
        required: true,
        voice: true,
        auto: true,
        placeholder: 'e.g. change a hydraulic hose on the excavator',
        hint: 'Say the task',
      },
      {
        key: 'hazards',
        label: 'Hazards seen',
        type: 'textarea',
        required: true,
        voice: true,
        placeholder: 'What could hurt someone on this task?',
        hint: 'List the hazards. Say done when you finish.',
      },
      {
        key: 'controls',
        label: 'Controls in place',
        type: 'textarea',
        required: true,
        voice: true,
        placeholder: 'What is stopping that from happening?',
        hint: 'Say the controls. Say done when you finish.',
      },
      {
        key: 'fitForWork',
        label: 'Fit for work',
        type: 'yesno',
        required: true,
        voice: true,
        auto: true,
        hint: 'Say yes or no',
        options: [
          { value: 'Yes', label: 'Yes', words: ['yes', 'fit', 'good'] },
          { value: 'No', label: 'No', words: ['no', 'not fit', 'unfit'] },
        ],
      },
      PEOPLE,
      ACTIONS,
      PHOTOS,
      { ...SEVERITY, help: 'How bad could this be if a control failed? 4–5 opens an investigation.' },
      REPORTER,
    ],
  },
}

export function getForm(kind) {
  const form = FORMS[kind]
  if (!form) throw new Error(`Unknown form: ${kind}`)
  return form
}

export function voiceSteps(kind) {
  return getForm(kind).fields
    .filter((field) => field.voice)
    .map((field) => ({
      key: field.key,
      label: field.label,
      auto: Boolean(field.auto),
      hint: field.hint || field.label,
    }))
}

export function matchOption(field, spoken) {
  const lc = String(spoken || '').toLowerCase()
  for (const opt of field.options || []) {
    if (opt.words?.some((word) => lc.includes(word))) return opt.value
    if (lc.includes(String(opt.label).toLowerCase())) return opt.value
  }
  return null
}

export function missingRequired(kind, values) {
  return getForm(kind).fields.filter((field) => {
    if (!field.required) return false
    if (field.type === 'severity') return !(Number(values?.[field.key]) >= 1)
    return !String(values?.[field.key] ?? '').trim()
  }).map((field) => field.label)
}

export function collectText(values) {
  if (!values) return ''
  const keys = ['description', 'task', 'hazards', 'controls', 'immediateActions', 'energy', 'peopleRoles', 'siteArea', 'fitForWork']
  return keys.map((key) => values[key] || '').filter(Boolean).join('\n')
}
