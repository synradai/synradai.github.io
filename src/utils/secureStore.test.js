import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ENC_PREFIX,
  VAULT_DB,
  cachedItem,
  decryptString,
  encryptString,
  generateVaultKey,
  isAppShellCache,
  isUserDataKey,
  isUserDatabase,
  openVault,
  protectForStorage,
  readStoredValue,
  sealVault,
  wipeUserData,
} from './secureStore.js'

describe('secure store', { concurrency: 1 }, () => {

test('AES-GCM round trip uses a non-extractable key', async () => {
  const key = await generateVaultKey()
  assert.equal(key.extractable, false)
  assert.equal(key.algorithm.name, 'AES-GCM')
  await assert.rejects(() => crypto.subtle.exportKey('raw', key))

  const secret = '{"id":"shift-1","notes":"north pit handover"}'
  const stored = await encryptString(key, secret)
  assert.equal(stored.startsWith(ENC_PREFIX), true)
  assert.equal(stored.includes('north pit'), false)
  assert.equal(await decryptString(key, stored), secret)

  const again = await encryptString(key, secret)
  assert.notEqual(again, stored)
  assert.equal(await decryptString(key, again), secret)
})

test('plaintext is flagged for migration and a bad ciphertext is unreadable', async () => {
  const key = await generateVaultKey()
  const legacy = await readStoredValue(key, '{"id":"old"}')
  assert.equal(legacy.migrate, true)
  assert.equal(legacy.value, '{"id":"old"}')

  const stored = await encryptString(key, 'keep me')
  const broken = stored.slice(0, -4) + 'AAAA'
  const failed = await readStoredValue(key, broken)
  assert.equal(failed.unreadable, true)
  assert.equal(failed.value, null)

  const other = await generateVaultKey()
  const wrongKey = await readStoredValue(other, stored)
  assert.equal(wrongKey.unreadable, true)
})

test('wipe removes Safe Intelligence user data and keeps the app shell', async () => {
  const local = memoryStorage({
    sa_current_shift: '{"id":"s"}',
    sa_shift_history: '[]',
    sa_incidents: '[{"id":"i"}]',
    sa_field_reports: '[]',
    sa_daily_log: '[]',
    sa_ask_chats: '[]',
    sa_known_people: '[]',
    sa_deident_terms: '{"company":"ACME"}',
    sa_api_key: 'sk-ant-secret',
    sa_known_companies: '[]',
    sa_incident_company: 'ACME',
    sa_field_report_company: 'ACME',
    sa_learnings: '[]',
    sa_ai_ack_v1: '1',
    'si-beta-hse-records-v1': '[{"id":"h"}]',
    sa_theme: 'dark',
    sa_onboarded: '1',
    si_build: '2026-10-19',
  })
  const session = memoryStorage({ 'si-beta-local-user': '{"id":"local"}', other: 'keep' })
  const deletedDatabases = []
  const indexedDB = {
    async databases() {
      return [{ name: VAULT_DB }, { name: 'si-beta-photos' }, { name: 'swingtrack' }]
    },
    deleteDatabase(name) {
      deletedDatabases.push(name)
      const request = {}
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  }
  const deletedCaches = []
  const caches = {
    async keys() {
      return [
        'workbox-precache-v2-https://synradai.github.io/',
        'google-fonts-css',
        'google-fonts-files',
        'si-user-photos',
      ]
    },
    async delete(name) {
      deletedCaches.push(name)
      return true
    },
  }

  await wipeUserData({ localStorage: local, sessionStorage: session, indexedDB, caches })

  for (const key of [
    'sa_current_shift', 'sa_shift_history', 'sa_incidents', 'sa_field_reports',
    'sa_daily_log', 'sa_ask_chats', 'sa_known_people', 'sa_deident_terms',
    'sa_api_key', 'sa_known_companies', 'sa_incident_company', 'sa_field_report_company',
    'sa_learnings', 'sa_ai_ack_v1', 'si-beta-hse-records-v1',
  ]) {
    assert.equal(local.getItem(key), null, key)
  }
  assert.equal(local.getItem('sa_theme'), 'dark')
  assert.equal(local.getItem('sa_onboarded'), '1')
  assert.equal(local.getItem('si_build'), '2026-10-19')
  assert.equal(session.getItem('si-beta-local-user'), null)
  assert.equal(session.getItem('other'), 'keep')
  assert.deepEqual(deletedDatabases.sort(), ['si-beta-photos', VAULT_DB].sort())
  assert.equal(deletedDatabases.includes('swingtrack'), false)
  assert.deepEqual(deletedCaches, ['si-user-photos'])
  assert.equal(isAppShellCache('workbox-precache-v2-https://synradai.github.io/'), true)
  assert.equal(isUserDatabase('swingtrack'), false)
  assert.equal(isUserDataKey('sa_theme'), false)
  assert.equal(isUserDataKey('si-beta-hse-records-v1'), true)
})

test('a locked vault refuses to persist user data in the clear', async () => {
  await sealVault(emptyEnv())
  await assert.rejects(() => protectForStorage('sa_incidents', '[]'), /vault locked/)
  assert.equal(cachedItem('sa_incidents'), null)
})

test('openVault migrates a session key per user and seals it', async () => {
  const env = emptyEnv()
  await openVault('user-a', env)
  const stored = await protectForStorage('sa_learnings', '[{"id":"l"}]')
  assert.equal(stored.startsWith(ENC_PREFIX), true)
  assert.equal(cachedItem('sa_learnings'), '[{"id":"l"}]')

  await openVault('user-b', env)
  assert.equal(cachedItem('sa_learnings'), null)

  await sealVault(env)
  await assert.rejects(() => protectForStorage('sa_learnings', '[]'), /vault locked/)
})

})

function emptyEnv() {
  return { localStorage: null, sessionStorage: null, indexedDB: null, caches: null }
}

function memoryStorage(initial) {
  const map = new Map(Object.entries(initial))
  return {
    get length() { return map.size },
    key(index) { return [...map.keys()][index] ?? null },
    getItem(key) { return map.has(key) ? map.get(key) : null },
    setItem(key, value) { map.set(key, String(value)) },
    removeItem(key) { map.delete(key) },
  }
}
