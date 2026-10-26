import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { planImport } from './import.js'
import { routeFromHash } from './routes.js'
import {
  applyView,
  formsLibrary,
  openedAgo,
  sortBases,
  splitMulti,
  starterBases,
  valuesFromHeaderRow,
  visibleFields,
} from './registers.js'
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
