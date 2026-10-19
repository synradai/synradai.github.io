const ROLE_WORDS = [
  'operator', 'supervisor', 'fitter', 'driver', 'spotter', 'rigger', 'electrician',
  'adviser', 'advisor', 'technician', 'apprentice', 'leading', 'superintendent',
  'maintainer', 'welder', 'trades', 'crew', 'officer', 'medic', 'paramedic',
  'manager', 'attendant', 'storeman', 'stores',
]

export function nameWarning(value) {
  const text = String(value || '').trim()
  if (!/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(text)) return ''
  if (ROLE_WORDS.some((word) => text.toLowerCase().includes(word))) return ''
  return 'Use a role, not a name — for example excavator operator.'
}
