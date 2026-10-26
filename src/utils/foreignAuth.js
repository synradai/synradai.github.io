// A beta magic link can still land on the site root when the email uses the
// Supabase Site URL. If the token is not for this app's project, send the
// full hash or query on to /beta/ before this app's client tries to use it.

const CODE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REF_RE = /^[a-z0-9]{20}$/

export function projectRefFromIssuer(value) {
  if (!value || typeof value !== 'string') return ''
  try {
    const withScheme = value.includes('://') ? value : `https://${value}`
    const ref = new URL(withScheme).hostname.split('.')[0]
    return REF_RE.test(ref) ? ref : ''
  } catch {
    return ''
  }
}

export function accessTokenProjectRef(token) {
  if (!token || typeof token !== 'string') return ''
  const segment = token.split('.')[1]
  if (!segment) return ''
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const json = JSON.parse(atob(padded + pad))
    return projectRefFromIssuer(typeof json.iss === 'string' ? json.iss : '')
  } catch {
    return ''
  }
}

export function verifierRefsFromKeys(keys) {
  const refs = []
  for (const key of keys || []) {
    const match = /^sb-([a-z0-9]{20})-auth-token-code-verifier$/.exec(String(key))
    if (match) refs.push(match[1])
  }
  return refs
}

export function betaForwardHref({ href, projectUrl = '', verifierRefs = [] } = {}) {
  let url
  try {
    url = new URL(href)
  } catch {
    return ''
  }
  if (url.pathname === '/beta' || url.pathname.startsWith('/beta/')) return ''

  const ownRef = projectRefFromIssuer(projectUrl)
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
  const accessToken = hashParams.get('access_token')
  if (accessToken) {
    const tokenRef = accessTokenProjectRef(accessToken)
    if (!tokenRef || (ownRef && tokenRef === ownRef)) return ''
    return betaHref(url)
  }

  const code = url.searchParams.get('code')
  if (!code || !CODE_RE.test(code)) return ''
  if (ownRef && verifierRefs.includes(ownRef)) return ''
  return betaHref(url)
}

function betaHref(url) {
  const target = new URL('/beta/', url.origin)
  target.search = url.search
  target.hash = url.hash
  return target.toString()
}

export function forwardForeignAuth(loc, storage, projectUrl) {
  if (!loc || typeof loc.replace !== 'function' || typeof loc.href !== 'string') return false
  let keys = []
  try {
    keys = storage ? Object.keys(storage) : []
  } catch {
    keys = []
  }
  const next = betaForwardHref({ href: loc.href, projectUrl, verifierRefs: verifierRefsFromKeys(keys) })
  if (!next || next === loc.href) return false
  loc.replace(next)
  return true
}
