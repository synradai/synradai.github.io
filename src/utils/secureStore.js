import { STORAGE_KEYS } from '../constants.js'

// Device copy of Safe Intelligence records. The AES-GCM key is non-extractable
// and lives in IndexedDB for the signed-in user only. Sign-out, account
// deletion, and a user change delete the key and the records, so anything
// left behind cannot be read. A failed decrypt drops the local copy and the
// app fills it again from the server.

export const ENC_PREFIX = 'sienc1:'
export const VAULT_DB = 'si-vault'
const KEY_STORE = 'keys'
const OWNER_STORE = 'meta'
const OWNER_KEY = 'owner'

export const USER_DATA_KEYS = [
  STORAGE_KEYS.CURRENT_SHIFT,
  STORAGE_KEYS.HISTORY,
  STORAGE_KEYS.API_KEY,
  STORAGE_KEYS.LEARNINGS,
  STORAGE_KEYS.ASK_CHATS,
  STORAGE_KEYS.KNOWN_PEOPLE,
  STORAGE_KEYS.FIELD_REPORTS,
  STORAGE_KEYS.FIELD_REPORT_COMPANY,
  STORAGE_KEYS.INCIDENTS,
  STORAGE_KEYS.INCIDENT_COMPANY,
  STORAGE_KEYS.DEIDENT_TERMS,
  STORAGE_KEYS.DAILY_LOG,
  STORAGE_KEYS.KNOWN_COMPANIES,
  'si-beta-hse-records-v1',
  'si-beta-modules',
  'si-beta-site',
]

const SESSION_KEYS = ['si-beta-local-user']

export function isUserDataKey(key) {
  if (!key || typeof key !== 'string') return false
  if (USER_DATA_KEYS.includes(key)) return true
  if (key.startsWith('si-beta-')) return true
  if (key.startsWith('sa_ai_ack_')) return true
  return false
}

// Workbox precache and the font runtime caches are the app shell.
export function isAppShellCache(name) {
  return typeof name === 'string' && (
    name.startsWith('workbox-precache') ||
    name.startsWith('google-fonts-')
  )
}

export function isUserDatabase(name) {
  return name === VAULT_DB || (typeof name === 'string' && name.startsWith('si-'))
}

export function browserEnv() {
  return {
    localStorage: typeof localStorage !== 'undefined' ? localStorage : null,
    sessionStorage: typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    indexedDB: typeof indexedDB !== 'undefined' ? indexedDB : null,
    caches: typeof caches !== 'undefined' ? caches : null,
  }
}

let activeKey = null
let activeUserId = null
let acceptWrites = false
const memory = new Map()
const memoryKeys = new Map()

export function pauseWrites() {
  acceptWrites = false
}

export function vaultAcceptsWrites() {
  return acceptWrites
}

export function cachedItem(key) {
  return memory.has(key) ? memory.get(key) : null
}

export async function generateVaultKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptString(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(String(plaintext))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded))
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(iv, 0)
  packed.set(cipher, iv.length)
  return ENC_PREFIX + bytesToB64(packed)
}

export async function decryptString(key, payload) {
  if (typeof payload !== 'string' || !payload.startsWith(ENC_PREFIX)) {
    throw new Error('not encrypted')
  }
  const packed = b64ToBytes(payload.slice(ENC_PREFIX.length))
  if (packed.length < 13) throw new Error('truncated')
  const iv = packed.slice(0, 12)
  const cipher = packed.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}

// Plaintext (pre-encryption installs) comes back with migrate: true.
// A bad ciphertext comes back unreadable so the caller can drop it.
export async function readStoredValue(keyMaterial, raw) {
  if (raw == null) return { value: null }
  if (typeof raw !== 'string' || !raw.startsWith(ENC_PREFIX)) {
    return { value: raw, migrate: true }
  }
  try {
    return { value: await decryptString(keyMaterial, raw) }
  } catch {
    return { value: null, unreadable: true }
  }
}

export async function protectForStorage(storageKey, plaintext) {
  const text = String(plaintext)
  if (!isUserDataKey(storageKey)) {
    memory.set(storageKey, text)
    return text
  }
  if (!activeKey || !acceptWrites) {
    const err = new Error('vault locked')
    err.code = 'LOCKED'
    throw err
  }
  const stored = await encryptString(activeKey, text)
  memory.set(storageKey, text)
  return stored
}

export async function hydrateStored(storageKey, raw) {
  if (!isUserDataKey(storageKey)) {
    memory.set(storageKey, raw)
    return { value: raw }
  }
  if (!activeKey) return { value: null, locked: true }
  const result = await readStoredValue(activeKey, raw)
  memory.set(storageKey, result.unreadable ? null : result.value)
  return result
}

export function forgetMemory(key) {
  memory.set(key, null)
}

export async function openVault(userId, env = browserEnv()) {
  if (!userId) throw new Error('missing user')
  const owner = await readOwner(env)
  if (owner && owner !== userId) {
    acceptWrites = false
    activeKey = null
    activeUserId = null
    memory.clear()
    memoryKeys.clear()
    await wipeUserData(env)
  }
  const key = await loadOrCreateKey(userId, env)
  await writeOwner(userId, env)
  activeKey = key
  activeUserId = userId
  acceptWrites = true
  return key
}

export async function sealVault(env = browserEnv()) {
  acceptWrites = false
  activeKey = null
  activeUserId = null
  memory.clear()
  memoryKeys.clear()
  await wipeUserData(env)
}

export async function wipeUserData(env = browserEnv()) {
  const local = env.localStorage
  if (local) {
    const keys = collectKeys(local)
    for (const key of keys) {
      if (isUserDataKey(key)) local.removeItem(key)
    }
  }
  const session = env.sessionStorage
  if (session) {
    const keys = collectKeys(session)
    for (const key of keys) {
      if (SESSION_KEYS.includes(key) || (key && key.startsWith('si-beta-'))) session.removeItem(key)
    }
  }
  const idb = env.indexedDB
  if (idb) {
    const names = new Set([VAULT_DB])
    if (typeof idb.databases === 'function') {
      try {
        const dbs = await idb.databases()
        for (const db of dbs || []) {
          if (db?.name && isUserDatabase(db.name)) names.add(db.name)
        }
      } catch { /* still delete the vault we know about */ }
    }
    await Promise.all([...names].map((name) => deleteDatabase(idb, name)))
  }
  const cacheStore = env.caches
  if (cacheStore && typeof cacheStore.keys === 'function') {
    const names = await cacheStore.keys()
    await Promise.all(
      names.filter((name) => !isAppShellCache(name)).map((name) => cacheStore.delete(name)),
    )
  }
}

function collectKeys(storage) {
  const keys = []
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i))
  return keys
}

function bytesToB64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64ToBytes(b64) {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function deleteDatabase(idb, name) {
  return new Promise((resolve) => {
    let request
    try { request = idb.deleteDatabase(name) } catch { resolve(); return }
    if (!request) { resolve(); return }
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    request.onsuccess = done
    request.onerror = done
    request.onblocked = done
  })
}

function openVaultDb(idb) {
  return new Promise((resolve, reject) => {
    const request = idb.open(VAULT_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
      if (!db.objectStoreNames.contains(OWNER_STORE)) db.createObjectStore(OWNER_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet(db, store, key) {
  const tx = db.transaction(store, 'readonly')
  return idbRequest(tx.objectStore(store).get(key))
}

async function idbSet(db, store, key, value) {
  const tx = db.transaction(store, 'readwrite')
  await idbRequest(tx.objectStore(store).put(value, key))
}

async function readOwner(env) {
  const idb = env.indexedDB
  if (!idb) return memoryKeys.get(OWNER_KEY) || null
  try {
    const db = await openVaultDb(idb)
    try { return (await idbGet(db, OWNER_STORE, OWNER_KEY)) || null }
    finally { db.close() }
  } catch {
    return null
  }
}

async function writeOwner(userId, env) {
  const idb = env.indexedDB
  if (!idb) {
    memoryKeys.set(OWNER_KEY, userId)
    return
  }
  const db = await openVaultDb(idb)
  try { await idbSet(db, OWNER_STORE, OWNER_KEY, userId) }
  finally { db.close() }
}

async function loadOrCreateKey(userId, env) {
  const idb = env.indexedDB
  if (!idb) {
    if (memoryKeys.has(userId)) return memoryKeys.get(userId)
    const key = await generateVaultKey()
    memoryKeys.set(userId, key)
    return key
  }
  const db = await openVaultDb(idb)
  try {
    const existing = await idbGet(db, KEY_STORE, userId)
    if (existing) return existing
    const key = await generateVaultKey()
    await idbSet(db, KEY_STORE, userId, key)
    return key
  } finally {
    db.close()
  }
}
