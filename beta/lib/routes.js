const MOCKS = ['training', 'maintenance', 'kpis', 'stores', 'scaffold']

export function routeFromHash(hash) {
  const raw = String(hash || '')
  if (raw.includes('access_token') || raw.includes('type=recovery')) {
    return { screen: 'auth-callback' }
  }
  const path = raw.replace(/^#/, '').split('?')[0]
  const parts = path.split('/').filter(Boolean)
  if (!parts.length) return { screen: 'home' }
  if (parts[0] === 'setup') return { screen: 'setup' }
  if (parts[0] === 'import') return { screen: 'import' }
  if (parts[0] === 'admin') return { screen: 'admin' }
  if (parts[0] === 'hse') {
    if (parts[1] === 'dashboard') return { screen: 'dashboard' }
    if (parts[1] === 'day') return { screen: 'day' }
    if (parts[1] === 'audit') return { screen: 'audit' }
    if (parts[1] === 'actions') return { screen: 'actions' }
    if (parts[1] === 'injury') return { screen: 'injury', id: parts[2] || '' }
    if (parts[1] === 'inspections') return { screen: 'inspections' }
    if (parts[1] === 'capture') return { screen: 'capture', kind: parts[2] || 'incident' }
    if (parts[1] === 'scan') return { screen: 'scan' }
    if (parts[1] === 'scene') return { screen: 'scene' }
    if (parts[1] === 'register') return { screen: 'register' }
    if (parts[1] === 'record') return { screen: 'record', id: parts[2] || '' }
    if (parts[1] === 'investigate') return { screen: 'investigate', id: parts[2] || '' }
    return { screen: 'hse' }
  }
  if (MOCKS.includes(parts[0])) return { screen: parts[0] }
  return { screen: 'home' }
}

export function go(hash) {
  const next = hash.startsWith('#') ? hash : `#${hash}`
  if (window.location.hash !== next) window.location.hash = next
}
