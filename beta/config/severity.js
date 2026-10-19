// 1–5 severity scale. Change INVESTIGATION_FROM after the HSE review
// if moderate (3) should also open an investigation.

export const SEVERITY_SCALE = [
  { level: 1, label: 'Low', hint: 'No injury and no damage. Easy to fix on the spot.', path: 'closeout' },
  { level: 2, label: 'Minor', hint: 'First aid or small damage, already contained.', path: 'closeout' },
  { level: 3, label: 'Moderate', hint: 'Medical treatment or real damage, still managed on site.', path: 'closeout' },
  { level: 4, label: 'Major', hint: 'Serious injury potential, or it may be notifiable.', path: 'investigation' },
  { level: 5, label: 'Critical', hint: 'Fatality, permanent harm, or a catastrophic event.', path: 'investigation' },
]

// Records at this level and above open the five-whys screen.
export const INVESTIGATION_FROM = 4

export const FIVE_WHYS = [
  'Why did this happen?',
  'Why did that cause exist?',
  'Why was that allowed to happen?',
  'Why did the control fail or go missing?',
  'Why was that the way the job was set up?',
]

export function severityMeta(level) {
  return SEVERITY_SCALE.find((item) => item.level === Number(level)) || null
}
