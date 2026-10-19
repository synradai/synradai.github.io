// Sample data for the preview modules. Fictional site, roles not names.

export const STORES = [
  { id: 'CB-5T', name: '5 t chain block', bin: 'A-12', status: 'Out', holder: 'Night-shift fitter', due: '20 Oct 2026' },
  { id: 'TW-34', name: 'Torque wrench 3/4', bin: 'B-02', status: 'In stores', holder: '—', due: '—' },
  { id: 'GD-04', name: 'Gas detector', bin: 'C-07', status: 'Out', holder: 'Confined-space crew', due: '19 Oct 2026' },
  { id: 'RT-20', name: '20 mm cargo ratchet', bin: 'A-04', status: 'In stores', holder: '—', due: '—' },
]

export const SCAFFOLD = [
  { id: 'SC-14', place: 'Bay 4 workshop', tag: 'Green', inspected: '12 Oct 2026', next: '19 Oct 2026', height: '6.4 m', tonnes: 1.82 },
  { id: 'SC-22', place: 'Tank 2 west', tag: 'Yellow', inspected: '15 Oct 2026', next: '22 Oct 2026', height: '4.1 m', tonnes: 0.96 },
  { id: 'SC-03', place: 'ROM hopper', tag: 'Red — out of service', inspected: '11 Oct 2026', next: 'Hold', height: '8.0 m', tonnes: 3.4 },
]

export const SCAFFOLD_RATE = 186.5

export const TICKETS = [
  { role: 'Rigger, crew 2', ticket: 'Dogging HRWL', expires: '12 Dec 2026', state: 'Current' },
  { role: 'Trades assistant', ticket: 'Working at heights', expires: '2 Nov 2026', state: 'Due soon' },
  { role: 'Supervisor', ticket: 'Confined space', expires: '1 Sep 2026', state: 'Expired' },
  { role: 'Leading hand', ticket: 'First aid', expires: '18 Jun 2027', state: 'Current' },
]

export const VEHICLES = [
  { id: 'LV-214', type: 'Light vehicle', due: '2 Nov 2026', km: '184,220 km', prestart: 'Not done today' },
  { id: 'HV-08', type: 'Service truck', due: '28 Oct 2026', km: '96,410 km', prestart: 'Supervisor signed 05:40' },
  { id: 'EX-331', type: 'Excavator', due: 'Overdue 14 Oct 2026', km: '11,204 h', prestart: 'Not done today' },
]

export const PRESTART = [
  'Park brake applied',
  'Lights, horn, and reversing alarm',
  'Tyres and wheel nuts',
  'No leaks under the machine',
  'Fire extinguisher in date',
  'Seatbelt works',
  'UHF on the site channel',
  'Emergency stop tested',
]

export const KPIS = [
  { label: 'Take 5s this week', value: '46', width: '82%' },
  { label: 'Hazards closed', value: '19', width: '70%' },
  { label: 'Hazards still open', value: '7', width: '34%' },
  { label: 'Incidents this month', value: '3', width: '22%' },
  { label: 'Actions overdue', value: '2', width: '16%' },
  { label: 'TRIFR (sample)', value: '4.2', width: '40%' },
]
