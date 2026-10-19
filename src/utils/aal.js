// Read the authenticator assurance level from a Supabase access token.
// The signature is not checked here — callers must validate the token first
// (supabase.auth.getUser() on the server, or a session the client already holds).

export function aalFromAccessToken(token) {
  if (!token || typeof token !== 'string') return null
  const segment = token.split('.')[1]
  if (!segment) return null
  try {
    const json = JSON.parse(decodeBase64Url(segment))
    return typeof json.aal === 'string' ? json.aal : null
  } catch {
    return null
  }
}

export function aalFromAuthorization(header) {
  if (!header || typeof header !== 'string') return null
  const match = /^Bearer\s+(\S+)/i.exec(header.trim())
  return aalFromAccessToken(match ? match[1] : '')
}

function decodeBase64Url(segment) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
