import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ACTION_TEMPLATES, templateActions } from '../config/actions.js'
import { FORMS, getForm, matchOption, missingRequired, take5Blocked, voiceSteps } from '../config/forms.js'
import { MODULES, defaultModulePrefs } from '../config/modules.js'
import { BREACHES, LEGAL_NOTICE, NOT_USED_IN_WA, SOURCE_URL, VERIFIED_ON } from '../config/breaches.js'
import { breachesFor, LEVY_LAW, MINES_VERIFY_NOTE, REPEALED_LAW, reportingFor } from '../config/regulations.js'
import { assessReport, humanErrorGuard, SEVERITY_SCALE } from '../config/severity.js'
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

test('the higher severity drives the workflow, and a notifiable yes forces level 4', () => {
  assert.equal(triagePath(1), 'closeout')
  assert.equal(triagePath(2), 'closeout')
  assert.equal(triagePath(3), 'review')
  assert.equal(triagePath(4), 'escalate')
  assert.equal(triagePath(5), 'escalate')
  for (const item of SEVERITY_SCALE) assert.equal(triagePath(item.level), item.path)
  assert.match(triageSummary(2), /supervisor/i)
  assert.match(triageSummary(3), /five whys/i)
  assert.match(triageSummary(5), /does not auto-close/i)
  assert.throws(() => triagePath(0), /1 to 5/)

  const potential = assessReport({ actualSeverity: 2, potentialSeverity: 5 })
  assert.equal(potential.driving, 5)
  assert.equal(potential.path, 'escalate')
  const notified = assessReport({ actualSeverity: 1, potentialSeverity: 2, notifiable: 'Yes' })
  assert.equal(notified.driving, 4)
  assert.equal(notified.path, 'escalate')
  assert.equal(notified.notifiable, true)
  const review = assessReport({ severity: 3 })
  assert.equal(review.path, 'review')
  assert.equal(review.icam, false)
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
  assert.equal(major.status, 'escalated')
  assert.equal(major.path, 'escalate')
  assert.equal(major.correctiveActions.length, 0)
  assert.equal(major.fiveWhys.whys.length, 5)
  assert.ok(major.flags.some((flag) => flag.id === 'whs-gen-r78'))
  assert.ok(major.flags.some((flag) => flag.id === 'whs-act-s38-severity'))
  assert.ok(major.flags.every((flag) => flag.notice === LEGAL_NOTICE))

  const stopped = buildRecord({
    kind: 'take5',
    fields: { knowJob: 'No', safeToStart: 'Yes', task: 'change a hose' },
  })
  assert.equal(stopped.status, 'stopped')
  assert.equal(stopped.fields.safeToStart, 'No')
  assert.equal(take5Blocked({ knowJob: 'No', ppe: 'Yes' }).length, 1)
  assert.equal(humanErrorGuard("The worker didn't follow the procedure"), true)
  assert.equal(humanErrorGuard('The isolation was not tested'), false)
})

test('regulatory config cites current WA law only', () => {
  const blob = JSON.stringify(BREACHES) + JSON.stringify(REPEALED_LAW) + JSON.stringify(LEVY_LAW)
  assert.match(blob, /Work Health and Safety Act 2020/)
  assert.match(blob, /WHS \(General\) Regulations 2022/)
  assert.match(blob, /Electricity \(Licensing\) Regulations 1991/)
  assert.equal(REPEALED_LAW.map((item) => item.repealed).every((date) => date === '2022-03-31'), true)
  assert.match(REPEALED_LAW.map((item) => item.name).join(' '), /Occupational Safety and Health Act 1984/)
  assert.match(REPEALED_LAW.map((item) => item.name).join(' '), /Occupational Safety and Health Regulations 1996/)
  assert.match(LEVY_LAW.inForceFor, /levy only/)
  assert.equal(REPEALED_LAW.some((item) => /mines safety and inspection act/i.test(item.name)), false)
  assert.equal(blob.includes('DEMIRS'), false)
  for (const reg of breachesFor('general')) {
    assert.equal(/mines safety and inspection act/i.test(reg.instrument), false)
    assert.equal(/occupational safety and health/i.test(reg.instrument), false)
    assert.equal(reg.notice, LEGAL_NOTICE)
  }
  const section3 = [
    'Primary duty', 'Officers', 'Workers', 'Consultation', 'Cease unsafe work',
    'Risk management', 'Information and training', 'Falls', 'Falling objects',
    'Scaffolding', 'Scaffolding licences', 'Confined spaces', 'Isolation / LOTO',
    'Lifting and rigging', 'Dogging and rigging licences', 'Electrical',
    'Energised electrical work', 'Hazardous chemicals', 'Noise', 'Manual tasks',
    'PPE', 'Mobile plant', 'Hot work / fire', 'First aid and emergency',
    'High-risk construction work', 'Licences',
  ]
  for (const area of section3) {
    assert.ok(BREACHES.some((item) => item.area === area), area)
  }
  for (const item of BREACHES) {
    assert.equal(typeof item.area, 'string')
    assert.equal(typeof item.instrument, 'string')
    assert.equal(typeof item.reg, 'string')
    assert.equal(typeof item.title, 'string')
    assert.equal(item.verified_on, VERIFIED_ON)
    assert.equal(item.source_url, SOURCE_URL)
  }
  const electrical = BREACHES.find((item) => item.id === 'whs-gen-electrical')
  assert.equal(electrical.reg.includes('r.154'), false)
  assert.match(NOT_USED_IN_WA.map((item) => item.reg).join(' '), /r\.154/)
  const quiet = matchFlags('Toolbox went well. The crew was fit for work.')
  assert.deepEqual(quiet, [])
  const fall = matchFlags('The operator fell from the tray and was not tied off.')
  assert.ok(fall.some((flag) => flag.pinpoint.includes('r.78')))
  const storedFall = BREACHES.find((item) => item.id === 'whs-gen-r78')
  assert.equal(storedFall.verified_on, VERIFIED_ON)
  assert.equal(storedFall.source_url, SOURCE_URL)
  assert.match(storedFall.reg, /r\.78/)
  const minesFall = matchFlags('The operator fell from the tray and was not tied off.', { ruleset: 'mines' })
  const minesFlag = minesFall.find((flag) => flag.id === 'whs-gen-r78')
  assert.match(minesFlag.instrument, /Mines/)
  assert.equal(minesFlag.unverified, MINES_VERIFY_NOTE)
  assert.equal(minesFlag.reg, '')
  assert.equal(`${minesFlag.pinpoint} ${minesFlag.label || ''} ${minesFlag.title}`.includes('r.78'), false)
  assert.equal(`${minesFlag.pinpoint} ${minesFlag.label || ''} ${minesFlag.title}`.includes(storedFall.reg), false)
  for (const flag of breachesFor('mines')) {
    if (!flag.instrument.includes('(Mines)')) continue
    assert.equal(flag.reg, '')
    assert.equal(flag.unverified, MINES_VERIFY_NOTE)
    assert.equal(/\br\.\d/.test(`${flag.pinpoint} ${flag.label || ''} ${flag.title}`), false)
  }
  const hot = BREACHES.find((item) => item.id === 'whs-gen-hot-work')
  assert.equal(hot.verified, false)
  assert.match(matchFlags('hot work with no fire watch')[0].unverified, /UNVERIFIED/)
  assert.equal(breachesFor('general').some((flag) => flag.id === 'pageo-pack-gap'), false)
  assert.equal(matchFlags('a normal task', { ruleset: 'pageo' }).some((flag) => flag.id === 'pageo-pack-gap'), true)
  const minesFlow = reportingFor('mines')
  assert.match(minesFlow.steps.join(' '), /SRS/)
  assert.match(minesFlow.steps.join(' '), /r\.675V/)
  assert.match(minesFlow.steps.join(' '), /r\.675X/)
  assert.equal(reportingFor('general').steps.join(' ').includes('SRS'), false)
  assert.equal(minesFlow.name, 'WorkSafe')
  const flagged = withSeverityFlag([], 5)
  assert.equal(flagged[0].id, 'whs-act-s38-severity')
  assert.equal(flagged[0].notice, LEGAL_NOTICE)
})

test('form config keeps the capture fields in one place', () => {
  for (const kind of ['incident', 'hazard', 'take5']) {
    const form = getForm(kind)
    const keys = form.fields.map((field) => field.key)
    assert.ok(keys.includes('occurredAt'), `${kind} missing date`)
    const people = form.fields.find((field) => field.key === 'peopleRoles')
    if (kind !== 'hazard') assert.equal(people.label.toLowerCase().includes('role'), true)
  }
  assert.ok(getForm('incident').fields.some((field) => field.key === 'actualSeverity'))
  assert.ok(getForm('incident').fields.some((field) => field.key === 'potentialSeverity'))
  assert.ok(getForm('incident').fields.some((field) => field.key === 'notifiable'))
  assert.equal(missingRequired('incident', { actualSeverity: 2, siteArea: 'ROM' }).includes('What happened'), true)
  assert.deepEqual(missingRequired('incident', {
    occurredAt: '2026-10-19T08:00',
    siteArea: 'ROM',
    location: 'Bay 2',
    description: 'Near miss',
    peopleRoles: 'Operator, site PCBU',
    reporter: 'HSE adviser',
    incidentType: 'Near miss',
    bodyPart: 'none',
    injuryNature: 'no injury',
    treatment: 'None',
    immediateActions: 'Stopped the job',
    scenePreserved: 'Yes',
    supervisorNotified: 'Yes',
    supervisorNotifiedAt: '08:10',
    actualSeverity: 2,
    potentialSeverity: 2,
    notifiable: 'No',
  }), [])
  const category = getForm('hazard').fields.find((field) => field.key === 'category')
  assert.equal(matchOption(category, 'it was a fall from the deck'), 'Falls')
  assert.ok(voiceSteps('take5').some((step) => step.key === 'task'))
  const prompt = scanPrompt('incident')
  assert.match(prompt, /levy only/)
  assert.match(prompt, /Occupational Safety and Health Act 1984/)
  assert.equal(prompt.includes('was repealed on 31 March 2022'), false)
  assert.equal(prompt.includes('DEMIRS'), false)
})

test('json, csv, filters, and cloud merge', () => {
  assert.deepEqual(extractJson('```json\n{"siteArea":"ROM"}\n```'), { siteArea: 'ROM' })
  assert.deepEqual(extractJson('Sure: {"a":1}'), { a: 1 })
  const rows = [
    buildRecord({ id: 'a', kind: 'incident', fields: { severity: 1, description: 'Oil leak', occurredAt: '2026-10-18T09:00', siteArea: 'Workshop', peopleRoles: 'Fitter' } }),
    buildRecord({ id: 'b', kind: 'incident', fields: { severity: 4, description: 'fell from height', occurredAt: '2026-10-19T09:00', siteArea: 'Tank', peopleRoles: 'Rigger' } }),
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
  assert.equal(routeFromHash('#/join').screen, 'join')
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

  const login = readFileSync(new URL('../components/Login.jsx', import.meta.url), 'utf8')
  assert.equal(login.includes('#/join'), false)
  assert.equal(login.includes('Create one'), false)

  const migration = readFileSync(new URL('../../supabase/migrations/20261019060723_beta_hse_records.sql', import.meta.url), 'utf8')
  assert.match(migration, /org_id = public\.current_org_id\(\)/)
  assert.match(migration, /create table if not exists public\.hse_records/)
  assert.equal(migration.includes('trial_ends_at'), false)

  const grok = readFileSync(new URL('../../supabase/functions/generate-grok/index.ts', import.meta.url), 'utf8')
  assert.equal(grok.includes('trial_ends_at'), false)
  assert.equal(grok.includes('subscription_status'), false)
  assert.match(grok, /AI_PROVIDER/)

  const liveEnv = readFileSync(new URL('../../.env.production', import.meta.url), 'utf8')
  assert.equal(liveEnv.includes('rocobdfuvaecrkzsxqub'), false)
})
