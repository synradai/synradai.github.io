export const PHASE_NAMES = [
  'Incoming Handover',
  'Morning Meeting',
  'Site Rounds',
  'Findings Meeting',
  'Debrief + Handover',
]

export const PHASE_SHORT = [
  'Handover',
  'Meeting',
  'Rounds',
  'Findings',
  'Debrief',
]

export const STORAGE_KEYS = {
  CURRENT_SHIFT: 'sa_current_shift',
  HISTORY: 'sa_shift_history',
  API_KEY: 'sa_api_key',
  LEARNINGS: 'sa_learnings',
  ASK_CHATS: 'sa_ask_chats',
  KNOWN_PEOPLE: 'sa_known_people',
  THEME: 'sa_theme',
  FIELD_REPORTS: 'sa_field_reports',
  FIELD_REPORT_COMPANY: 'sa_field_report_company',
  INCIDENTS: 'sa_incidents',
  INCIDENT_COMPANY: 'sa_incident_company',
  DEIDENT_TERMS: 'sa_deident_terms',
  DAILY_LOG: 'sa_daily_log',
  ONBOARDED: 'sa_onboarded',
}

export const INCIDENT_TYPES = [
  'Near Miss',
  'First Aid',
  'Medical Treatment',
  'Property / Equipment Damage',
  'Environmental',
  'Vehicle / Mobile Plant',
  'Psychosocial',
  'HR',
  'Other',
]

export const TAG_STYLES = {
  Hazard:      { bg: 'var(--error-bg-strong)', text: 'var(--error-text)', border: 'var(--error-border)' },
  Action:      { bg: 'var(--bg-highlight)', text: 'var(--accent-soft)', border: 'var(--accent-strong)' },
  Observation: { bg: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success-border)' },
  'Near Miss': { bg: 'var(--warning-bg)', text: 'var(--warning-text)', border: 'var(--warning-border)' },
}

export const createNewShift = () => {
  const now = new Date()
  return {
    id: now.toISOString().split('T')[0] + '_' + now.getTime(),
    date: now.toISOString(),
    startTime: now.toISOString(),
    phase: 0,
    handover: {
      notes: '',
      openActions: [],
      timestamp: now.toISOString(),
    },
    meeting: {
      topics: [],
      agendaNotes: '',
      attendees: '',
    },
    rounds: [],
    findingsReport: '',
    debrief: {
      handoverNotes: '',
      outstandingActions: [],
      signoffName: '',
      signoffTime: '',
    },
    incidents: [],
  }
}
