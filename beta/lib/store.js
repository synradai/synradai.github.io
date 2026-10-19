const LOCAL_KEY = 'si-beta-hse-records-v1'
const MODULE_KEY = 'si-beta-modules'
const SITE_KEY = 'si-beta-site'

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function loadRows() {
  const rows = loadJson(LOCAL_KEY, [])
  return Array.isArray(rows) ? rows : []
}

export function saveRows(rows) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows))
}

export function loadModulePrefs(defaults) {
  const saved = loadJson(MODULE_KEY, null)
  return { ...defaults, ...(saved || {}), hse: true }
}

export function saveModulePrefs(prefs) {
  localStorage.setItem(MODULE_KEY, JSON.stringify({ ...prefs, hse: true }))
}

export function loadSite() {
  return {
    mine: true,
    siteName: '',
    setupDone: false,
    ...loadJson(SITE_KEY, {}),
  }
}

export function saveSite(site) {
  localStorage.setItem(SITE_KEY, JSON.stringify(site))
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
