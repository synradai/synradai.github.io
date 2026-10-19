import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ACTION_TEMPLATES, templateActions } from '../config/actions.js'
import { FORMS, getForm, matchOption, missingRequired, voiceSteps } from '../config/forms.js'
import { MODULES, defaultModulePrefs } from '../config/modules.js'
import { REPEALED_LAW, REGULATIONS } from '../config/regulations.js'
import { INVESTIGATION_FROM, SEVERITY_SCALE } from '../config/severity.js'
import { filterRecords, toCsv } from './csv.js'
import { matchFlags, withSeverityFlag } from './flags.js'
import { extractJson } from './parse.js'
import { buildRecord } from './record.js'
import { nameWarning } from './roles.js'
import { routeFromHash } from './routes.js'
import { redact } from './redact.js'
import { mergeRows, slimForCloud } from './store.js'
import { perthDateTimeLocal } from './time.js'
import { triagePath, triageSummary } from './triage.js'
import { scanPrompt } from './prompts.js'

test('severity 1–3 close out and 4–5 investigate', () => {
  assert.equal(triagePath(1), 'closeout')
  assert.equal(triagePath(2), 'closeout')
  assert.equal(triagePath(3), 'closeout')
  assert.equal(triagePath(4), 'investigation')
  assert.equal(triagePath(5), 'investigation')
  assert.equal(INVESTIGATION_FROM, 4)
  for (const item of SEVERITY_SCALE) {
    assert.equal(item.path, item.level >= INVESTIGATION_FROM ? 'investigation' : 'closeout')
  }
  assert.match(triageSummary(2), /corrective actions/i)
  assert.match(triageSummary(5), /five-whys/i)
  assert.throws(() => triagePath(0), /1 to 5/)
})

test('minor records carry template actions and major records do not', () => {
  const minor = buildRecord({
    kind: 'hazard',
    fields: { severity: 2, description: 'Oil on the walkway', siteArea: 'Workshop' },
  })
  assert.equal(minor.status, 'open')
  assert.equal(minor.path, 'closeout')
  assert.equal(minor.correctiveActions.length, ACTION_TEMPLATES.hazard.length)
  assert.equal(minor.fiveWhys, null)

  const major = buildRecord({
    kind: 'incident',
    fields: { severity: 4, description: 'A fitter fell from the tray and was not tied off' },
  })
  assert.equal(major.status, 'investigation')
  assert.equal(major.correctiveActions.length, 0)
  assert.equal(major.fiveWhys.whys.length, 5)
  assert.ok(major.flags.some((flag) => flag.id === 'whs-gen-r78'))
  assert.ok(major.flags.some((flag) => flag.id === 'whs-act-s38-severity'))
  assert.ok(major.flags.every((flag) => flag.notice === 'Possible breach — verify'))
})

test('regulatory config cites current WA law only', () => {
  const blob = JSON.stringify(REGULATIONS) + JSON.stringify(REPEALED_LAW)
  assert.match(blob, /Work Health and Safety Act 2020/)
  assert.match(blob, /WHS \(General\) Regulations 2022/)
  assert.match(blob, /WHS \(Mines\) Regulations 2022/)
  assert.equal(REPEALED_LAW.repealed, '2022-03-31')
  for (const reg of REGULATIONS) {
    assert.equal(/mines safety and inspection act/i.test(reg.instrument), false)
    assert.equal(reg.instrument.includes('1994'), false)
    assert.ok(reg.pinpoint)
  }
  const quiet = matchFlags('Toolbox went well. Spotter in place and the crew was fit for work.')
  assert.deepEqual(quiet, [])
  const fall = matchFlags('The operator fell from the tray and was not tied off.')
  assert.ok(fall.some((flag) => flag.pinpoint.includes('r.78')))
  const flagged = withSeverityFlag([], 5)
  assert.equal(flagged[0].id, 'whs-act-s38-severity')
})

test('form config keeps the capture fields in one place', () => {
  for (const kind of ['incident', 'hazard', 'take5']) {
    const form = getForm(kind)
    const keys = form.fields.map((field) => field.key)
    for (const key of ['occurredAt', 'siteArea', 'peopleRoles', 'immediateActions', 'photos', 'severity', 'reporter']) {
      assert.ok(keys.includes(key), `${kind} missing ${key}`)
    }
    assert.equal(form.fields.find((field) => field.key === 'peopleRoles').label.includes('role'), true)
  }
  assert.equal(missingRequired('incident', { severity: 2, siteArea: 'ROM' }).includes('What happened'), true)
  assert.deepEqual(missingRequired('incident', {
    occurredAt: '2026-10-19T08:00',
    siteArea: 'ROM',
    description: 'Near miss',
    peopleRoles: 'Operator',
    severity: 2,
    reporter: 'HSE adviser',
  }), [])
  const energy = getForm('hazard').fields.find((field) => field.key === 'energy')
  assert.equal(matchOption(energy, 'it was a fall from the deck'), 'Fall from height')
  assert.ok(voiceSteps('take5').some((step) => step.key === 'task'))
  assert.equal(scanPrompt('incident').includes('Mines Safety and Inspection Act 1994'), true)
  assert.equal(scanPrompt('incident').includes('Never cite it'), true)
})

test('json, csv, filters, and cloud merge', () => {
  assert.deepEqual(extractJson('```json\n{"siteArea":"ROM"}\n```'), { siteArea: 'ROM' })
  assert.deepEqual(extractJson('Sure: {"a":1}'), { a: 1 })
  const rows = [
    buildRecord({ id: 'a', kind: 'incident', fields: { severity: 1, description: 'Oil leak', occurredAt: '2026-10-18T09:00', siteArea: 'Workshop', peopleRoles: 'Fitter' } }),
    buildRecord({ id: 'b', kind: 'take5', fields: { severity: 4, description: 'fell from height', occurredAt: '2026-10-19T09:00', siteArea: 'Tank', peopleRoles: 'Rigger' } }),
  ]
  const csv = toCsv(filterRecords(rows, { kind: 'incident', search: 'oil' }))
  assert.match(csv, /Oil leak/)
  assert.equal(csv.includes('fell from height'), false)
  assert.equal(filterRecords(rows, { from: '2026-10-19', to: '2026-10-19' }).length, 1)
  assert.equal(filterRecords(rows, { severity: '4' })[0].id, 'b')

  const slim = slimForCloud({ ...rows[0], fields: { ...rows[0].fields, photos: ['data:image/jpeg;base64,abc'] } })
  assert.equal(slim.fields.photos, undefined)
  assert.equal(slim.fields.photoCount, 1)
  const merged = mergeRows(
    [{ id: 'a', updatedAt: '2026-10-19T00:00:00.000Z', fields: { photos: ['data:image/jpeg;base64,abc'], description: 'old' } }],
    [{ id: 'a', updatedAt: '2026-10-19T01:00:00.000Z', fields: { description: 'new' } }],
  )
  assert.equal(merged[0].fields.description, 'new')
  assert.equal(merged[0].fields.photos[0].startsWith('data:'), true)
})

test('routes, roles, redaction, and modules', () => {
  assert.equal(routeFromHash('#/hse/capture/take5').kind, 'take5')
  assert.equal(routeFromHash('#/hse/investigate/abc').id, 'abc')
  assert.equal(routeFromHash('#/stores').screen, 'stores')
  assert.equal(routeFromHash('#access_token=abc&type=recovery').screen, 'auth-callback')
  assert.equal(routeFromHash('').screen, 'home')
  assert.match(nameWarning('John Smith'), /role/)
  assert.equal(nameWarning('Excavator operator'), '')
  assert.equal(redact('Email ada@example.com or 0412 345 678'), 'Email [email] or [phone]')
  const prefs = defaultModulePrefs()
  assert.equal(prefs.hse, true)
  assert.equal(MODULES.filter((mod) => mod.group === 'pillar').length, 4)
  assert.ok(MODULES.some((mod) => mod.id === 'scaffold'))
  assert.match(perthDateTimeLocal(new Date('2026-10-19T00:30:00.000Z')), /^2026-10-19T08:30$/)
  assert.equal(templateActions('take5').length, 3)
})

test('beta build is separate from the live app', () => {
  const beta = readFileSync(new URL('../../vite.beta.config.js', import.meta.url), 'utf8')
  const live = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8')
  const pkg = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  assert.match(beta, /base: '\/beta\/'/)
  assert.match(beta, /mode === 'production'/)
  assert.doesNotMatch(live, /base: '\/beta\/'/)
  assert.match(live, /beta\(\?:\\\/\|\\\?\|\$\)/)
  assert.match(pkg, /build:beta/)
  const liveApp = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')
  assert.equal(liveApp.includes('generate-grok'), false)
  assert.equal(liveApp.includes('beta/config'), false)
})
