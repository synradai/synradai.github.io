import { STORAGE_KEYS } from '../constants.js'
import {
  cachedItem,
  forgetMemory,
  hydrateStored,
  protectForStorage,
} from './secureStore.js'

export { cachedItem }

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// Save a value. User-data keys are encrypted with the open session vault.
// Returns { ok: true } or { ok: false, quota } when the device is out of space
// (photos are stored as base64, which inflates their size ~33%).
export async function safeSetItem(key, value) {
  try {
    const stored = await protectForStorage(key, value)
    localStorage.setItem(key, stored)
    return { ok: true }
  } catch (e) {
    if (e?.code === 'LOCKED') return { ok: false, locked: true, error: e }
    const quota = !!e && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 || e.code === 1014
    )
    return { ok: false, quota, error: e }
  }
}

// Decrypt a user-data value. Existing plaintext is rewritten encrypted.
// A value that cannot be decrypted is removed so the caller re-syncs.
export async function safeGetItem(key) {
  let raw = null
  try { raw = localStorage.getItem(key) } catch { return null }
  const result = await hydrateStored(key, raw)
  if (result.locked) return null
  if (result.unreadable) {
    try { localStorage.removeItem(key) } catch { /* already unreadable */ }
    return null
  }
  if (result.migrate && result.value != null) {
    const rewritten = await safeSetItem(key, result.value)
    if (!rewritten.ok) return result.value
  }
  return result.value
}

export function forgetItem(key) {
  forgetMemory(key)
  try { localStorage.removeItem(key) } catch { /* private mode */ }
}

// The bring-your-own Anthropic key is gone. Drop any copy still on the device
// instead of migrating it into the vault.
export function discardRetiredSecrets() {
  forgetItem(STORAGE_KEYS.API_KEY)
}

export function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_W = 800
        const scale = Math.min(1, MAX_W / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
