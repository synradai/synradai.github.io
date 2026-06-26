export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// Save to localStorage and report what happened instead of swallowing errors.
// The common failure on a real device is the ~5-10MB quota being exceeded
// (photos are stored as base64, which inflates their size ~33%). Returns
// { ok: true } on success, or { ok: false, quota } so the caller can warn the
// user rather than silently losing a shift or incident.
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return { ok: true }
  } catch (e) {
    const quota = !!e && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 || e.code === 1014
    )
    return { ok: false, quota, error: e }
  }
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
