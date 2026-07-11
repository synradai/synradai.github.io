// Tiny haptic cues — a short buzz when something lands, a pattern for big
// moments. Safe no-op on devices/browsers without vibration support.
export const buzz = (pattern = 15) => {
  try { navigator.vibrate?.(pattern) } catch (_) {}
}
