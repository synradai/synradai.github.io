const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE = /\b(?:\+?61|0)[\s-]?\d(?:[\s-]?\d){7,9}\b/g

export function redact(text) {
  return String(text || '').replace(EMAIL, '[email]').replace(PHONE, '[phone]')
}
