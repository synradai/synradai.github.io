export function personError(fields) {
  if (!String(fields?.fullName || '').trim()) return 'Add the name.'
  if (String(fields?.email || '').trim() && !String(fields.email).includes('@')) return 'That email address doesn’t look right.'
  return ''
}

export function buildPerson({ id, siteId, fields = {} }) {
  const problem = personError(fields)
  if (problem) throw new Error(problem)
  if (!siteId) throw new Error('Choose a site.')
  return {
    id: id || crypto.randomUUID(),
    siteId,
    fullName: String(fields.fullName).trim(),
    role: String(fields.role || '').trim(),
    email: String(fields.email || '').trim(),
    phone: String(fields.phone || '').trim(),
  }
}
