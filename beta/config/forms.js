// HSE field definitions. The capture screens read this file.
// Minimum fields are required. Nice-to-have fields are optional.
// People involved are recorded by role and employer, not by an injured person's name.

export const FORM_KINDS = [
  { id: 'incident', label: 'Incident', blurb: 'Injury, illness, near miss, damage, or a dangerous occurrence.' },
  { id: 'hazard', label: 'Hazard', blurb: 'Something that could hurt someone if it is left as it is.' },
  { id: 'take5', label: 'Take 5', blurb: 'A personal check at the workface. Any No stops the job.' },
]

const YESNO = [
  { value: 'Yes', label: 'Yes', words: ['yes'] },
  { value: 'No', label: 'No', words: ['no'] },
]

function yesno(key, label, extra = {}) {
  return { key, label, type: 'yesno', options: YESNO, ...extra }
}

const WHEN = {
  key: 'occurredAt',
  label: 'Date and time',
  type: 'datetime',
  required: true,
  section: 'When and where',
  help: 'Defaults to now, Western Australia time.',
}

const WHERE = {
  key: 'siteArea',
  label: 'Site',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  section: 'When and where',
  placeholder: 'e.g. workshop, ROM pad, refinery',
  hint: 'Say the site',
}

const LOCATION = {
  key: 'location',
  label: 'Exact location',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  section: 'When and where',
  placeholder: 'e.g. bay 2, north laydown, scaffold on tank 3',
  hint: 'Say the exact spot',
}

const REPORTER = {
  key: 'reporter',
  label: 'Reporter',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  section: 'People',
  placeholder: 'e.g. HSE adviser',
  hint: 'Your role, or your name if the site requires it',
}

const PEOPLE = {
  key: 'peopleRoles',
  label: 'People involved — role and employer / PCBU',
  type: 'text',
  required: true,
  voice: true,
  auto: true,
  section: 'People',
  placeholder: 'e.g. fitter, contractor PCBU; supervisor, site PCBU',
  hint: 'Role and employer. No injured names.',
  help: 'Roles go out in client updates. Never put an injured person’s name in a client update.',
}

export const TAKE5_CHECKS = [
  { key: 'knowJob', label: 'Know the job and have the procedure, JHA, or SWMS?' },
  { key: 'trained', label: 'Trained and ticketed for this task?' },
  { key: 'permits', label: 'Permits in place (heights, confined space, hot work, isolation)?' },
  { key: 'isolated', label: 'Isolated, locked, and tested for zero energy?' },
  { key: 'ppe', label: 'Right PPE, and in good condition?' },
  { key: 'plantTagged', label: 'Plant inspected and tagged?' },
  { key: 'falls', label: 'Falls and dropped objects controlled?' },
  { key: 'simops', label: 'Anyone above, below, or nearby (SIMOPS) accounted for?' },
  { key: 'rescue', label: 'Know the emergency and rescue plan?' },
  { key: 'conditions', label: 'Weather, heat, and fatigue OK?' },
]

export function take5Blocked(values = {}) {
  return TAKE5_CHECKS.filter((check) => values[check.key] === 'No').map((check) => check.label)
}

const HAZARD_CATEGORIES = [
  ['Falls', ['fall', 'falls', 'height']],
  ['Falling objects', ['dropped', 'falling object']],
  ['Lifting', ['lift', 'crane', 'rigging']],
  ['Isolation / energy', ['isolat', 'lockout', 'energy']],
  ['Confined space', ['confined']],
  ['Electrical', ['electric', 'power']],
  ['Chemicals', ['chemical', 'substance']],
  ['Mobile plant', ['plant', 'vehicle', 'truck']],
  ['Manual tasks', ['manual', 'lifting a load']],
  ['Noise', ['noise', 'hearing']],
  ['Heat', ['heat', 'hot']],
  ['Housekeeping', ['housekeeping', 'slip']],
  ['Psychosocial', ['psycho', 'bully', 'fatigue']],
  ['Other', ['other']],
].map(([label, words]) => ({ value: label, label, words }))

const INCIDENT_TYPES = [
  'Injury / illness', 'Near miss', 'Property / plant damage', 'Environmental', 'Dangerous occurrence',
].map((label) => ({ value: label, label, words: [label.toLowerCase()] }))

const TREATMENT = [
  { value: 'None', label: 'None' },
  { value: 'FA', label: 'First aid' },
  { value: 'Medical', label: 'Medical treatment' },
  { value: 'Restricted', label: 'Restricted duties' },
  { value: 'LTI', label: 'Lost time' },
  { value: 'Hospital', label: 'Hospital' },
]

const ACTUAL = {
  key: 'actualSeverity',
  label: 'Actual severity',
  type: 'severity',
  required: true,
  section: 'Severity',
  help: 'What did happen. The higher of actual and potential drives the workflow.',
}

const POTENTIAL = {
  key: 'potentialSeverity',
  label: 'Potential severity',
  type: 'severity',
  required: true,
  section: 'Severity',
  help: 'What could have happened. If this is 4 or 5, the record escalates even when the actual outcome was small.',
}

const NOTIFIABLE = yesno('notifiable', 'Notifiable to WorkSafe? (s.35–s.37)', {
  required: true,
  section: 'WorkSafe',
  help: 'Runs on every report. Yes forces severity 4 or above and opens the WorkSafe flow. This app does not notify WorkSafe.',
})

export const FORMS = {
  incident: {
    id: 'incident',
    label: 'Incident',
    fields: [
      WHEN,
      WHERE,
      LOCATION,
      REPORTER,
      PEOPLE,
      {
        key: 'incidentType',
        label: 'Incident type',
        type: 'select',
        required: true,
        section: 'What happened',
        options: INCIDENT_TYPES,
      },
      {
        key: 'description',
        label: 'What happened',
        type: 'textarea',
        required: true,
        voice: true,
        section: 'What happened',
        placeholder: 'What happened, in the order it happened.',
        hint: 'Talk through what happened. Say done when you finish.',
      },
      {
        key: 'bodyPart',
        label: 'Body part',
        type: 'text',
        required: true,
        section: 'Injury',
        placeholder: 'e.g. right hand, lower back, none',
      },
      {
        key: 'injuryNature',
        label: 'Nature of injury',
        type: 'text',
        required: true,
        section: 'Injury',
        placeholder: 'e.g. laceration, strain, no injury',
      },
      {
        key: 'treatment',
        label: 'Treatment level',
        type: 'select',
        required: true,
        section: 'Injury',
        options: TREATMENT,
      },
      {
        key: 'immediateActions',
        label: 'Immediate actions',
        type: 'textarea',
        required: true,
        voice: true,
        section: 'Response',
        placeholder: 'What was done straight away to make it safe?',
        hint: 'What was done straight away? Say done when you finish.',
      },
      yesno('scenePreserved', 'Scene preserved?', { required: true, section: 'Response', help: 's.39. Leave a notifiable scene as it is until an inspector directs otherwise.' }),
      yesno('supervisorNotified', 'Supervisor notified?', { required: true, section: 'Response' }),
      {
        key: 'supervisorNotifiedAt',
        label: 'Supervisor notified at',
        type: 'text',
        section: 'Response',
        placeholder: 'Time, if yes',
        requiredWhen: { key: 'supervisorNotified', value: 'Yes' },
      },
      ACTUAL,
      POTENTIAL,
      NOTIFIABLE,
      yesno('notifiedWorkSafe', 'WorkSafe already notified?', {
        section: 'WorkSafe',
        requiredWhen: { key: 'notifiable', value: 'Yes' },
      }),
      {
        key: 'notifiedAt',
        label: 'Notified at',
        type: 'text',
        section: 'WorkSafe',
        requiredWhen: { key: 'notifiedWorkSafe', value: 'Yes' },
      },
      {
        key: 'notifiedMethod',
        label: 'How WorkSafe was notified',
        type: 'text',
        section: 'WorkSafe',
        placeholder: 'Phone or online',
        requiredWhen: { key: 'notifiedWorkSafe', value: 'Yes' },
      },
      {
        key: 'notifiedRef',
        label: 'WorkSafe reference',
        type: 'text',
        section: 'WorkSafe',
        placeholder: 'Reference number, if you have one',
      },
      { key: 'photos', label: 'Photos or video stills', type: 'photos', section: 'Extra', help: 'Optional. Photos are re-encoded on this device, which strips camera location data.' },
      { key: 'witnesses', label: 'Witnesses and statements', type: 'textarea', section: 'Extra', help: 'Roles, not injured names.' },
      { key: 'plantId', label: 'Plant ID', type: 'text', section: 'Extra' },
      { key: 'permitRef', label: 'Task and permit / JHA / SWMS ref', type: 'text', section: 'Extra' },
      { key: 'weather', label: 'Weather and lighting', type: 'text', section: 'Extra' },
      { key: 'hoursIntoShift', label: 'Hours into the shift', type: 'text', section: 'Extra' },
      { key: 'criticalControl', label: 'Critical control involved', type: 'text', section: 'Extra', placeholder: 'Isolation, fall arrest, lifting, confined space, energised electrical' },
      yesno('criticalControlFailed', 'Did that critical control fail?', { section: 'Extra' }),
      { key: 'linkedHazards', label: 'Linked hazards', type: 'text', section: 'Extra' },
      { key: 'gps', label: 'GPS', type: 'text', section: 'Extra' },
      yesno('clientNotified', 'Client notified?', { section: 'Extra' }),
      { key: 'rtwLink', label: 'Return to work link', type: 'text', section: 'Extra' },
      yesno('retainFiveYears', 'Keep this record for 5 years? (s.38(7))', { section: 'Extra' }),
      yesno('repeatEvent', 'Has this event type happened in the last 12 months?', { section: 'ICAM triggers' }),
      yesno('multiplePcbu', 'More than one PCBU involved?', { section: 'ICAM triggers' }),
      yesno('clientRequiresIcam', 'Client requires ICAM?', { section: 'ICAM triggers' }),
    ],
  },
  hazard: {
    id: 'hazard',
    label: 'Hazard',
    fields: [
      WHEN,
      { ...WHERE, label: 'Location' },
      { ...REPORTER, help: 'Anonymous is allowed. Leave a role if you do not want a name on the record.' },
      {
        key: 'description',
        label: 'What is the hazard',
        type: 'textarea',
        required: true,
        voice: true,
        section: 'Hazard',
        placeholder: 'What could hurt someone, and how.',
        hint: 'Describe the hazard. Say done when you finish.',
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        section: 'Hazard',
        options: HAZARD_CATEGORIES,
      },
      {
        key: 'likelihood',
        label: 'Likelihood (1–5)',
        type: 'select',
        required: true,
        section: 'Risk',
        help: 'Risk rating is likelihood times consequence.',
        options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
      },
      { ...POTENTIAL, label: 'Consequence / potential severity', section: 'Risk' },
      { ...ACTUAL, required: false, section: 'Risk', help: 'Use 1 if nothing has happened yet. The higher of actual and potential still drives the workflow.' },
      yesno('immediateControl', 'Immediate control in place?', { required: true, section: 'Control' }),
      {
        key: 'controlDetail',
        label: 'What is the control',
        type: 'textarea',
        section: 'Control',
        requiredWhen: { key: 'immediateControl', value: 'Yes' },
      },
      yesno('areaSafe', 'Area made safe?', { required: true, section: 'Control' }),
      { key: 'owner', label: 'Owner (role)', type: 'text', required: true, section: 'Control', placeholder: 'e.g. supervisor' },
      { key: 'due', label: 'Due date', type: 'date', required: true, section: 'Control' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        section: 'Control',
        options: ['Open', 'Controlled', 'Closed'].map((label) => ({ value: label, label })),
      },
      { key: 'photos', label: 'Photo', type: 'photos', section: 'Extra' },
      { key: 'suggestedFix', label: 'Suggested fix', type: 'textarea', section: 'Extra' },
      {
        key: 'hierarchy',
        label: 'Hierarchy level of the fix (r.36)',
        type: 'select',
        section: 'Extra',
        options: ['Elimination', 'Substitution', 'Isolation', 'Engineering', 'Administrative', 'PPE'].map((label) => ({ value: label, label })),
      },
      { key: 'incidentLink', label: 'Linked incident', type: 'text', section: 'Extra' },
      { key: 'verification', label: 'Verification photo note and sign-off', type: 'text', section: 'Extra' },
      yesno('criticalControlFailed', 'Critical control failed?', { section: 'ICAM triggers' }),
      yesno('repeatEvent', 'Same hazard type in the last 12 months?', { section: 'ICAM triggers' }),
      yesno('multiplePcbu', 'More than one PCBU involved?', { section: 'ICAM triggers' }),
      yesno('clientRequiresIcam', 'Client requires ICAM?', { section: 'ICAM triggers' }),
      NOTIFIABLE,
    ],
  },
  take5: {
    id: 'take5',
    label: 'Take 5',
    fields: [
      {
        key: 'checker',
        label: 'Name or role',
        type: 'text',
        required: true,
        voice: true,
        auto: true,
        section: 'Job',
        placeholder: 'Who is doing this check',
        hint: 'Say your name or role',
      },
      WHEN,
      {
        key: 'task',
        label: 'Task',
        type: 'text',
        required: true,
        voice: true,
        auto: true,
        section: 'Job',
        placeholder: 'e.g. change a hydraulic hose',
        hint: 'Say the task',
      },
      { ...LOCATION, section: 'Job' },
      { ...WHERE, required: false, section: 'Job' },
      {
        key: 'peopleRoles',
        label: 'Crew / supervisor (roles)',
        type: 'text',
        required: true,
        voice: true,
        section: 'Job',
        placeholder: 'e.g. fitter, supervisor',
        hint: 'Roles of the crew and the supervisor',
      },
      {
        key: 'fiveSteps',
        label: 'Five steps',
        type: 'note',
        section: 'Checks',
        help: 'Stop and think. Look for hazards. Assess the risk. Make the changes. Do the job safely. This is a workface check, not the JHA or SWMS.',
      },
      ...TAKE5_CHECKS.map((check) => yesno(check.key, check.label, { required: true, section: 'Checks' })),
      {
        key: 'hazards',
        label: 'Hazards and the control for each',
        type: 'textarea',
        required: true,
        voice: true,
        section: 'Decision',
        placeholder: 'Hazard — control. One line each.',
        hint: 'List each hazard and its control. Say done when you finish.',
      },
      yesno('safeToStart', 'Safe to start?', {
        required: true,
        section: 'Decision',
        help: 'Any No above means No here. Stop and tell the supervisor.',
      }),
      { key: 'signOff', label: 'Sign-off', type: 'text', required: true, section: 'Decision', placeholder: 'Name or role, and the time' },
      { key: 'photos', label: 'Workface photo', type: 'photos', section: 'Extra' },
      yesno('supervisorReview', 'Supervisor reviewed?', { section: 'Extra' }),
      {
        key: 'redoNote',
        label: 'Redo if the task or conditions change',
        type: 'note',
        section: 'Extra',
        help: 'Do this Take 5 again when the task, the people, or the conditions change. A full set of Yes answers in under 20 seconds is a quality warning, not a pass.',
      },
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

function requiredNow(field, values) {
  if (field.requiredWhen) return values?.[field.requiredWhen.key] === field.requiredWhen.value
  return Boolean(field.required)
}

export function missingRequired(kind, values, form) {
  const fields = form?.fields || getForm(kind).fields
  return fields.filter((field) => {
    if (!requiredNow(field, values)) return false
    if (field.type === 'severity') return !(Number(values?.[field.key]) >= 1)
    if (field.type === 'note' || field.type === 'photos') return false
    return !String(values?.[field.key] ?? '').trim()
  }).map((field) => field.label)
}

export function collectText(values) {
  if (!values || typeof values !== 'object') return ''
  return Object.entries(values)
    .filter(([key, value]) => key !== 'photos' && typeof value === 'string' && value.trim())
    .map(([, value]) => value)
    .join('\n')
}
