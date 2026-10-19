// Law list for the beta. Edit breaches.js to extend section 3.
// The adviser pack is a reference for the app, not legal advice.

import { BREACHES, LEGAL_NOTICE, NOT_USED_IN_WA, UNVERIFIED_NOTE } from './breaches.js'

export { BREACHES, LEGAL_NOTICE, NOT_USED_IN_WA, UNVERIFIED_NOTE }

export const REPEALED_LAW = [
  {
    name: 'Occupational Safety and Health Act 1984 (WA)',
    repealed: '2022-03-31',
    repealedBy: 'Work Health and Safety Act 2020 (WA) s.278',
    note: 'Repealed. Do not cite it as current law.',
  },
  {
    name: 'Occupational Safety and Health Regulations 1996 (WA)',
    repealed: '2022-03-31',
    repealedBy: 'Work Health and Safety Act 2020 (WA) s.279',
    note: 'Repealed. Do not cite them as current law.',
  },
]

// Still in force, but only for the mines safety levy. Safety duties moved
// to the WHS Act (Pt 15 Div 2, from s.280).
export const LEVY_LAW = {
  name: 'Mines Safety and Inspection Act 1994 (WA)',
  inForceFor: 'mines safety levy only',
  note: 'Not repealed. Safety provisions were removed. Cite it for the levy only, never for a safety duty.',
}

export const RULESETS = [
  {
    id: 'general',
    label: 'General',
    instrument: 'WHS (General) Regulations 2022 (WA)',
    note: 'General duties and the General Regulations.',
  },
  {
    id: 'mines',
    label: 'Mines',
    instrument: 'WHS (Mines) Regulations 2022 (WA)',
    note: 'r.5B(a) counts refining as mining operations. r.5B(c)(iv) excludes manufacturing. Which setting applies at Tianqi Kwinana and Wagerup is UNVERIFIED.',
  },
  {
    id: 'pageo',
    label: 'PAGEO',
    instrument: 'WHS (Petroleum and Geothermal Energy Operations) Regulations 2022 (WA)',
    note: 'PAGEO regulation numbers are not in the adviser pack yet. UNVERIFIED.',
  },
]

export const REGULATOR = {
  name: 'WorkSafe',
  within: 'LGIRS',
  phone: '1800 678 198',
  phoneWhen: 'Deaths, serious injuries, and life-threatening dangerous incidents. 24 hours.',
  onlineWhen: 'Non-life-threatening dangerous incidents, online.',
  dgPhone: '(08) 6551 2300',
  dgNote: 'If dangerous goods are involved, also call the DG Safety Branch and lodge an online report within 21 days.',
  record: 's.38: notify immediately by the fastest means. Written notice within 48 hours if requested. Keep the record 5 years (s.38(7)). s.39: preserve the site.',
}

export const NOTIFIABLE = {
  act: [
    { reg: 's.35', title: 'A death, a serious injury or illness, or a dangerous incident.' },
    { reg: 's.36(a)', title: 'Hospital in-patient.' },
    { reg: 's.36(b)', title: 'Immediate treatment for amputation, serious head injury, serious eye injury, serious burn, degloving or scalping, spinal injury, loss of a bodily function, or serious lacerations.' },
    { reg: 's.36(c)', title: 'Medical treatment within 48 hours of exposure to a substance.' },
    { reg: 's.36(d)', title: 'A remote location that needs urgent transfer.' },
    { reg: 's.36(e)', title: 'WA only: a doctor’s opinion that the person likely cannot do normal work for 10 or more days.' },
    { reg: 'r.699', title: 'Prescribed illnesses: work-related infections, Q fever, anthrax, leptospirosis, brucellosis, Hendra, avian influenza, psittacosis.' },
    { reg: 's.37', title: 'A dangerous incident: serious risk from immediate or imminent exposure to a spill, fire, explosion, gas, steam, pressurised substance, electric shock, a fall or release from height, collapse of registered plant or a structure, excavation or shoring collapse, inrush, or loss of main underground ventilation.' },
    { reg: 's.37 extra', title: 'No extra prescribed dangerous incidents were found in the General Regulations.', verified: false },
  ],
}

export const REPORTING = {
  common: [
    `Call ${REGULATOR.name} on ${REGULATOR.phone} for a death, a serious injury, or a life-threatening dangerous incident.`,
    REGULATOR.onlineWhen,
    REGULATOR.dgNote,
    REGULATOR.record,
    'This app does not notify WorkSafe.',
  ],
  mines: [
    'Mines only: after the call, report online via SRS.',
    'r.675V: medical treatment injury, loss of control of plant, HV contact, toxic exposure, loss of consciousness, and a high-potential near miss go in writing on the approved form.',
    'r.675X: a PCBU who is not the mine operator must tell the mine operator.',
  ],
  minesUnverified: 'Mines Regs numbering is UNVERIFIED. Do not reuse General Regulations numbers on a mine site.',
  pageoUnverified: 'PAGEO reporting steps are not in the adviser pack yet. The Act notification duties still apply. UNVERIFIED.',
}

export function reportingFor(ruleset) {
  const steps = [...REPORTING.common]
  const unverified = []
  if (ruleset === 'mines') {
    steps.push(...REPORTING.mines)
    unverified.push(REPORTING.minesUnverified)
  }
  if (ruleset === 'pageo') unverified.push(REPORTING.pageoUnverified)
  return { ...REGULATOR, steps, unverified }
}

export function rulesetMeta(id) {
  return RULESETS.find((item) => item.id === id) || RULESETS[0]
}

function applies(entry, ruleset) {
  const list = entry.rulesets || ['general']
  return list.includes(ruleset)
}

export function presentBreach(entry, ruleset = 'general') {
  const notice = LEGAL_NOTICE
  const needsVerify = entry.verified === false || (entry.unverifiedParts || []).length > 0
  const base = {
    ...entry,
    pinpoint: entry.reg ? `${entry.reg} — ${entry.title}` : entry.title,
    label: entry.title,
    notice,
    unverified: needsVerify ? UNVERIFIED_NOTE : '',
  }
  if (ruleset === 'general' || (entry.rulesets || []).includes(ruleset) && !entry.instrument.includes('(General)')) {
    return base
  }
  if (ruleset === 'mines' && entry.instrument.includes('(General)')) {
    return {
      ...base,
      instrument: 'WHS (Mines) Regulations 2022 (WA)',
      pinpoint: `${entry.area}. Mines numbering is UNVERIFIED. Do not reuse General Regulations ${entry.reg}.`,
      verified: false,
      unverified: UNVERIFIED_NOTE,
    }
  }
  if (ruleset === 'pageo' && entry.instrument.includes('(General)')) {
    return {
      ...base,
      instrument: 'WHS (Petroleum and Geothermal Energy Operations) Regulations 2022 (WA)',
      reg: '',
      pinpoint: `${entry.area}. PAGEO regulation numbers are not in the adviser pack yet.`,
      verified: false,
      unverified: UNVERIFIED_NOTE,
    }
  }
  return base
}

export function breachesFor(ruleset = 'general') {
  return BREACHES.filter((entry) => applies(entry, ruleset)).map((entry) => presentBreach(entry, ruleset))
}

export const NOTIFY_FLAG = {
  id: 'whs-act-s38-severity',
  area: 'Notify WorkSafe',
  instrument: 'Work Health and Safety Act 2020 (WA)',
  reg: 's.38',
  title: 'Severity 4 or 5, or a yes on the notifiable check, may have to be notified to WorkSafe. This app does not notify WorkSafe.',
  pinpoint: 's.38 — notify WorkSafe immediately',
  label: 'Notify WorkSafe if this is a death, a serious injury or illness, or a dangerous incident. This app does not make the call.',
  notice: LEGAL_NOTICE,
  verified: true,
  keywords: [],
}

// Back-compat name used by older imports. Prefer breachesFor(ruleset).
export const REGULATIONS = breachesFor('general')
