// Phase 1 starter registers. Every id is generated for this organisation.
// Sample rows carry _example so they can be cleared without touching real rows.

import { choiceList, newId } from './registers.js'
import { fieldByName, tagOptions } from './tagging.js'
import { perthDate } from './time.js'

function field(name, type, options = [], position = 0) {
  return { id: newId(), name, type, options, position }
}

function view(name, config = {}, position = 0) {
  return { id: newId(), name, position, config }
}

function exampleRow(fields, sample) {
  const values = { _example: true }
  for (const item of fields) {
    if (Object.prototype.hasOwnProperty.call(sample, item.name)) values[item.id] = sample[item.name]
  }
  return { id: newId(), values, createdAt: '', updatedAt: '' }
}

const locations = () => choiceList(['Wagerup', 'Pinjarra'])

function siteViews(locationField, extra = []) {
  const views = [view('Master Register', {}, 0)]
  if (locationField) {
    views.push(view('Wagerup', { filter: [{ fieldId: locationField.id, op: 'is', value: 'Wagerup' }] }, 1))
    views.push(view('Pinjarra', { filter: [{ fieldId: locationField.id, op: 'is', value: 'Pinjarra' }] }, 2))
  }
  extra.forEach((item) => views.push(view(item.name, item.config, views.length)))
  return views
}

function base({ name, abbr, color, kind, hoursAgo, now, table }) {
  const at = new Date(now).getTime()
  return {
    id: newId(),
    name,
    abbr,
    color,
    starred: false,
    kind,
    openedAt: new Date(at - hoursAgo * 3600000).toISOString(),
    tables: [table],
  }
}

function taggedTable(columns, samples) {
  const fields = [
    ...columns.map((item, index) => field(item.name, item.type, item.options || [], index)),
    field('Tag colour', 'single_select', tagOptions(), columns.length),
    field('Tagged on', 'date', [], columns.length + 1),
  ]
  const location = fields.find((item) => item.name === 'Location')
  return {
    id: newId(),
    name: 'Register',
    position: 0,
    fields,
    views: siteViews(location, [{ name: 'Locked out', config: { use: 'locked' } }]),
    rows: samples.map((sample) => exampleRow(fields, sample)),
  }
}

function gear(spec, now) {
  return base({
    name: spec.name,
    abbr: spec.abbr,
    color: spec.color,
    kind: 'gear',
    hoursAgo: spec.hoursAgo,
    now,
    table: { ...taggedTable(spec.columns, spec.samples), name: spec.tab || spec.name },
  })
}

const place = { name: 'Location', type: 'single_select', options: null }

function columns(list) {
  return list.map((item) => (item.name === 'Location' && !item.options ? { ...item, options: locations() } : item))
}

export function phaseOneBases(now = new Date().toISOString()) {
  const gearSpecs = [
    {
      name: 'Scaffold gear', abbr: 'Sg', color: '#6b2d3c', hoursAgo: 30,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Component', type: 'single_select', options: choiceList(['Standard', 'Ledger', 'Transom', 'Board', 'Coupler']) },
        { name: 'Quantity', type: 'number' },
        place,
      ]),
      samples: [
        { Item: 'Standard 2.0 m', 'Unique ID': 'SG-200', Component: 'Standard', Quantity: 40, Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-10-04' },
        { Item: 'Ledger 1.8 m', 'Unique ID': 'SG-181', Component: 'Ledger', Quantity: 24, Location: 'Pinjarra', 'Tag colour': 'Blue', 'Tagged on': '2026-08-01' },
      ],
    },
    {
      name: 'WAH equipment', abbr: 'Wa', color: '#7a3e12', hoursAgo: 26,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        place,
        { name: 'Notes', type: 'text' },
      ]),
      samples: [
        { Item: 'Inertia reel', 'Unique ID': 'IR-104', Location: 'Wagerup', Notes: 'Example. In date this quarter.', 'Tag colour': 'Yellow', 'Tagged on': '2026-10-02' },
        { Item: 'Rescue kit', 'Unique ID': 'RK-12', Location: 'Pinjarra', Notes: 'Example. Last tagged green.', 'Tag colour': 'Green', 'Tagged on': '2026-04-18' },
        { Item: 'Kernmantel rope', 'Unique ID': 'RP-7', Location: 'Wagerup', Notes: 'Example. Red tag from summer.', 'Tag colour': 'Red', 'Tagged on': '2025-12-09' },
        { Item: 'Inertia reel', 'Unique ID': 'IR-088', Location: 'Pinjarra', Notes: 'Example. Blue tag from last quarter.', 'Tag colour': 'Blue', 'Tagged on': '2026-07-14' },
      ],
    },
    {
      name: 'Harnesses', abbr: 'Ha', color: '#1d4a32', hoursAgo: 22,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Make', type: 'text' },
        { name: 'Size', type: 'single_select', options: choiceList(['Small', 'Medium', 'Large']) },
        place,
      ]),
      samples: [
        { Item: 'Full body harness', 'Unique ID': 'H-104', Make: 'Sample make', Size: 'Medium', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-10-06' },
        { Item: 'Full body harness', 'Unique ID': 'H-221', Make: 'Sample make', Size: 'Large', Location: 'Pinjarra', 'Tag colour': 'Green', 'Tagged on': '2026-04-12' },
      ],
    },
    {
      name: 'Lanyards', abbr: 'Ly', color: '#0e7490', hoursAgo: 20,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Type', type: 'single_select', options: choiceList(['Single', 'Twin', 'Tie-back']) },
        { name: 'Length', type: 'text' },
        place,
      ]),
      samples: [
        { Item: 'Twin tail lanyard', 'Unique ID': 'LY-14', Type: 'Twin', Length: '1.8 m', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-09-22' },
        { Item: 'Single lanyard', 'Unique ID': 'LY-03', Type: 'Single', Length: '1.5 m', Location: 'Pinjarra', 'Tag colour': 'Red', 'Tagged on': '2026-01-19' },
      ],
    },
    {
      name: 'Ladders', abbr: 'Ld', color: '#2458a8', hoursAgo: 18,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Type', type: 'single_select', options: choiceList(['Step', 'Extension']) },
        { name: 'Length', type: 'text' },
        place,
      ]),
      samples: [
        { Item: 'Platform step', 'Unique ID': 'L-14', Type: 'Step', Length: '1.8 m', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-09-20' },
        { Item: 'Extension ladder', 'Unique ID': 'L-02', Type: 'Extension', Length: '4.2 m', Location: 'Pinjarra', 'Tag colour': 'Red', 'Tagged on': '2026-01-11' },
      ],
    },
    {
      name: 'Electrical', abbr: 'El', color: '#b42318', hoursAgo: 16,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Type', type: 'single_select', options: choiceList(['Lead', 'RCD', 'Tool']) },
        place,
      ]),
      samples: [
        { Item: 'Extension lead 20 m', 'Unique ID': 'EL-55', Type: 'Lead', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-10-01' },
        { Item: 'Portable RCD', 'Unique ID': 'RCD-3', Type: 'RCD', Location: 'Pinjarra', 'Tag colour': 'Blue', 'Tagged on': '2026-06-20' },
      ],
    },
    {
      name: 'Fire extinguishers', abbr: 'Fe', color: '#9f1239', hoursAgo: 14,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Type', type: 'single_select', options: choiceList(['DCP', 'CO2', 'Foam']) },
        { name: 'Size', type: 'text' },
        place,
      ]),
      samples: [
        { Item: 'Dry chemical', 'Unique ID': 'FE-12', Type: 'DCP', Size: '9 kg', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-09-15' },
        { Item: 'Carbon dioxide', 'Unique ID': 'FE-4', Type: 'CO2', Size: '5 kg', Location: 'Pinjarra', 'Tag colour': 'Green', 'Tagged on': '2026-03-20' },
      ],
    },
    {
      name: 'PPE', abbr: 'Pp', color: '#3f6212', hoursAgo: 12,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Size', type: 'text' },
        { name: 'Quantity', type: 'number' },
        place,
      ]),
      samples: [
        { Item: 'Helmet', 'Unique ID': 'PPE-H-1', Size: 'One size', Quantity: 12, Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-10-10' },
        { Item: 'Glove box', 'Unique ID': 'PPE-G-2', Size: 'Size 10', Quantity: 6, Location: 'Pinjarra', 'Tag colour': 'Red', 'Tagged on': '2026-01-20' },
      ],
    },
    {
      name: 'Tools and store', abbr: 'Ts', color: '#5c6b82', hoursAgo: 10,
      columns: columns([
        { name: 'Item', type: 'text' },
        { name: 'Unique ID', type: 'text' },
        { name: 'Store', type: 'text' },
        { name: 'Last user', type: 'text' },
        place,
      ]),
      samples: [
        { Item: 'Come-along 1.6 t', 'Unique ID': 'CA-16', Store: 'Crib store', 'Last user': 'Sample fitter', Location: 'Wagerup', 'Tag colour': 'Yellow', 'Tagged on': '2026-09-28' },
        { Item: 'Chain block 2 t', 'Unique ID': 'CB-20', Store: 'Main store', 'Last user': 'Sample rigger', Location: 'Pinjarra', 'Tag colour': 'Green', 'Tagged on': '2026-05-02' },
      ],
    },
  ]

  const plantFields = [
    field('Item', 'text', [], 0),
    field('Unique ID', 'text', [], 1),
    field('Type', 'single_select', choiceList(['Lighting tower', 'Compressor']), 2),
    field('Location', 'single_select', locations(), 3),
    field('Last service', 'date', [], 4),
    field('Hours', 'number', [], 5),
  ]
  const hireFields = [
    field('Item', 'text', [], 0),
    field('Unique ID', 'text', [], 1),
    field('Hire company', 'text', [], 2),
    field('Location', 'single_select', locations(), 3),
    field('On hire', 'date', [], 4),
    field('Off hire', 'date', [], 5),
    field('Client', 'text', [], 6),
  ]
  const oosFields = [
    field('Item', 'text', [], 0),
    field('Unique ID', 'text', [], 1),
    field('From register', 'text', [], 2),
    field('Location', 'single_select', locations(), 3),
    field('Reason', 'text', [], 4),
    field('Out on', 'date', [], 5),
    field('Back on', 'date', [], 6),
    field('Status', 'single_select', [
      { id: 'out', label: 'Out of service', color: '#854d0e' },
      { id: 'back', label: 'Returned', color: '#1f8a4c' },
    ], 7),
  ]

  return [
    ...gearSpecs.map((spec) => gear(spec, now)),
    base({
      name: 'Owned plant',
      abbr: 'Pl',
      color: '#1e3a5f',
      kind: 'plant',
      hoursAgo: 8,
      now,
      table: {
        id: newId(),
        name: 'Owned plant',
        position: 0,
        fields: plantFields,
        views: siteViews(plantFields[3], [{ name: 'Service due', config: { use: 'due' } }]),
        rows: [
          exampleRow(plantFields, { Item: 'Lighting tower', 'Unique ID': 'LT-04', Type: 'Lighting tower', Location: 'Wagerup', 'Last service': '2026-02-01', Hours: 412 }),
          exampleRow(plantFields, { Item: 'Compressor', 'Unique ID': 'CP-02', Type: 'Compressor', Location: 'Pinjarra', 'Last service': '2026-08-20', Hours: 180 }),
        ],
      },
    }),
    base({
      name: 'Hired equipment',
      abbr: 'Hi',
      color: '#6b4c9a',
      kind: 'hire',
      hoursAgo: 6,
      now,
      table: {
        id: newId(),
        name: 'Hired equipment',
        position: 0,
        fields: hireFields,
        views: siteViews(hireFields[3], [
          { name: 'On hire', config: { use: 'on_hire' } },
          { name: 'Off hire', config: { use: 'off_hire' } },
        ]),
        rows: [
          exampleRow(hireFields, { Item: 'Lighting tower', 'Unique ID': 'HT-19', 'Hire company': 'Sample Hire', Location: 'Wagerup', 'On hire': '2026-10-01', 'Off hire': '', Client: 'Site client' }),
          exampleRow(hireFields, { Item: 'Compressor', 'Unique ID': 'HC-7', 'Hire company': 'Sample Hire', Location: 'Pinjarra', 'On hire': '2026-06-01', 'Off hire': '2026-09-30', Client: 'Site client' }),
        ],
      },
    }),
    base({
      name: 'Out of service',
      abbr: 'Os',
      color: '#111111',
      kind: 'out_of_service',
      hoursAgo: 4,
      now,
      table: {
        id: newId(),
        name: 'Out of service',
        position: 0,
        fields: oosFields,
        views: [
          view('Out now', { filter: [{ fieldId: oosFields[7].id, op: 'is', value: 'Out of service' }] }, 0),
          view('History', {}, 1),
        ],
        rows: [
          exampleRow(oosFields, { Item: 'Full body harness', 'Unique ID': 'H-221', 'From register': 'Harnesses', Location: 'Pinjarra', Reason: 'Damaged webbing. Example.', 'Out on': '2026-10-20', 'Back on': '', Status: 'Out of service' }),
          exampleRow(oosFields, { Item: 'Extension ladder', 'Unique ID': 'L-09', 'From register': 'Ladders', Location: 'Wagerup', Reason: 'Bent stile, since repaired. Example.', 'Out on': '2026-08-02', 'Back on': '2026-10-01', Status: 'Returned' }),
        ],
      },
    }),
  ]
}

function textFrom(table, row, names) {
  for (const name of names) {
    const id = fieldByName(table, name)?.id
    const value = id ? row.values?.[id] : ''
    if (value) return String(value)
  }
  return ''
}

export function moveOutOfService(bases, { tableId, rowId, reason, now = new Date() }) {
  const sourceBase = (bases || []).find((item) => item.tables?.some((table) => table.id === tableId))
  const sourceTable = sourceBase?.tables?.find((table) => table.id === tableId)
  const sourceRow = sourceTable?.rows?.find((row) => row.id === rowId)
  const oos = (bases || []).find((item) => item.kind === 'out_of_service')
  const oosTable = oos?.tables?.[0]
  if (!sourceRow || !oosTable) {
    throw new Error(oosTable ? 'That row is not on a register.' : 'The Out of service register is not on this company yet.')
  }
  const today = perthDate(now)
  const id = newId()
  const set = (name, value) => {
    const fieldId = fieldByName(oosTable, name)?.id
    return fieldId ? { [fieldId]: value } : {}
  }
  const oosRow = {
    id,
    createdAt: '',
    updatedAt: '',
    values: {
      ...set('Item', textFrom(sourceTable, sourceRow, ['Item', 'Scaffold tag', 'Description', 'Title'])),
      ...set('Unique ID', textFrom(sourceTable, sourceRow, ['Unique ID', 'Scaffold tag'])),
      ...set('From register', sourceBase.name),
      ...set('Location', textFrom(sourceTable, sourceRow, ['Location'])),
      ...set('Reason', String(reason || '').trim() || 'Taken out of service'),
      ...set('Out on', today),
      ...set('Back on', ''),
      ...set('Status', 'Out of service'),
      _example: sourceRow.values?._example === true,
      _sourceTableId: tableId,
      _sourceRowId: rowId,
    },
  }
  const source = { ...sourceRow, values: { ...sourceRow.values, _oos: true, _oosRowId: id } }
  const next = (bases || []).map((item) => ({
    ...item,
    tables: (item.tables || []).map((table) => {
      if (table.id === tableId) return { ...table, rows: table.rows.map((row) => (row.id === rowId ? source : row)) }
      if (table.id === oosTable.id) return { ...table, rows: [...(table.rows || []), oosRow] }
      return table
    }),
  }))
  return { bases: next, source, oosRow, oosTableId: oosTable.id }
}

export function returnToService(bases, { tableId, rowId, now = new Date() }) {
  const oosTable = (bases || []).flatMap((item) => item.tables || []).find((table) => table.id === tableId)
  const oosRow = oosTable?.rows?.find((row) => row.id === rowId)
  if (!oosRow) throw new Error('That out-of-service row was not found.')
  const today = perthDate(now)
  const statusId = fieldByName(oosTable, 'Status')?.id
  const backId = fieldByName(oosTable, 'Back on')?.id
  const updated = {
    ...oosRow,
    values: { ...oosRow.values, ...(statusId ? { [statusId]: 'Returned' } : {}), ...(backId ? { [backId]: today } : {}) },
  }
  const sourceTableId = oosRow.values?._sourceTableId || ''
  const sourceRowId = oosRow.values?._sourceRowId || ''
  const next = (bases || []).map((item) => ({
    ...item,
    tables: (item.tables || []).map((table) => ({
      ...table,
      rows: (table.rows || []).map((row) => {
        if (row.id === rowId && table.id === tableId) return updated
        if (sourceRowId && row.id === sourceRowId && table.id === sourceTableId) {
          const values = { ...row.values }
          delete values._oos
          delete values._oosRowId
          return { ...row, values }
        }
        return row
      }),
    })),
  }))
  const source = sourceTableId
    ? next.flatMap((item) => item.tables || []).find((table) => table.id === sourceTableId)?.rows?.find((row) => row.id === sourceRowId) || null
    : null
  return { bases: next, oosRow: updated, source, sourceTableId }
}

export function withoutExamples(bases) {
  return (bases || []).map((item) => ({
    ...item,
    tables: (item.tables || []).map((table) => ({
      ...table,
      rows: (table.rows || []).filter((row) => row.values?._example !== true),
    })),
  }))
}

export function exampleCount(bases) {
  return (bases || []).reduce((sum, item) => sum + (item.tables || []).reduce((inner, table) => (
    inner + (table.rows || []).filter((row) => row.values?._example === true).length
  ), 0), 0)
}
