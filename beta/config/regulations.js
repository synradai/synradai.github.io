// Current WA safety law used for "possible breach — verify" flags.
// Edit the keywords and pinpoints here after an HSE / legal review.
//
// Mines Safety and Inspection Act 1994 (WA) was repealed on 31 March 2022
// when the Work Health and Safety Act 2020 (WA) commenced. Do not add it
// back as a current citation.

export const REPEALED_LAW = {
  name: 'Mines Safety and Inspection Act 1994 (WA)',
  repealed: '2022-03-31',
  note: 'Repealed. The current mine safety law is the Work Health and Safety Act 2020 (WA) and the WHS (Mines) Regulations 2022.',
}

export const LEGAL_NOTICE = 'Possible breach — verify'

// Keywords lean towards failure language so a normal Take 5 that mentions
// a spotter or a harness does not flag itself.
export const REGULATIONS = [
  {
    id: 'whs-act-s19',
    instrument: 'Work Health and Safety Act 2020 (WA)',
    pinpoint: 's.19 — primary duty of care',
    label: 'A PCBU must ensure health and safety so far as reasonably practicable.',
    keywords: ['no control in place', 'controls failed', 'control failed', 'left uncontrolled', 'primary duty'],
  },
  {
    id: 'whs-act-s38',
    instrument: 'Work Health and Safety Act 2020 (WA)',
    pinpoint: 's.38 — notify the regulator immediately',
    label: 'A death, serious injury or illness, or a dangerous incident is notifiable.',
    keywords: ['notifiable', 'serious injury', 'fatality', 'fatal', 'amputation', 'electric shock', 'uncontrolled fire', 'dangerous incident'],
  },
  {
    id: 'whs-act-s39',
    instrument: 'Work Health and Safety Act 2020 (WA)',
    pinpoint: 's.39 — preserve the incident site',
    label: 'A notifiable incident site must not be disturbed until an inspector directs otherwise.',
    keywords: ['scene disturbed', 'disturbed the scene', 'cleaned up the scene', 'moved the plant before'],
  },
  {
    id: 'whs-gen-r34',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'r.34 — duty to identify hazards',
    label: 'Hazards have to be identified before and while the work is done.',
    keywords: ['hazard not identified', 'hazards were not identified', 'no hazard id', 'did not identify the hazard'],
  },
  {
    id: 'whs-gen-r54',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'r.54–r.55 — falling objects',
    label: 'The risk of an object falling on a person must be managed.',
    keywords: ['dropped the', 'load fell', 'falling object', 'unsecured load', 'object fell'],
  },
  {
    id: 'whs-gen-r78',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'r.78 — management of risk of a fall',
    label: 'Manage a fall from one level to another that could cause injury. WA does not use a flat 2 metre rule.',
    keywords: ['fell from', 'fall from', 'working at height', 'at heights', 'unprotected edge', 'not tied off', 'no edge protection'],
  },
  {
    id: 'whs-gen-r55',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'rr.55A–55D — psychosocial risks',
    label: 'Psychosocial hazards have to be managed, including how work is designed and how people are treated.',
    keywords: ['bullying', 'harassment', 'psychosocial', 'threatened', 'workplace violence'],
  },
  {
    id: 'whs-gen-r203',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'r.203 — risks from plant',
    label: 'Plant risks, including guarding and isolation of energy, have to be managed.',
    keywords: ['unguarded', 'no isolation', 'not isolated', 'lockout failed', 'nip point'],
  },
  {
    id: 'whs-gen-traffic',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    pinpoint: 'People and mobile plant — verify the site traffic rule and the regulation that applies',
    label: 'Interaction between people and mobile plant has to be controlled.',
    keywords: ['no exclusion zone', 'pedestrian in the swing', 'no spotter', 'line of fire', 'positive communication failed'],
  },
  {
    id: 'whs-mines-r612',
    instrument: 'WHS (Mines) Regulations 2022 (WA)',
    pinpoint: 'r.612 and Schedule 19 — principal mining hazards',
    label: 'Principal mining hazards need a management plan. They include ground failure, inrush, roads and mobile plant, and fire.',
    keywords: ['principal mining hazard', 'inrush', 'ground failure', 'wall failure', 'windrow missing', 'spontaneous combustion'],
  },
  {
    id: 'whs-mines-r621',
    instrument: 'WHS (Mines) Regulations 2022 (WA)',
    pinpoint: 'r.621 — mine safety management system',
    label: 'A mine needs a safety management system covering supervision, monitoring, and investigations.',
    keywords: ['mine safety management system', 'no msms', 'not in the msms'],
  },
  {
    id: 'whs-mines-r675v',
    instrument: 'WHS (Mines) Regulations 2022 (WA)',
    pinpoint: 'r.675V — reportable incidents',
    label: 'A mine operator must notify reportable incidents as soon as possible, as well as notifiable incidents under the Act.',
    keywords: ['reportable incident'],
  },
]

export const NOTIFY_FLAG = {
  id: 'whs-act-s38-severity',
  instrument: 'Work Health and Safety Act 2020 (WA)',
  pinpoint: 's.38 — duty to notify of notifiable incidents',
  label: 'Severity 4 or 5 may be a notifiable incident. Notify the regulator yourself if it is a death, a serious injury or illness, or a dangerous incident. This app does not notify WorkSafe.',
  keywords: [],
}
