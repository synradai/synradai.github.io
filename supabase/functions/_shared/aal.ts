// Assurance level from an Authorization header. Call only after auth.getUser()
// has accepted the same token — this decode does not check the signature.

export function aalFromAuthorization(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)/i.exec(header.trim())
  if (!match) return null
  const segment = match[1].split(".")[1]
  if (!segment) return null
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/")
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
    const json = JSON.parse(atob(padded + pad))
    return typeof json.aal === "string" ? json.aal : null
  } catch {
    return null
  }
}

export function requireAal2(header: string | null): boolean {
  return aalFromAuthorization(header) === "aal2"
}
