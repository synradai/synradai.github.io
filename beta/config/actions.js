// Corrective actions filed automatically on severity 1–3.
// Grok can rewrite the wording later. The structure stays here so a
// record can still be closed out with no network.

export const ACTION_TEMPLATES = {
  incident: [
    'Stop the job and make the area safe before anyone starts again.',
    'Tell the crew what changed, by role, before the next task.',
    'Give the action an owner role and close it before the end of shift, or hand it over.',
  ],
  hazard: [
    'Put a control in place, or isolate the energy, before work continues.',
    'Mark the area so the next crew can see the hazard.',
    'Check the control is still in place at the next break.',
  ],
  take5: [
    'Confirm the controls on this Take 5 are in place before the task starts.',
    'If a control is missing, stop and fix it. Do not start on a promise.',
    'Do the Take 5 again if the task, the people, or the conditions change.',
  ],
}

export function templateActions(kind) {
  const lines = ACTION_TEMPLATES[kind] || ACTION_TEMPLATES.incident
  return lines.map((text, index) => ({
    id: `a${index + 1}`,
    text,
    ownerRole: index === 0 ? 'Supervisor' : 'Person doing the job',
    due: 'End of shift',
    done: false,
  }))
}
