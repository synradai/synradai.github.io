// Share text via the native share sheet (iOS/Android PWA); fall back to clipboard.
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
      // fall through to clipboard on any other failure
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (_) {
    return 'failed'
  }
}
