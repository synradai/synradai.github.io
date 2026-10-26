import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
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
import { buildNoteRecord, buildRecord } from './record.js'
import { nameWarning } from './roles.js'
import { auditToCsv, filterAudit } from './audit.js'
import { buildActionRecord, canRemind, isOverdue, ownerChoices, reminderPatch, selectedOwner, sortActions, statusPatch } from './actions.js'
import { addDays, addHours, flagNotifiable, lodgementError, notifiableChecklist, readLodgement } from './notifiable.js'
import { buildHoursRecord, dashboardSummary, daysLost } from './dashboard.js'
import { investigationRows, signOffError } from './investigation.js'
import { leadCounts, weekStarting } from './leads.js'
import { recordDay, recordsForDay } from './day.js'
import { fileInspection } from './inspections.js'
import { errorReportCsv, guessMap, missingMapped, parseCsv, planImport } from './import.js'
import { isUuid, rowsForSite } from './ids.js'
import { buildPerson } from './people.js'
import { buildReportPdf } from './reportPdf.js'
import { buildTrainingRecord, matrixRows, personMatrix, personMatrixCsv, trainingFilters, trainingState } from './training.js'
import { projectRecord, recordsInRange, recordsToCsv } from './exportRecords.js'
import { injuryLabel, injuryPayload, mergeInjury, toPublicCase, absenceDays } from './injury.js'
import { linkPair, unlinkPair } from './links.js'
import { initialDraft, moduleRows, prepareConfig, resolveForm, resolveMatrix, resolveTemplates, resolveWording, visibleModules } from './config.js'
import { assessSubmission, buildStopAction, resolveQrForms, submissionsCsv, tooManySubmissions } from './qrForms.js'
import { authFlowForLocation, BETA_EMAIL_REDIRECT } from './supabase.js'
import { routeFromHash } from './routes.js'
import { redact } from './redact.js'
import { ENC_PREFIX, openVault, sealVault } from '../../src/utils/secureStore.js'
import { LOCAL_KEY, loadRows, mergeRows, saveRows, slimForCloud } from './store.js'
import { perthDateTimeLocal, shiftDate } from './time.js'
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
  assert.equal(routeFromHash('#/admin').screen, 'admin')
  assert.equal(routeFromHash('#/hse/day').screen, 'day')
  assert.equal(routeFromHash('#/hse/audit').screen, 'audit')
  assert.equal(routeFromHash('#/hse/investigate/abc').id, 'abc')
  assert.equal(routeFromHash('#/stores').screen, 'stores')
  assert.equal(routeFromHash('#/join').screen, 'home')
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
  assert.match(login, /type="password"/)
  assert.match(login, /Sign in/)
  assert.match(login, /signIn\(/)
  assert.equal(login.includes('Email me a 6-digit code'), false)
  assert.equal(login.includes('Forgot password'), false)
  assert.equal(login.includes('signInWithOtp'), false)
  assert.equal(login.includes('resetPasswordForEmail'), false)
  assert.equal(login.includes('authenticator'), false)
  const screen = readFileSync(new URL('../BetaApp.jsx', import.meta.url), 'utf8')
  assert.equal(screen.includes('TwoFactor'), false)
  assert.equal(screen.includes('mfaGate'), false)

  const migration = readFileSync(new URL('../../supabase/migrations/20261019060723_beta_hse_records.sql', import.meta.url), 'utf8')
  assert.match(migration, /org_id = public\.current_org_id\(\)/)
  assert.match(migration, /create table if not exists public\.hse_records/)
  assert.equal(migration.includes('trial_ends_at'), false)

  const grok = readFileSync(new URL('../../supabase/functions/generate-grok/index.ts', import.meta.url), 'utf8')
  assert.equal(grok.includes('trial_ends_at'), false)
  assert.equal(grok.includes('subscription_status'), false)
  assert.match(grok, /AI_PROVIDER/)
  assert.match(grok, /auth\.getUser\(\)/)
  assert.equal(grok.includes('requireAal2'), false)
  assert.match(grok, /https:\/\/api\.x\.ai\/v1\/responses/)
  assert.equal(grok.includes('/v1/chat/completions'), false)
  assert.match(grok, /bump_ai_usage/)
  assert.match(grok, /reasoning: \{ effort: REASONING_EFFORT \}/)

  const fnConfig = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
  assert.match(fnConfig, /\[functions\.generate-grok\]/)
  assert.match(fnConfig, /verify_jwt = false/)

  const state = readFileSync(new URL('../state.jsx', import.meta.url), 'utf8')
  assert.match(state, /await query/)
  assert.match(state, /onConflict: 'org_id,id'/)
  assert.match(state, /await openVault\([\s\S]*from\('hse_records'\)/)
  assert.equal(state.includes('mfaGate'), false)
  assert.equal(state.includes('getMfaGate'), false)
  assert.match(state, /signInWithPassword/)
  assert.equal(state.includes('signInWithOtp'), false)
  assert.equal(state.includes('resetPasswordForEmail'), false)
  assert.equal(state.includes('verifyOtp'), false)
  assert.equal(BETA_EMAIL_REDIRECT, 'https://synradai.github.io/beta/')
  assert.equal(authFlowForLocation('', '#access_token=abc&refresh_token=r&type=magiclink'), 'implicit')
  assert.equal(authFlowForLocation('?code=34e770dd-9ff9-416c-87fa-43b31d7ef225', ''), 'pkce')
  assert.equal(authFlowForLocation('', '#/'), 'implicit')
  const betaClient = readFileSync(new URL('./supabase.js', import.meta.url), 'utf8')
  assert.match(betaClient, /persistSession: true/)
  assert.match(state, /from\('app_config'\)/)
  assert.match(state, /from\('beta_admins'\)/)
  assert.match(state, /postgres_changes/)
  assert.match(state, /visibilitychange/)

  const admin = readFileSync(new URL('../components/Admin.jsx', import.meta.url), 'utf8')
  assert.equal(admin.includes('TwoFactorEnroll'), false)
  assert.equal(admin.includes('TwoFactorChallenge'), false)
  assert.equal(admin.includes('mfaGate'), false)
  assert.match(admin, /Reset to default/)
  assert.equal(admin.includes('Airtable'), false)
  assert.equal(admin.includes('MyOSH'), false)

  const adminSql = readFileSync(new URL('../../supabase/migrations/20261019235000_beta_admin_config.sql', import.meta.url), 'utf8')
  assert.match(adminSql, /create table if not exists public\.beta_admins/)
  assert.match(adminSql, /create table if not exists public\.app_config/)
  assert.match(adminSql, /trentrwood@outlook\.com/)
  assert.match(adminSql, /nextlevelaccess@outlook\.com/)
  assert.match(adminSql, /auth\.jwt\(\)->>'aal'\) = 'aal2'/)
  assert.match(adminSql, /audit_events/)
  assert.match(adminSql, /beta_private\.audit_app_config/)
  const adminSafe = readFileSync(new URL('../../supabase/migrations/20261020033000_grant_beta_admin_safe.sql', import.meta.url), 'utf8')
  assert.match(adminSafe, /exception/)
  assert.match(adminSafe, /return new/)
  assert.doesNotMatch(adminSql, /create policy require_aal2/)
  assert.equal(adminSql.includes('rgkiagqexoafmtxhrlqo'), false)
  const dropAal = readFileSync(new URL('../../supabase/migrations/20261025120000_drop_admin_aal2.sql', import.meta.url), 'utf8')
  assert.match(dropAal, /public\.is_beta_admin\(\)/)
  assert.match(dropAal, /app_config_insert/)
  assert.match(dropAal, /app_config_update/)
  assert.match(dropAal, /app_config_delete/)
  assert.equal(dropAal.includes('aal2'), false)
  assert.equal(dropAal.includes('rgkiagqexoafmtxhrlqo'), false)

  const deploy = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')
  assert.ok(deploy.indexOf('npm run build') < deploy.indexOf('npm run build:beta'))
  assert.match(deploy, /cp -a dist-beta\/\. dist\/beta\//)
  assert.match(deploy, /VITE_SUPABASE_URL: https:\/\/rocobdfuvaecrkzsxqub\.supabase\.co/)
  assert.match(deploy, /VITE_AI_PROXY_URL: https:\/\/rocobdfuvaecrkzsxqub\.supabase\.co\/functions\/v1\/generate-grok/)
  assert.equal(deploy.includes('rgkiagqexoafmtxhrlqo'), false)

  const migrations = readdirSync(new URL('../../supabase/migrations/', import.meta.url))
  const orgKey = migrations.find((name) => name.endsWith('_hse_records_unique_per_org.sql'))
  assert.ok(orgKey)
  const orgSql = readFileSync(new URL(`../../supabase/migrations/${orgKey}`, import.meta.url), 'utf8')
  assert.match(orgSql, /primary key \(org_id, id\)/)

  const liveEnv = readFileSync(new URL('../../.env.production', import.meta.url), 'utf8')
  assert.equal(liveEnv.includes('rocobdfuvaecrkzsxqub'), false)
})

test('admin config falls back to code and keeps locked fields', () => {
  const wording = resolveWording(null)
  assert.equal(wording.homeTitle, 'Safe Intelligence')
  assert.equal(resolveWording({ homeTitle: 'Night board' }).homeTitle, 'Night board')
  assert.equal(resolveWording({ homeTitle: '' }).homeTitle, '')

  const rows = moduleRows([{ id: 'stores', enabled: false, order: 0, label: 'Cage' }, { id: 'hse', enabled: false, order: 5, label: 'Events' }])
  const hse = rows.find((row) => row.id === 'hse')
  assert.equal(hse.adminEnabled, true)
  assert.equal(hse.label, 'Events')
  const stores = rows.find((row) => row.id === 'stores')
  assert.equal(stores.adminEnabled, false)
  assert.equal(stores.label, 'Cage')
  assert.equal(visibleModules(rows, { stores: true }).some((row) => row.id === 'stores'), false)
  assert.equal(visibleModules(moduleRows(null), { scaffold: false }).some((row) => row.id === 'scaffold'), false)
  assert.equal(rows[0].id, 'stores')

  const saved = {
    incident: {
      label: 'Event',
      fields: [
        { key: 'incidentType', label: 'Type', options: ['Near miss', 'Spill'] },
        { key: 'witnesses', hidden: true },
        { key: 'x_shift', label: 'Shift', type: 'text', custom: true },
      ],
    },
  }
  const form = resolveForm('incident', saved)
  assert.equal(form.label, 'Event')
  assert.ok(form.fields.some((field) => field.key === 'actualSeverity'))
  assert.ok(form.fields.some((field) => field.key === 'notifiable'))
  assert.equal(form.fields.some((field) => field.key === 'witnesses'), false)
  assert.equal(form.fields.find((field) => field.key === 'incidentType').options.map((option) => option.value).join(','), 'Near miss,Spill')
  assert.ok(form.fields.some((field) => field.key === 'x_shift'))

  const round = prepareConfig('forms', initialDraft('forms', null))
  assert.deepEqual(resolveForm('hazard', round).fields.map((field) => field.key), getForm('hazard').fields.map((field) => field.key))
  const modules = prepareConfig('modules', initialDraft('modules', [{ id: 'hse', label: 'Events', enabled: false, order: 3 }]))
  assert.equal(modules.find((row) => row.id === 'hse').enabled, true)
  assert.equal(resolveTemplates(null)[0].name, 'Workplace walk')
  assert.equal(resolveMatrix({ columns: ['First aid'] }).columns[0], 'First aid')
  assert.throws(() => prepareConfig('training_matrix', { columns: ['  '] }), /column/)
  assert.equal(prepareConfig('inspection_templates', initialDraft('inspection_templates', null)).length, 2)
})

test('a day timeline keeps the selected date and short notes', () => {
  assert.equal(shiftDate('2026-10-19', 1), '2026-10-20')
  assert.equal(shiftDate('2026-10-01', -1), '2026-09-30')
  const incident = buildRecord({ id: 'day-1', kind: 'incident', fields: { severity: 1, description: 'Oil', occurredAt: '2026-10-19T09:15', siteArea: 'Workshop', peopleRoles: 'Fitter' } })
  const other = buildRecord({ id: 'day-2', kind: 'hazard', fields: { severity: 2, description: 'Next day', occurredAt: '2026-10-20T07:00', siteArea: 'Yard', peopleRoles: 'Crew' } })
  const meeting = buildNoteRecord({ id: 'day-3', kind: 'meeting', fields: { title: 'Prestart meeting', note: 'Heat', occurredAt: '2026-10-19T06:30' } })
  assert.equal(meeting.kind, 'meeting')
  assert.equal(meeting.status, 'filed')
  assert.equal(recordDay(incident), '2026-10-19')
  assert.equal(recordDay({ createdAt: '2026-10-18T16:30:00.000Z', fields: {} }), '2026-10-19')
  const day = recordsForDay([other, incident, meeting], '2026-10-19')
  assert.deepEqual(day.map((row) => row.id), ['day-3', 'day-1'])
})

test('a notifiable incident keeps the lodgement on the record and does not send it', () => {
  const incident = buildRecord({
    id: 'evt-n',
    kind: 'incident',
    fields: { severity: 2, actualSeverity: 2, potentialSeverity: 2, description: 'Spill', occurredAt: '2026-10-18T10:00', siteArea: 'Tank', peopleRoles: 'Operator', notifiable: 'No' },
  })
  assert.equal(incident.notifiable, false)
  const flagged = { ...incident, ...flagNotifiable(incident) }
  assert.equal(flagged.notifiable, true)
  assert.equal(flagged.severity, 4)
  assert.equal(flagged.path, 'escalate')
  assert.equal(flagged.fields.notifiable, 'Yes')
  assert.equal(addHours('2026-10-18T10:00', 48), '2026-10-20T10:00')
  assert.equal(addDays('2026-10-18T10:00', 21), '2026-11-08')
  const lodged = readLodgement({ ...flagged, lodgement: { writtenRequested: true, dangerousGoods: true } })
  const items = notifiableChecklist(flagged, lodged, '2026-10-21')
  assert.equal(items.find((item) => item.id === 'written').overdue, true)
  assert.equal(items.find((item) => item.id === 'dg').deadline.includes('2026-11-08'), true)
  assert.match(lodgementError({ reference: 'WS-1', lodgedOn: '', lodgedBy: '' }), /date/)
  assert.equal(lodgementError({ reference: 'WS-1', lodgedOn: '2026-10-18', lodgedBy: 'Supervisor' }), '')
  assert.equal(reportingFor('general').lodgeUrl, 'https://www.worksafe.wa.gov.au/report-incident')
})

test('actions link both records and overdue is calculated', () => {
  const incident = buildRecord({ id: 'evt-1', kind: 'hazard', fields: { severity: 2, description: 'Oil', occurredAt: '2026-10-19T09:15', siteArea: 'Workshop', peopleRoles: 'Fitter' } })
  const action = buildActionRecord({ id: 'act-1', fields: { title: 'Isolate the leak', owner: 'Supervisor', due: '2026-10-18' } })
  assert.equal(action.kind, 'action')
  assert.equal(action.status, 'open')
  assert.throws(() => buildActionRecord({ fields: { title: 'x', owner: '', due: '2026-10-18' } }), /owner/)
  const linked = linkPair([incident, action], incident.id, action.id)
  assert.equal(linked.find((row) => row.id === 'evt-1').links[0].id, 'act-1')
  assert.equal(linked.find((row) => row.id === 'act-1').links[0].kind, 'hazard')
  assert.equal(linkPair(linked, 'evt-1', 'act-1').find((row) => row.id === 'act-1').links.length, 1)
  assert.equal(isOverdue(action, '2026-10-19'), true)
  assert.equal(isOverdue({ ...action, status: 'done' }, '2026-10-19'), false)
  assert.equal(isOverdue(action, '2026-10-18'), false)
  assert.equal(canRemind(action, '2026-10-19'), true)
  assert.equal(canRemind({ ...action, ...reminderPatch(action, '2026-10-19') }, '2026-10-19'), false)
  assert.equal(canRemind(action, '2026-10-18'), false)
  const owned = buildActionRecord({ id: 'act-owned', fields: { title: 'Check the guard', owner: 'Alex', ownerId: 'user-1', due: '2026-10-18' } })
  assert.equal(owned.fields.ownerId, 'user-1')
  assert.deepEqual(ownerChoices([], { id: 'local', email: 'On this device' }), [{ id: 'local', name: 'On this device' }])
  assert.equal(selectedOwner([{ id: 'user-1', name: 'Alex' }, { id: 'user-2', name: 'Sam' }], null, 'user-2').name, 'Sam')
  const cleared = unlinkPair(linked, 'evt-1', 'act-1')
  assert.equal(cleared.find((row) => row.id === 'evt-1').links.length, 0)
  assert.equal(cleared.find((row) => row.id === 'act-1').links.length, 0)
  const done = buildActionRecord({ id: 'act-2', fields: { title: 'Later', owner: 'Crew', due: '2026-10-21', status: 'done' } })
  assert.deepEqual(sortActions([done, action], '2026-10-19').map((row) => row.id), ['act-1', 'act-2'])
  assert.equal(routeFromHash('#/hse/actions').screen, 'actions')
})

test('a date-range export keeps injury names out and keeps the case id', () => {
  const incident = buildRecord({ id: 'evt-9', kind: 'incident', fields: { severity: 2, description: 'Oil on the floor', occurredAt: '2026-10-19T09:00', siteArea: 'Workshop', peopleRoles: 'Fitter' } })
  const other = buildRecord({ id: 'evt-8', kind: 'hazard', fields: { severity: 1, description: 'Next', occurredAt: '2026-10-21T09:00', siteArea: 'Yard', peopleRoles: 'Crew' } })
  const ranged = recordsInRange([other, incident], '2026-10-19', '2026-10-19')
  assert.deepEqual(ranged.map((row) => row.id), ['evt-9'])
  const projected = projectRecord(incident, [{ id: 'c1', eventId: 'evt-9', caseCode: 'INJ-0007', classification: 'LTI', status: 'open', personName: 'Secret Person', treatment: 'clinic' }])
  const csv = recordsToCsv([projected])
  assert.match(csv, /INJ-0007/)
  assert.match(csv, /Oil on the floor/)
  assert.equal(csv.includes('Secret Person'), false)
  assert.equal(csv.includes('clinic'), false)
})

test('the dashboard counts incidents, rates, and hours in the selected range', () => {
  const incident = buildRecord({ id: 'inc-1', kind: 'incident', fields: { severity: 3, description: 'Slip', occurredAt: '2026-10-12T09:00', siteArea: 'Workshop', peopleRoles: 'Fitter', incidentType: 'Injury / illness', actualSeverity: 3, potentialSeverity: 3 } })
  const other = buildRecord({ id: 'inc-2', kind: 'incident', fields: { severity: 1, description: 'Spill', occurredAt: '2026-09-02T09:00', siteArea: 'Yard', peopleRoles: 'Crew', incidentType: 'Environmental', actualSeverity: 1, potentialSeverity: 1 } })
  const action = buildActionRecord({ id: 'act-1', fields: { title: 'Clean up', owner: 'Crew', due: '2026-10-01', status: 'open' } })
  action.fields.siteArea = 'Workshop'
  const hours = buildHoursRecord({ id: 'hrs-1', fields: { from: '2026-10-01', to: '2026-10-31', hours: 200000, siteArea: 'Workshop' } })
  const summary = dashboardSummary(
    [incident, other, action, hours],
    [{ id: 'c1', caseCode: 'INJ-0001', eventId: 'inc-1', classification: 'LTI', status: 'open', restrictedFrom: '2026-10-12', createdAt: '2026-10-12T00:00:00.000Z' }],
    { from: '2026-10-01', to: '2026-10-31', site: 'Workshop', today: '2026-10-20', columns: ['First aid'] },
  )
  assert.equal(summary.incidents.total, 1)
  assert.equal(summary.incidents.byType[0].label, 'Injury / illness')
  assert.equal(summary.incidents.byMonth[0].label, '2026-10')
  assert.equal(summary.actions.overdue, 1)
  assert.equal(summary.injury.LTI, 1)
  assert.equal(daysLost({ classification: 'LTI', restrictedFrom: '2026-10-12', rtwOn: '2026-10-15' }, '2026-10-20'), 3)
  assert.equal(summary.injury.hours, 200000)
  assert.equal(summary.injury.ltifr, 5)
  assert.equal(summary.injury.trifr, 5)
  assert.equal(routeFromHash('#/hse/dashboard').screen, 'dashboard')
})

test('an ICAM corrective action is linked back to the incident', () => {
  const incident = buildRecord({ id: 'inc-9', kind: 'incident', fields: { severity: 4, description: 'Fall', occurredAt: '2026-10-12T09:00', siteArea: 'Tank', peopleRoles: 'Rigger', incidentType: 'Injury / illness', actualSeverity: 4, potentialSeverity: 4 } })
  const investigation = { team: [{ name: 'Ada', role: 'Lead' }], defences: 'No edge protection', root: 'No standard for the task' }
  assert.equal(signOffError(investigation), 'Add the role signing this off.')
  const rows = investigationRows(incident, investigation, { title: 'Fit edge protection', owner: 'Supervisor', due: '2026-10-20' })
  const savedIncident = rows.find((row) => row.id === 'inc-9')
  const action = rows.find((row) => row.kind === 'action')
  assert.equal(savedIncident.links.some((link) => link.id === action.id), true)
  assert.equal(action.links.some((link) => link.id === 'inc-9'), true)
  assert.equal(action.fields.siteArea, 'Tank')
})

test('lead counts use the Perth week and on-time closures', () => {
  assert.equal(weekStarting('2026-10-19'), '2026-10-19')
  assert.equal(weekStarting('2026-10-18'), '2026-10-12')
  const rows = [
    { id: 'p', kind: 'prestart', fields: { occurredAt: '2026-10-19T06:00' } },
    { id: 'h', kind: 'hazard', fields: { occurredAt: '2026-10-20T09:00' } },
    { id: 'a', kind: 'action', status: 'done', fields: { due: '2026-10-21', closedOn: '2026-10-20' } },
    { id: 'late', kind: 'action', status: 'done', fields: { due: '2026-10-18', closedOn: '2026-10-20' } },
  ]
  const counts = leadCounts(rows, '2026-10-19')
  assert.equal(counts.prestart, 1)
  assert.equal(counts.observation, 1)
  assert.equal(counts.toolbox, 0)
  assert.equal(counts.onTime, 1)
  assert.equal(counts.end, '2026-10-25')
  const done = statusPatch({ fields: { due: '2026-10-21' } }, 'done', '2026-10-19')
  assert.equal(done.fields.closedOn, '2026-10-19')
  assert.equal(statusPatch(done, 'open', '2026-10-19').fields.closedOn, undefined)
})

test('the training matrix marks missing and expired courses as gaps', () => {
  const current = buildTrainingRecord({ id: 'tr-1', fields: { person: 'Sam', role: 'Fitter', course: 'First aid', completed: '2026-01-01', expiry: '2027-01-01', siteArea: 'Workshop' } })
  const expiring = buildTrainingRecord({ id: 'tr-2', fields: { person: 'Jo', role: 'Fitter', course: 'White card', completed: '2026-09-01', expiry: '2026-11-01', siteArea: 'Workshop' } })
  const expired = buildTrainingRecord({ id: 'tr-3', fields: { person: 'Jo', role: 'Operator', course: 'First aid', completed: '2024-01-01', expiry: '2025-01-01', siteArea: 'Yard' } })
  assert.throws(() => buildTrainingRecord({ fields: { person: 'Sam', role: 'Fitter', course: 'First aid', completed: '2026-01-01' } }), /site/)
  assert.equal(trainingState(current, '2026-10-19'), 'current')
  assert.equal(trainingState(expiring, '2026-10-19'), 'expiring')
  assert.equal(trainingState(expired, '2026-10-19'), 'expired')
  const grid = matrixRows([current, expiring, expired], ['First aid', 'White card', 'Confined space'], '2026-10-19')
  const fitter = grid.find((row) => row.role === 'Fitter')
  const operator = grid.find((row) => row.role === 'Operator')
  assert.deepEqual(fitter.cells, ['covered', 'expiring', 'gap'])
  assert.deepEqual(operator.cells, ['gap', 'gap', 'gap'])
  const workshop = buildTrainingRecord({ id: 'tr-4', fields: { person: 'Sam', role: 'Fitter', course: 'First aid', completed: '2026-01-01', expiry: '2027-01-01', siteArea: 'Workshop' } })
  const yard = buildTrainingRecord({ id: 'tr-5', fields: { person: 'Sam', role: 'Operator', course: 'White card', completed: '2026-01-01', expiry: '2025-01-01', siteArea: 'Yard' } })
  assert.equal(workshop.fields.siteArea, 'Workshop')
  const people = personMatrix([current, expiring, expired, workshop, yard], ['First aid', 'White card', 'Confined space'], '2026-10-19')
  assert.deepEqual(people.map((row) => row.person), ['Jo', 'Sam'])
  assert.equal(people.find((row) => row.person === 'Sam').cells[0].state, 'current')
  assert.equal(people.find((row) => row.person === 'Jo').cells[2].state, 'missing')
  assert.equal(people.find((row) => row.person === 'Jo').cells[2].id, '')
  const atYard = personMatrix([workshop, yard], ['First aid', 'White card'], '2026-10-19', { site: 'Yard', role: 'Operator' })
  assert.equal(atYard.length, 1)
  assert.deepEqual(atYard[0].cells.map((cell) => cell.state), ['missing', 'expired'])
  assert.equal(atYard[0].cells[1].id, 'tr-5')
  assert.deepEqual(trainingFilters([workshop, yard]).sites, ['Workshop', 'Yard'])
  const csv = personMatrixCsv(atYard, ['First aid', 'White card'])
  assert.match(csv, /Person,First aid,White card/)
  assert.match(csv, /Sam,Missing,Expired/)
  assert.equal(routeFromHash('#/training').screen, 'training')
})

test('a failed inspection item opens a linked action', () => {
  const rows = fileInspection({
    id: 'insp-1',
    fields: { templateId: 'workplace', title: 'Workplace walk', owner: 'Supervisor', due: '2026-10-21', occurredAt: '2026-10-19T07:00' },
    checks: [
      { id: 'ppe', label: 'PPE matches the task', result: 'fail', note: 'Torn glove' },
      { id: 'plant', label: 'Plant is parked', result: 'pass', note: '' },
      { id: 'exits', label: 'Exits are clear', result: 'na', note: '' },
    ],
  })
  const inspection = rows.find((row) => row.kind === 'inspection')
  const actions = rows.filter((row) => row.kind === 'action')
  assert.equal(actions.length, 1)
  assert.equal(actions[0].fields.title, 'Fix: PPE matches the task')
  assert.equal(actions[0].fields.owner, 'Supervisor')
  assert.equal(actions[0].links[0].id, 'insp-1')
  assert.equal(inspection.links[0].id, actions[0].id)
  assert.equal(inspection.fields.note, '1 item failed')
  assert.throws(() => fileInspection({
    fields: { templateId: 'workplace', title: 'Walk', owner: '', due: '' },
    checks: [{ id: 'ppe', label: 'PPE', result: 'fail' }],
  }), /owner/)
  assert.equal(routeFromHash('#/hse/inspections').screen, 'inspections')
})

test('injury names stay off the public case and the audit brief', () => {
  const secret = { id: 'c1', case_code: 'INJ-0004', event_id: 'evt', classification: 'LTI', status: 'restricted', person_name: 'Secret Person', treatment: 'clinic', note: 'private note' }
  const pub = toPublicCase(secret)
  assert.equal(pub.caseCode, 'INJ-0004')
  assert.equal(Object.hasOwn(pub, 'personName'), false)
  assert.equal(injuryLabel({ ...pub, personName: 'Secret Person' }).includes('Secret'), false)
  const merged = mergeInjury([secret], [{ ...secret, person_name: 'Secret Person' }])
  assert.equal(merged[0].private, true)
  assert.equal(merged[0].personName, 'Secret Person')
  const indexOnly = mergeInjury([secret], [])
  assert.equal(indexOnly[0].private, false)
  assert.equal(JSON.stringify(indexOnly).includes('Secret'), false)
  assert.equal(JSON.stringify(toPublicCase({ ...secret, mechanism: 'caught between', duties: 'light duties' })).includes('caught'), false)
  assert.equal(absenceDays({ classification: 'LTI', restrictedFrom: '2026-10-12', rtwOn: '2026-10-15' }, '2026-10-20').lost, 3)
  assert.equal(injuryPayload({ eventId: 'evt', personName: 'Ada', classification: 'FAI', restrictedFrom: '' }).restricted_from, null)
  assert.equal(routeFromHash('#/hse/injury/c1').screen, 'injury')
  assert.equal(routeFromHash('#/hse/injury/c1').id, 'c1')

  const sql = readFileSync(new URL('../../supabase/migrations/20261020002000_injury_cases.sql', import.meta.url), 'utf8')
  assert.match(sql, /injury_case_index/)
  assert.match(sql, /profiles\.role = admin|role = 'admin'/)
  assert.match(sql, /case_code/)
  const brief = sql.slice(sql.indexOf('function beta_private.injury_brief'), sql.indexOf('function beta_private.audit_injury_case'))
  assert.equal(brief.includes('person_name'), false)
  assert.equal(brief.includes('treatment'), false)
  assert.equal(sql.includes('rgkiagqexoafmtxhrlqo'), false)
  assert.equal(sql.includes('require_aal2'), false)
})

test('audit filters by day and action and the csv stays a summary', () => {
  const events = [
    { id: 1, created_at: '2026-10-18T16:30:00.000Z', action: 'create', entity: 'hse_records', entity_id: 'a', summary: 'Created incident · Workshop', actor_id: 'u1', before: null, after: { kind: 'incident', label: 'Workshop' } },
    { id: 2, created_at: '2026-10-19T02:00:00.000Z', action: 'delete', entity: 'hse_records', entity_id: 'b', summary: 'Deleted hazard', actor_id: 'u1' },
  ]
  assert.equal(filterAudit(events, { day: '2026-10-19', action: 'create' }).length, 1)
  assert.equal(filterAudit(events, { action: 'delete' })[0].id, 2)
  const csv = auditToCsv(filterAudit(events, { action: 'create' }))
  assert.match(csv, /Created incident/)
  assert.equal(csv.includes('Deleted hazard'), false)
  assert.equal(csv.includes('description'), false)

  const sql = readFileSync(new URL('../../supabase/migrations/20261020001000_hse_record_audit.sql', import.meta.url), 'utf8')
  assert.match(sql, /after insert or update or delete on public\.hse_records/)
  assert.match(sql, /action = 'export'/)
  assert.match(sql, /hse_record_brief/)
  assert.equal(sql.includes('fields,description'), false)
  assert.equal(sql.includes('rgkiagqexoafmtxhrlqo'), false)
})

test('beta records round-trip through the device vault', async () => {
  const store = new Map()
  const local = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size },
  }
  const previous = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true })
  const env = { localStorage: local, sessionStorage: null, indexedDB: null, caches: null }
  try {
    await openVault('beta-user', env)
    await saveRows([{ id: 'rec-1', kind: 'incident', updatedAt: '2026-10-19T00:00:00.000Z' }])
    const raw = local.getItem(LOCAL_KEY)
    assert.equal(typeof raw, 'string')
    assert.ok(raw.startsWith(ENC_PREFIX))
    assert.equal(raw.includes('rec-1'), false)
    assert.equal(loadRows()[0].id, 'rec-1')
  } finally {
    await sealVault(env)
    Object.defineProperty(globalThis, 'localStorage', { value: previous, configurable: true })
  }
})

test('sites scope records and a csv import reports the bad rows', () => {
  assert.equal(routeFromHash('#/import').screen, 'import')
  assert.equal(routeFromHash('#/setup').screen, 'setup')
  const siteA = '11111111-1111-4111-8111-111111111111'
  const visible = rowsForSite([
    { id: '1', siteId: siteA },
    { id: '2', siteId: '22222222-2222-4222-8222-222222222222' },
    { id: '3' },
  ], siteA)
  assert.deepEqual(visible.map((row) => row.id), ['1', '3'])
  assert.equal(isUuid(siteA), true)
  assert.equal(isUuid('local-main'), false)

  const parsed = parseCsv('\uFEFFperson,role,course,expiry\n"Wood, Sam",Fitter,White card,2026-12-01\n,Fitter,White card,nope\n')
  assert.deepEqual(parsed.headers, ['person', 'role', 'course', 'expiry'])
  assert.equal(parsed.rows[0][0], 'Wood, Sam')
  const map = guessMap(parsed.headers, 'training')
  assert.equal(map.person, 0)
  assert.equal(map.course, 2)
  assert.deepEqual(missingMapped('training', map), [])
  const planned = planImport({
    target: 'training',
    headers: parsed.headers,
    rows: parsed.rows,
    map,
    siteName: 'Yard',
    siteId: siteA,
    ruleset: 'general',
  })
  assert.equal(planned[0].error, '')
  assert.equal(planned[0].record.fields.siteArea, 'Yard')
  assert.equal(planned[0].record.siteId, siteA)
  assert.match(planned[1].error, /person|date/i)
  const report = errorReportCsv(parsed.headers, planned)
  assert.match(report, /row,error,person/)
  assert.match(report, /Add the person/)

  const incidents = planImport({
    target: 'incidents',
    headers: ['description', 'actual', 'potential'],
    rows: [['Dropped tube', '9', '2'], ['', '2', '2']],
    map: guessMap(['description', 'actual', 'potential'], 'incidents'),
    siteName: 'Yard',
    siteId: siteA,
  })
  assert.match(incidents[0].error, /1 to 5/)
  assert.match(incidents[1].error, /description/i)

  const person = buildPerson({ siteId: siteA, fields: { fullName: 'Sam Wood', role: 'Fitter' } })
  assert.equal(person.siteId, siteA)
  assert.equal(isUuid(person.id), true)

  const doc = buildReportPdf({ title: 'Register', clientName: 'Acme', blocks: [] })
  assert.ok(doc.output('arraybuffer').byteLength > 500)
  const plain = buildReportPdf({ title: 'Register', logo: 'data:image/png;base64,aaaa', blocks: [] })
  assert.ok(plain.output('arraybuffer').byteLength > 500)

  const sql = readFileSync(new URL('../../supabase/migrations/20261025030000_sites_import.sql', import.meta.url), 'utf8')
  assert.match(sql, /org_id = public\.current_org_id\(\)/)
  assert.match(sql, /create table if not exists public\.sites/)
  assert.match(sql, /create table if not exists public\.people/)
  assert.match(sql, /site-logos/)
  assert.match(sql, /beta_private\.create_default_site/)
  assert.match(sql, /Main site/)
  assert.equal(sql.includes('rgkiagqexoafmtxhrlqo'), false)

  const state = readFileSync(new URL('../state.jsx', import.meta.url), 'utf8')
  assert.match(state, /site_id: isUuid\(row\.siteId\)/)
  assert.match(state, /from\('sites'\)/)
  assert.match(state, /from\('people'\)/)
  const shell = readFileSync(new URL('../components/Shell.jsx', import.meta.url), 'utf8')
  assert.match(shell, /aria-label="Site"/)
  const screen = readFileSync(new URL('../components/Import.jsx', import.meta.url), 'utf8')
  assert.match(screen, /The token is sent once to import a copy\. It is not saved\./)
  assert.match(screen, /Download error report/)
  const pdf = readFileSync(new URL('./pdfExport.js', import.meta.url), 'utf8')
  assert.equal(pdf.includes('src/utils/pdf'), false)
  assert.match(pdf, /reportPdf/)
  const livePdf = readFileSync(new URL('../../src/utils/pdf.js', import.meta.url), 'utf8')
  assert.equal(livePdf.includes('clientName'), false)
  const fn = readFileSync(new URL('../../supabase/functions/airtable-import/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /auth\.getUser\(\)/)
  assert.equal(fn.includes('requireAal2'), false)
  assert.match(fn, /https:\/\/api\.airtable\.com/)
  const reminder = readFileSync(new URL('../../supabase/functions/action-reminder/index.ts', import.meta.url), 'utf8')
  assert.match(reminder, /auth\.getUser\(\)/)
  assert.equal(reminder.includes('requireAal2'), false)
  assert.equal(fn.includes('console.log'), false)
  assert.match(fn, /not saved/)
  const fnConfig = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
  assert.match(fnConfig, /\[functions\.airtable-import\]/)
})

test('a critical No on a QR form stops the job and N/A does not', () => {
  assert.equal(routeFromHash('#/f/abc').screen, 'public-form')
  assert.equal(routeFromHash('#/f/abc').token, 'abc')
  assert.equal(routeFromHash('#/hse/forms').screen, 'forms')
  assert.equal(routeFromHash('#/hse/forms/codes').screen, 'form-codes')
  assert.equal(routeFromHash('#/hse/forms/sub-1').screen, 'form-detail')

  const forms = resolveQrForms(null)
  const take5 = forms.find((form) => form.id === 'take5')
  const prestart = forms.find((form) => form.id === 'prestart')
  assert.equal(prestart.questions.some((question) => question.label === 'Odometer (km)' && question.required === false), true)
  assert.equal(prestart.questions.some((question) => question.label === 'Engine hours' && question.required === false), true)
  assert.match(prestart.questions.find((question) => question.id === 'km').help, /kilometres, engine hours, or both/)

  const answers = {}
  for (const question of take5.questions) {
    if (question.type === 'ynna') answers[question.id] = 'yes'
    else if (question.required) answers[question.id] = 'Weld'
  }
  answers.stopped = 'no'
  const stopped = assessSubmission(take5, answers, 'Sam')
  assert.equal(stopped.stopped, true)
  assert.equal(stopped.failed.some((item) => item.id === 'stopped'), true)
  answers.stopped = 'na'
  const cleared = assessSubmission(take5, answers, 'Sam')
  assert.equal(cleared.stopped, false)
  assert.equal(cleared.errors.length, 0)
  assert.match(assessSubmission(take5, answers, '  ').errors[0], /name/)
  delete answers.task
  assert.match(assessSubmission(take5, answers, 'Sam').errors[0], /task/i)

  const saved = prepareConfig('qr_forms', initialDraft('qr_forms', null))
  assert.equal(saved.find((form) => form.id === 'prestart').questions.some((question) => question.label === 'Engine hours'), true)
  const again = prepareConfig('qr_forms', initialDraft('qr_forms', saved))
  assert.deepEqual(again, saved)
  assert.throws(() => prepareConfig('qr_forms', [{ id: 'x', title: 'Blank', questions: [] }]), /question/)

  const action = buildStopAction({
    submissionId: 's1',
    formTitle: 'Take 5',
    label: 'Yard',
    personName: 'Sam',
    failed: stopped.failed,
    supervisorName: 'Alex',
    siteId: 'site-1',
  })
  assert.equal(action.kind, 'action')
  assert.equal(action.fields.owner, 'Alex')
  assert.equal(action.fields.emailHook, 'pending')
  assert.match(action.fields.title, /Stop the job/)
  assert.equal(tooManySubmissions([{ qrId: 'q', createdAt: new Date().toISOString() }], 'q'), false)
  assert.match(submissionsCsv([{ ...action, formTitle: 'Take 5', personName: 'Sam', stopped: true, failed: stopped.failed, createdAt: '2026-10-25' }]), /stopped/)

  const sql = readFileSync(new URL('../../supabase/migrations/20261025043000_qr_forms.sql', import.meta.url), 'utf8')
  assert.match(sql, /create table if not exists public\.qr_codes/)
  assert.match(sql, /'form', 'register', 'vehicle', 'document'/)
  assert.match(sql, /qr_forms/)
  assert.match(sql, /supervisor_id/)
  assert.match(sql, /form-evidence/)
  assert.match(sql, /auth\.role\(\) = 'service_role'/)
  assert.equal(sql.includes('rgkiagqexoafmtxhrlqo'), false)

  const fn = readFileSync(new URL('../../supabase/functions/submit-form/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /rgkiagqexoafmtxhrlqo/)
  assert.equal(fn.includes('requireAal2'), false)
  assert.equal(fn.includes('console.log'), false)
  assert.match(fn, /RESEND_API_KEY/)
  assert.match(fn, /emailHook/)
  assert.match(fn, /Odometer \(km\)/)
  assert.match(fn, /Engine hours/)
  assert.equal(fn.includes('api.resend.com'), false)
  const toml = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
  assert.match(toml, /\[functions\.submit-form\]\s+verify_jwt = false/)
  const livePdf = readFileSync(new URL('../../src/utils/pdf.js', import.meta.url), 'utf8')
  assert.equal(livePdf.includes('clientName'), false)
})
