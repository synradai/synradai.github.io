// Site-setup questions. HSE stays on. The others hide from the nav when
// the answer is no. Defaults are on so the beta can be clicked through
// before setup.

export const MODULES = [
  {
    id: 'hse',
    label: 'HSE',
    group: 'pillar',
    href: '#/hse',
    locked: true,
    question: 'Incident, hazard, and Take 5 capture stays on for every site.',
  },
  {
    id: 'training',
    label: 'Training',
    group: 'pillar',
    href: '#/training',
    question: 'Do you track tickets, inductions, or competencies on this site?',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    group: 'pillar',
    href: '#/maintenance',
    question: 'Do you run vehicles or mobile plant that need pre-starts and services?',
  },
  {
    id: 'kpis',
    label: 'KPIs & Forms',
    group: 'pillar',
    href: '#/kpis',
    question: 'Do you report safety KPIs or client forms from this site?',
  },
  {
    id: 'stores',
    label: 'Stores',
    group: 'register',
    href: '#/stores',
    question: 'Do you issue tools, parts, or PPE from a store?',
  },
  {
    id: 'scaffold',
    label: 'Scaffold Register',
    group: 'register',
    href: '#/scaffold',
    question: 'Do you erect, inspect, or hire scaffold?',
  },
]

export function defaultModulePrefs() {
  return Object.fromEntries(MODULES.map((mod) => [mod.id, true]))
}
