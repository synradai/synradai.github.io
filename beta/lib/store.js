import { cachedItem } from '../../src/utils/secureStore.js'
import { safeSetItem } from '../../src/utils/storage.js'

export const LOCAL_KEY = 'si-beta-hse-records-v1'
export const MODULE_KEY = 'si-beta-modules'
export const SITE_KEY = 'si-beta-site'

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback
  try {
    const value = JSON.parse(raw)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

// Reads the decrypted session cache. Call only after the vault is open.
export function loadJson(key, fallback) {
  return parseJson(cachedItem(key), fallback)
}

export function loadRows() {
  const rows = loadJson(LOCAL_KEY, [])
  return Array.isArray(rows) ? rows : []
}

export async function saveRows(rows) {
  const res = await safeSetItem(LOCAL_KEY, JSON.stringify(rows))
  if (res?.locked) return res
  if (!res?.ok) {
    const error = new Error('quota')
    error.quota = true
    throw error
  }
  return res
}

export function loadModulePrefs(defaults) {
  const saved = loadJson(MODULE_KEY, null)
  return { ...defaults, ...(saved || {}), hse: true }
}

export async function saveModulePrefs(prefs) {
  return safeSetItem(MODULE_KEY, JSON.stringify({ ...prefs, hse: true }))
}

export function loadSite() {
  const saved = loadJson(SITE_KEY, {}) || {}
  const ruleset = saved.ruleset || (saved.mine ? 'mines' : 'general')
  return {
    siteName: '',
    setupDone: false,
    ...saved,
    ruleset,
    mine: ruleset === 'mines',
  }
}

export async function saveSite(site) {
  return safeSetItem(SITE_KEY, JSON.stringify(site))
}

function hasDevicePhotos(list) {
  return Array.isArray(list) && list.some((item) => typeof item === 'string' && item.startsWith('data:'))
}

export function mergeRows(local, remote) {
  const map = new Map()
  for (const row of local || []) map.set(row.id, row)
  for (const row of remote || []) {
    const prev = map.get(row.id)
    if (!prev) {
      map.set(row.id, row)
      continue
    }
    const prevTime = Date.parse(prev.updatedAt || 0)
    const nextTime = Date.parse(row.updatedAt || 0)
    if (nextTime < prevTime) continue
    const merged = { ...row, fields: { ...(row.fields || {}) } }
    if (hasDevicePhotos(prev.fields?.photos)) merged.fields.photos = prev.fields.photos
    if (hasDevicePhotos(prev.scenePhotos)) merged.scenePhotos = prev.scenePhotos
    if (typeof prev.scanPhoto === 'string' && prev.scanPhoto.startsWith('data:')) merged.scanPhoto = prev.scanPhoto
    map.set(row.id, merged)
  }
  return [...map.values()].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
}

// Photos stay on the device. The beta cloud row keeps the words.
export function slimForCloud(row) {
  const clone = JSON.parse(JSON.stringify(row))
  if (Array.isArray(clone.fields?.photos)) {
    clone.fields.photoCount = clone.fields.photos.length
    delete clone.fields.photos
  }
  if (Array.isArray(clone.scenePhotos)) {
    clone.scenePhotoCount = clone.scenePhotos.length
    delete clone.scenePhotos
  }
  if (clone.scanPhoto) delete clone.scanPhoto
  return clone
}
