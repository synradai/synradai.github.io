import { breachesFor, rulesetMeta } from '../config/regulations.js'
import { getForm } from '../config/forms.js'

const LAW = `Use current WA law: the Work Health and Safety Act 2020 (WA), the WHS (General) Regulations 2022, the WHS (Mines) Regulations 2022, and the WHS (Petroleum and Geothermal Energy Operations) Regulations 2022 when the site ruleset is PAGEO.
The Mines Safety and Inspection Act 1994 stays in force for the mines safety levy only. Do not cite it for a safety duty.
Never cite the Occupational Safety and Health Act 1984 or the Occupational Safety and Health Regulations 1996.
The regulator is WorkSafe, within LGIRS.
WHS (General) Regulations r.154–r.162 are not used in WA. Energised electrical work is under the Electricity (Licensing) Regulations 1991.
Call every legal point a possible breach to verify. If a pinpoint is not in the adviser pack, say it is UNVERIFIED.`

export function scanPrompt(kind) {
  const fields = getForm(kind).fields.filter((field) => !['photos', 'severity', 'datetime'].includes(field.type) && field.key !== 'occurredAt')
  const shape = Object.fromEntries(fields.map((field) => {
    if (field.type === 'select' || field.type === 'yesno') {
      return [field.key, (field.options || []).map((opt) => opt.value).join(' | ')]
    }
    return [field.key, '']
  }))
  return `${LAW}
You are reading a photo of a paper ${getForm(kind).label} from a Western Australian worksite.
Extract the fields into JSON matching this shape (values are hints, replace them):
${JSON.stringify(shape, null, 2)}
People must be roles, not names. If a name is written, replace it with the role or leave the field empty. If you cannot read a field, use an empty string. Do not guess severity. Return JSON only.`
}

export function scenePrompt(ruleset = 'general') {
  const site = rulesetMeta(ruleset)
  const allowed = breachesFor(ruleset).map((reg) => `${reg.instrument} — ${reg.pinpoint}`).join('\n')
  return `${LAW}
Site ruleset: ${site.label}. ${site.instrument}. ${site.note}
You are looking at worksite photos for a Western Australian HSE adviser.
Return JSON only, in this shape:
{"missedHazards":[""],"missedDetails":[""],"possibleBreaches":[{"area":"","why":"","instrument":"","pinpoint":""}]}
List hazards and missing details you can actually see. possibleBreaches are prompts to verify, not findings. Only use these lines:
${allowed}
If the photo is unclear, say so in missedDetails and leave possibleBreaches empty.`
}

export function actionsPrompt(kind, fields) {
  return `${LAW}
Rewrite these corrective actions so they are specific to the record. Keep exactly 3 short actions. Refer to roles, not names. Return a JSON array of 3 strings and nothing else.
Form: ${kind}
Record:
${JSON.stringify(fields)}`
}

export function whysPrompt(fields) {
  return `${LAW}
Draft a five-whys chain from this record. Stay inside the facts given. Do not invent people. Return JSON only:
{"whys":["","","","",""],"rootCause":"","actions":""}
Record:
${JSON.stringify(fields)}`
}
