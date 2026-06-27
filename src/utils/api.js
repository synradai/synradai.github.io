import { getAccessToken } from './supabase'

// When VITE_AI_PROXY_URL is set, AI calls go through the backend proxy (the
// server holds the Anthropic key and authenticates the user via their Supabase
// token). When it's empty — the default today — calls go direct from the
// browser using the key from Settings. Same return shape either way, so callers
// don't change.
const PROXY_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_PROXY_URL) || ''

// True when AI calls run through the backend proxy (key is server-side, so the
// Settings screen shouldn't ask the user for their own Anthropic key).
export const isProxyMode = Boolean(PROXY_URL)

export async function callAnthropicAPI(apiKey, prompt, maxTokens = 1000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('No internet connection. AI features need signal or Wi-Fi — try again once connected.')
  }

  return PROXY_URL
    ? callViaProxy(prompt, maxTokens)
    : callDirect(apiKey, prompt, maxTokens)
}

// Direct browser → Anthropic (current behaviour; user supplies their own key).
async function callDirect(apiKey, prompt, maxTokens) {
  if (!apiKey) throw new Error('No API key. Add it in Settings.')

  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    const detail = e?.message || e?.name || String(e)
    throw new Error(`Network error reaching Anthropic: ${detail}`)
  }

  let data
  try {
    data = await res.json()
  } catch (e) {
    throw new Error(`Bad response from Anthropic (HTTP ${res.status})`)
  }

  if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`)
  if (!data.content?.[0]?.text) throw new Error('Unexpected response from Anthropic API')
  return data.content[0].text
}

// Browser → your backend proxy → Anthropic (production; key stays server-side).
async function callViaProxy(prompt, maxTokens) {
  const authToken = await getAccessToken()
  if (!authToken) throw new Error('Please sign in to use AI features.')

  let res
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt, maxTokens }),
    })
  } catch (e) {
    const detail = e?.message || e?.name || String(e)
    throw new Error(`Network error reaching the server: ${detail}`)
  }

  let data
  try {
    data = await res.json()
  } catch (e) {
    throw new Error(`Bad response from server (HTTP ${res.status})`)
  }

  // Never surface raw upstream errors (model ids, stack traces) to users.
  if (res.status === 401) throw new Error('Please sign in again to use AI features.')
  if (res.status === 429) throw new Error("You've reached today's AI limit, or it's busy — try again shortly.")
  if (!res.ok || !data.content?.[0]?.text) throw new Error("The AI couldn't generate that just now. Please try again in a moment.")
  return data.content[0].text
}

export function buildFindingsPrompt(rounds) {
  const entries = rounds
    .map(r => {
      let line = `[${formatT(r.time)}] [${r.tag}] ${r.text}`
      if (r.tag === 'Hazard') line += r.rectification ? ` (RECTIFIED: ${r.rectification})` : ' (STATUS: open / not yet rectified)'
      if (r.tag === 'Near Miss' && r.prevention) line += ` (PREVENTION: ${r.prevention})`
      return line
    })
    .join('\n')

  return `You are a safety advisor on a FIFO mining site. Below are observations from today's site rounds. Write up the findings for the safety findings meeting.

Keep it concise and easy to scan — a short paragraph or two under a few clear, plain section headings (e.g. Overview, Hazards, Near misses, Follow-up actions). Lead with what matters most. 2–3 sentences per paragraph, not exhaustive. Use exact times only where they matter. Professional and factual. Write it so it's ready to send or present as-is, with no editing needed. Plain text only — no markdown symbols (#, *), and do NOT add a title or placeholder fields like Date, Name or Company (the app adds those); just the report content under plain headings.

ROUNDS ENTRIES:
${entries}`
}

export function buildDaySummaryPrompt(entries) {
  const lines = entries.map(e => `[${formatT(e.time)}] ${e.text}`).join('\n')
  return `You are helping a FIFO safety advisor sum up their working day for a quick update to their supervisor. Below are their own short notes, logged through the day with times. Write a clear, natural first-person summary of what they did today — the kind of thing they could read straight back if their boss asked "what did you get done today?". Keep it factual and grounded entirely in the notes — do not invent anything. Plain, professional, human language. A few short paragraphs or a tight list, using the times where they help tell the story.

TODAY'S NOTES:
${lines}`
}

export function buildHandoverPrompt(shift) {
  const rounds = (shift.rounds || []).map(r => {
    let line = `[${formatT(r.time)}] [${r.tag}] ${r.text}`
    if (r.tag === 'Hazard') line += r.rectification ? ` (RECTIFIED: ${r.rectification})` : ' (STATUS: open / not yet rectified)'
    if (r.tag === 'Near Miss' && r.prevention) line += ` (PREVENTION: ${r.prevention})`
    return line
  }).join('\n')
  const actions = (shift.rounds || []).filter(r => r.tag === 'Action').map(r => `- ${r.text}`).join('\n')
  const incidents = (shift.incidents || []).map(i => `- [${formatT(i.time)}] ${i.description}`).join('\n')

  return `You are a safety advisor completing a FIFO shift handover. Write the handover note for the incoming safety advisor.

Keep it concise and easy to scan — short paragraphs under a few clear, plain section headings (e.g. Shift overview, Hazards & findings, Outstanding actions, Incidents, Watch out for). Lead with what the next advisor most needs to know. 2–3 sentences per paragraph. 24hr time format. Write it so it can be read or sent straight away with no editing. Plain text only — no markdown symbols (#, *), and do NOT add a title or placeholder fields like Date, Name or Company (the app adds those); just the report content under plain headings.

INCOMING HANDOVER NOTES: ${shift.handover?.notes || 'None'}

MORNING MEETING TOPICS:
${(shift.meeting?.topics || []).map(t => `- ${t.text}`).join('\n') || 'None'}

SITE ROUNDS:
${rounds || 'No rounds recorded'}

OUTSTANDING ACTIONS:
${actions || 'None'}

INCIDENTS:
${incidents || 'None'}

FINDINGS REPORT:
${shift.findingsReport || 'Not generated'}`
}

export function buildIncidentPrompt(fields, time) {
  return `You are a safety advisor on a FIFO mining site. Write up a formal incident report from the details below.

Structure it under clear, plain headings (e.g. What happened, Immediate actions, Contributing factors, Corrective actions, Escalation) with short, factual paragraphs — concise, not exhaustive. Cover what/when/where and the type, who was involved or witnessed it, immediate actions taken, likely contributing factors, corrective actions needed, and whether it needs escalating and why. If a JSA/permit summary is provided, note whether the work appears in line with it. Professional reporting language; flag clearly where info wasn't provided and you're making a reasonable assumption. Write it so it's ready to send as-is. Plain text only — no markdown symbols (#, *), and do NOT add a title block or repeat placeholder fields like Date, Name or Company (the app adds those); just the report content under plain headings.

Time: ${formatT(time)}
Company: ${fields.companyName || 'Not specified'}
Location/Area: ${fields.location || 'Not specified'}
Type of Incident: ${fields.incidentType || 'Not specified'}
Persons Involved: ${fields.personsInvolved || 'Not specified'}

Description:
${fields.description || 'None provided'}

JSA/Permit Summary:
${fields.jsaSummary || 'Not provided'}`
}

// Convert compressPhoto() data URLs into Anthropic vision content blocks.
export function buildImageBlocks(photos) {
  return (photos || []).map(p => {
    const m = p.match(/^data:(.+);base64,(.+)$/)
    return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null
  }).filter(Boolean)
}

export function buildJsaScanPrompt() {
  return `You are a safety advisor reviewing a photo of a JSA (Job Safety Analysis), SWMS, or work permit document from a FIFO mining site.

Read the document in the image(s) and summarise it in a short paragraph: the task/activity it covers, the key hazards and controls listed, required PPE, and whether it appears signed/authorised. If the image is unclear or not a JSA/permit, say so plainly. Return only the summary, no preamble.`
}

export function buildFieldLeadershipPrompt(fields, time) {
  return `You are a safety advisor on a FIFO mining site, writing up a Field Leadership / Visible Felt Leadership (VFL) observation report after visiting a work area.

Structure it under clear, plain headings (e.g. Observation, Positives, At-risk behaviours & feedback, Hazards, Actions) with short, factual paragraphs. KEEP IT TRIMMED AND SAFETY-FOCUSED: describe the activity itself in just a line — spend the words on the safety (behaviours, hazards, controls, feedback, actions), not on operational detail of the task. Concise, not exhaustive. Professional safety leadership language; flag clearly where info wasn't provided. Make it clean, precise and presentable — ready to show a client or contractor as-is. Plain text only — no markdown symbols (#, *), and do NOT add a title or placeholder fields like Date, Name or Company (the app adds those); just the report content under plain headings.

Time: ${formatT(time)}
Location/Area: ${fields.location || 'Not specified'}
Company assessed: ${fields.companyAssessed || 'Not specified'}
Observer's company: ${fields.yourCompany || 'Not specified'}
Activity observed: ${fields.activity || 'Not specified'}

Positive behaviours observed:
${fields.positives || 'None recorded'}

At-risk behaviours observed:
${fields.atRisk || 'None recorded'}

Hazards identified:
${fields.hazards || 'None recorded'}

Actions taken/required:
${fields.actions || 'None recorded'}

Additional notes:
${fields.notes || 'None'}`
}

export function buildTalkingPointsPrompt(topic) {
  return `You are a safety advisor on a FIFO mining site preparing for a morning toolbox talk.

For the following safety topic, write 3-5 short talking points to guide the discussion with the crew. Keep each point to one sentence, practical, and specific to a mining/industrial site. Format as a simple bullet list using "-". No heading, no intro text.

TOPIC: ${topic}`
}

export function buildLearningPrompt(text) {
  return `You are a safety advisor on a FIFO mining site, recording a personal lesson learned for future reference.

Tidy up the following note into a clear, concise lesson-learned entry. Keep it factual, in the advisor's own voice (first person is fine), and don't add information that wasn't there. Fix grammar and structure. Keep it brief — a short paragraph or a few bullet points.

RAW NOTE:
${text}`
}

export function buildPolishPrompt(text) {
  return `Rewrite the following text in clear, concise, professional language suitable for a formal safety report. Fix spelling, grammar, and wording, tighten the phrasing, cut filler and repetition, and use correct Australian safety/mining terminology. Keep all facts and meaning intact — don't add or remove information. Return only the rewritten text, with no commentary, preamble, or formatting.

TEXT:
${text}`
}
export function buildAskSafetyPrompt(question, learnings = [], priorQA = []) {
  const learningsText = learnings.length
    ? learnings.slice(-10).map(l => `- ${l.text}`).join('\n')
    : 'None recorded yet.'

  const historyText = priorQA.length
    ? `RECENT CONVERSATION:\n${priorQA.slice(-3).map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}\n\n`
    : ''

  return `You are an AI safety advisor for FIFO mining and oil & gas sites in Australia. Answer the question below practically and specifically, drawing on:
- Australian WHS law and mining/petroleum safety regulations (especially WA — Work Health and Safety Act 2020, Mines Safety and Inspection Act, etc.) and relevant Codes of Practice
- Common practices and standards used by major operators such as FMG, BHP, Rio Tinto, and Woodside
- Incident investigation and root cause methodologies used in safety (e.g. ICAM, TapRooT, SCAT, 5 Whys, Bowtie/fishbone analysis, hierarchy of controls) — if asked about an incident or investigation, help apply the relevant method
- The advisor's own recorded lessons learned, where relevant

${historyText}ADVISOR'S RECENT LESSONS LEARNED:
${learningsText}

QUESTION:
${question}

Keep the answer short and direct — 2-4 sentences, like a quick verbal answer from an experienced advisor, not a written report. Lead with the actual answer. Be specific where it matters (e.g. a number, requirement, or key step), but don't over-explain or cover every angle. If something depends on site-specific procedures, say so in passing. No headings, no bullet lists, no preamble.`
}

function formatT(ts) {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
}
