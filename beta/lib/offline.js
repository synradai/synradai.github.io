// Shown only when the beta proxy is not configured. Never used once
// VITE_AI_PROXY_URL is set and the user is signed in to the beta project.

export function offlineExtraction(kind) {
  if (kind === 'hazard') {
    return {
      siteArea: 'Workshop bay 2',
      description: 'Offline sample: a grinder lead crosses the walkway and the guard looks loose.',
      energy: 'Electricity',
      peopleRoles: 'Fitter, supervisor',
      immediateActions: 'Tool tagged out and the lead moved off the walkway.',
      reporter: 'HSE adviser',
    }
  }
  if (kind === 'take5') {
    return {
      siteArea: 'ROM pad',
      task: 'Offline sample: change a hydraulic hose on the excavator',
      hazards: 'Stored hydraulic pressure, line of fire, people near the tracks',
      controls: 'Isolate and bleed down, exclusion zone, spotter for the approach',
      fitForWork: 'Yes',
      peopleRoles: 'Excavator operator, fitter, spotter',
      immediateActions: 'Task not started until isolation is confirmed.',
      reporter: 'HSE adviser',
    }
  }
  return {
    siteArea: 'Laydown yard',
    description: 'Offline sample: a load shifted on the tray while the dogman was in the line of fire. No injury. The lift was stopped.',
    peopleRoles: 'Dogman, crane operator, supervisor',
    immediateActions: 'Area cleared, load lowered, lift stopped pending a check of the slings.',
    reporter: 'HSE adviser',
  }
}

export function offlineScene() {
  return {
    missedHazards: [
      'A lead is across a walkway.',
      'The grinder guard does not look seated.',
    ],
    missedDetails: [
      'No date or task is readable on the tag in frame.',
    ],
    possibleBreaches: [
      {
        area: 'Plant and housekeeping',
        why: 'A trip hazard and a suspect guard are visible. Confirm both on site before treating this as a breach.',
        instrument: 'WHS (General) Regulations 2022 (WA)',
        pinpoint: 'r.203 plant — verify',
      },
    ],
  }
}

export function offlineActions() {
  return [
    'Hold the job until the supervisor confirms the control is in place.',
    'Brief the roles on the next shift before the task starts again.',
    'Write the owner role and the due time on the close-out.',
  ]
}

export function offlineWhys() {
  return {
    whys: [
      'The person was in the line of fire while the load was moving.',
      'The exclusion zone was not set before the lift started.',
      'The pre-lift check did not confirm where people were standing.',
      'The lift plan was treated as paperwork rather than a control.',
      'The crew has no hard stop when the plan and the ground do not match.',
    ],
    rootCause: 'Offline sample: the lift started without a confirmed exclusion zone.',
    actions: 'Make the next lift wait for a named role to confirm the zone is clear.',
  }
}
