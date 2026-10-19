export function extractJson(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('The model returned an empty response.')
  try {
    return JSON.parse(trimmed)
  } catch {
    /* keep looking */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) return JSON.parse(fence[1].trim())
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
  const arrayStart = trimmed.indexOf('[')
  const arrayEnd = trimmed.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1))
  throw new Error('The model did not return JSON.')
}
