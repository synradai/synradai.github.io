import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { planImport } from './import.js'
import { routeFromHash } from './routes.js'
import {
  applyView,
  formsLibrary,
  missingStarters,
  openedAgo,
  sortBases,
  splitMulti,
  starterBases,
  valuesFromHeaderRow,
  visibleFields,
} from './registers.js'
import { moveOutOfService, returnToService, withoutExamples } from './phaseOne.js'
import { addMonths, dueSoon, quarterBounds, quarterTag, registerStats, rowUse } from './tagging.js'
import { buildTrainingRecord, courseList, personMatrix } from './training.js'

test('a training record keeps several tickets and the matrix marks each one', () => {
  assert.deepEqual(courseList('First aid, White card; Confined space'), ['First aid', 'White card', 'Confined space'])
  const record = buildTrainingRecord({
    id: 'tr-many',
    fields: { person: 'Sam', role: 'Fitter', courses: ['First aid', 'White card'], completed: '2026-01-01', expiry: '2027-01-01', siteArea: 'Workshop' },
  })
  assert.deepEqual(record.fields.courses, ['First aid', 'White card'])
  assert.equal(record.fields.course, 'First aid, White card')
  const people = personMatrix([record], ['First aid', 'White card', 'Confined space'], '2026-10-19')
  assert.deepEqual(people[0].cells.map((cell) => cell.state), ['current', 'current', 'missing'])
  assert.equal(people[0].cells[0].id, 'tr-many')
  const planned = planImport({
    target: 'training',
    headers: ['person', 'role', 'course', 'expiry'],
    rows: [['Sam', 'Fitter', 'First aid, White card', '2027-01-01']],
    map: { person: 0, role: 1, course: 2, expiry: 3 },
    siteName: 'Workshop',
    siteId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(planned[0].error, '')
  assert.deepEqual(planned[0].record.fields.courses, ['First aid', 'White card'])
})

test('starter registers match the scaffold and equipment bases', () => {
  const bases = starterBases('2026-10-26T00:00:00.000Z')
  const scaffold = bases.find((item) => item.name === 'Scaffold Register')
  const equipment = bases.find((item) => item.name === 'Equipment Inspection Register')
  assert.equal(scaffold.abbr, 'Sc')
  assert.deepEqual(scaffold.tables.map((table) => table.name), [
    'Scaffold Register', 'Gearlist', 'Stocktake', 'Scaffold Inspection', 'Handrail Inspection', 'Employees',
  ])
  const main = scaffold.tables[0]
  assert.deepEqual(main.fields.map((field) => field.name), [
    'Scaffold tag', 'Location', 'Photos', 'OC', 'Building', 'Status', 'Description', 'PO', 'Date', 'Work type', 'Scaffold type', 'Size', 'm3',
  ])
  assert.equal(main.fields.find((field) => field.name === 'Photos').type, 'attachment')
  assert.equal(main.fields.find((field) => field.name === 'Status').type, 'single_select')
  const fieldId = (table, name) => table.fields.find((field) => field.name === name).id
  const locationId = fieldId(main, 'Location')
  const statusId = fieldId(main, 'Status')
  const poId = fieldId(main, 'PO')
  const m3Id = fieldId(main, 'm3')
  const wagerup = applyView(main, main.views.find((view) => view.name === 'Wagerup').config, '')
  assert.equal(wagerup.rows.length, 2)
  assert.equal(wagerup.rows.every((row) => row.values[locationId] === 'Wagerup'), true)
  const pinjarra = applyView(main, main.views.find((view) => view.name === 'Pinjarra').config, '')
  assert.equal(pinjarra.rows.length, 0)
  const employees = scaffold.tables.find((table) => table.name === 'Employees')
  const tickets = employees.fields.find((field) => field.name === 'Tickets')
  assert.equal(tickets.type, 'multi_select')
  assert.deepEqual(employees.rows[0].values[tickets.id], ['White card', 'Working at heights'])
  assert.deepEqual(equipment.tables.map((table) => table.name), [
    'Harness Inspection', 'Lanyard Inspection', 'Chain Block', 'Come Along', 'Lifting Chain', 'Shackles', 'Girder Clamps', 'Soft Slings', 'Spill Kit', 'Out of Service', 'Data Sheet Attachments',
  ])
  const harness = equipment.tables[0]
  assert.deepEqual(harness.fields.map((field) => field.name), [
    'Date', 'Inspector', 'Location', 'Item', 'Unique ID', 'Make', 'YoM / batch', 'OEM technical info', 'Pass / fail',
  ])
  assert.deepEqual(harness.views.map((view) => view.name), ['Master Register', 'Wagerup', 'Pinjarra'])
  const harnessPinjarra = applyView(harness, harness.views.find((view) => view.name === 'Pinjarra').config, '')
  assert.equal(harnessPinjarra.rows.length, 1)
  assert.equal(harnessPinjarra.rows[0].values[harness.fields.find((field) => field.name === 'OEM technical info').id], true)
  const grouped = applyView(main, { group: [locationId, statusId], sort: [{ fieldId: m3Id, dir: 'desc' }] }, 'barricade')
  assert.equal(grouped.rows.length, 1)
  assert.equal(grouped.groups[0].label, 'Wagerup')
  assert.equal(grouped.groups[0].children[0].label, 'ERECTED')
  const hidden = visibleFields(main, new Set([poId, m3Id]))
  assert.equal(hidden.some((field) => field.id === poId), false)
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const storedIds = (items) => items.flatMap((base) => [base.id, ...base.tables.flatMap((table) => [
    table.id,
    ...table.fields.map((field) => field.id),
    ...table.views.map((view) => view.id),
    ...table.rows.map((row) => row.id),
  ])])
  const ids = storedIds(bases)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids.every((item) => uuid.test(item)), true)
  assert.equal(ids.some((item) => storedIds(starterBases('2026-10-26T00:00:00.000Z')).includes(item)), false)
  assert.match(openedAgo(scaffold.openedAt, new Date('2026-10-26T08:00:00.000Z')), /hour/)
  assert.equal(sortBases(bases)[0].name, 'Scaffold Register')
  const forms = formsLibrary([{ id: 'c1', token: 'abcdefghijklmnopqrst', label: 'Harness Inspection Form', active: true, createdAt: '2026-10-01T00:00:00.000Z' }])
  assert.equal(forms.tables[0].rows[0].values.title, 'Harness Inspection Form')
  assert.match(forms.tables[0].rows[0].values.link, /#\/f\/abcdefghijklmnopqrst/)
  assert.equal(forms.tables[0].fields.find((field) => field.name === 'QR Codes').type, 'qr')
  const imported = valuesFromHeaderRow(employees.fields, ['Name', 'Tickets'], ['Alex', 'White card, Confined space'])
  assert.deepEqual(imported[tickets.id], ['White card', 'Confined space'])
  assert.deepEqual(splitMulti('A|B'), ['A', 'B'])
  assert.equal(routeFromHash('#/registers').screen, 'registers')
  assert.equal(routeFromHash('#/registers/base/table/row').screen, 'register-row')
  const sql = readFileSync(new URL('../../supabase/migrations/20261026051000_registers.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.registers/)
  assert.match(sql, /multi_select/)
  assert.match(sql, /audit_register_row/)
  assert.equal(sql.includes('rgkiagqexoafmtxhrlqo'), false)
})

test('phase 1 registers tag the quarter, lock out the wrong colour, and keep out-of-service history', () => {
  const now = new Date('2026-10-27T04:00:00.000Z')
  assert.equal(quarterTag(now).label, 'Yellow')
  assert.equal(quarterTag('2026-01-15').label, 'Red')
  assert.equal(quarterTag('2026-03-01').label, 'Green')
  assert.equal(quarterTag('2026-06-30').label, 'Blue')
  assert.equal(quarterTag('2026-12-01').label, 'Red')
  const summer = quarterBounds('2027-01-10')
  assert.equal(summer.start, '2026-12-01')
  assert.equal(summer.end, '2027-02-28')
  assert.equal(addMonths('2026-02-01', 6), '2026-08-01')
  assert.equal(addMonths('2026-08-20', 6), '2027-02-20')

  const bases = starterBases('2026-10-27T00:00:00.000Z')
  const names = bases.map((item) => item.name)
  for (const name of ['Scaffold gear', 'WAH equipment', 'Harnesses', 'Lanyards', 'Ladders', 'Electrical', 'Fire extinguishers', 'PPE', 'Tools and store', 'Owned plant', 'Hired equipment', 'Out of service']) {
    assert.equal(names.includes(name), true, name)
  }
  const wah = bases.find((item) => item.name === 'WAH equipment')
  assert.equal(wah.kind, 'gear')
  const table = wah.tables[0]
  const locked = applyView(table, { use: 'locked' }, '', now)
  const open = applyView(table, { use: 'in_date' }, '', now)
  assert.equal(locked.rows.length, 3)
  assert.equal(open.rows.length, 1)
  assert.equal(rowUse(table, open.rows[0].values, now).label, 'In date')
  assert.equal(locked.rows.every((row) => rowUse(table, row.values, now).label === 'LOCKED OUT'), true)
  assert.equal(table.fields.some((field) => field.type === 'qr'), false)

  const plant = bases.find((item) => item.name === 'Owned plant').tables[0]
  const due = plant.rows.find((row) => Object.values(row.values).includes('LT-04'))
  const current = plant.rows.find((row) => Object.values(row.values).includes('CP-02'))
  assert.equal(rowUse(plant, due.values, now).state, 'due')
  assert.equal(rowUse(plant, current.values, now).state, 'ok')
  const hire = bases.find((item) => item.name === 'Hired equipment').tables[0]
  assert.equal(applyView(hire, { use: 'on_hire' }, '', now).rows.length, 1)
  assert.equal(applyView(hire, { use: 'off_hire' }, '', now).rows.length, 1)

  const oos = bases.find((item) => item.name === 'Out of service')
  assert.equal(oos.kind, 'out_of_service')
  assert.equal(applyView(oos.tables[0], oos.tables[0].views[0].config, '', now).rows.length, 1)
  assert.equal(applyView(oos.tables[0], oos.tables[0].views[1].config, '', now).rows.length, 2)

  const kept = bases.filter((item) => item.name === 'Scaffold Register')
  const missing = missingStarters(kept, '2026-10-27T00:00:00.000Z')
  assert.equal(missing.some((item) => item.name === 'Scaffold Register'), false)
  assert.equal(missing.some((item) => item.name === 'WAH equipment'), true)

  const gear = bases.find((item) => item.name === 'Harnesses')
  const source = gear.tables[0].rows[0]
  const moved = moveOutOfService(bases, { tableId: gear.tables[0].id, rowId: source.id, reason: 'Failed inspection', now })
  const history = moved.bases.find((item) => item.kind === 'out_of_service').tables[0]
  assert.equal(history.rows.length, 3)
  assert.equal(moved.source.values._oos, true)
  const back = returnToService(moved.bases, { tableId: history.id, rowId: moved.oosRow.id, now })
  assert.equal(back.bases.find((item) => item.kind === 'out_of_service').tables[0].rows.length, 3)
  assert.equal(back.source.values._oos, undefined)
  assert.equal(Object.values(back.oosRow.values).includes('Returned'), true)
  const cleared = withoutExamples(bases)
  assert.equal(cleared.find((item) => item.name === 'WAH equipment').tables[0].rows.length, 0)
  assert.equal(cleared.find((item) => item.name === 'Scaffold Register').tables[0].rows.length, 2)

  const kinds = readFileSync(new URL('../../supabase/migrations/20261027041000_register_kinds.sql', import.meta.url), 'utf8')
  assert.match(kinds, /out_of_service/)
  assert.equal(kinds.includes('rgkiagqexoafmtxhrlqo'), false)

  const wahStats = registerStats(wah, now)
  assert.deepEqual(wahStats, { total: 4, locked: 3, dueSoon: 0 })
  const plantStats = registerStats(bases.find((item) => item.name === 'Owned plant'), now)
  assert.deepEqual(plantStats, { total: 2, locked: 0, dueSoon: 1 })
  assert.deepEqual(registerStats(bases.find((item) => item.name === 'Hired equipment'), now), { total: 2, locked: 0, dueSoon: 0 })

  const late = new Date('2026-11-20T04:00:00.000Z')
  assert.equal(registerStats(wah, late).dueSoon, 1)
  const service = { fields: [{ id: 'last', name: 'Last service', type: 'date' }] }
  assert.equal(dueSoon(service, { last: '2026-06-01' }, late), true)
  assert.equal(rowUse(service, { last: '2026-06-01' }, late).state, 'ok')
  assert.equal(dueSoon(service, { last: '2026-08-20' }, now), false)
  const hireSoon = {
    fields: [
      { id: 'on', name: 'On hire', type: 'date' },
      { id: 'off', name: 'Off hire', type: 'date' },
    ],
  }
  assert.equal(dueSoon(hireSoon, { on: '2026-10-01', off: '2026-11-05' }, now), true)
  assert.equal(dueSoon(hireSoon, { on: '2026-10-01', off: '2026-12-20' }, now), false)
  assert.equal(dueSoon(table, open.rows[0].values, now), false)
  assert.equal(dueSoon(table, locked.rows[0].values, now), false)
})
