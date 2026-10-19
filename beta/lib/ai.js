import { deidentifyText } from '../../src/utils/deident.js'
import { offlineActions, offlineExtraction, offlineScene, offlineWhys } from './offline.js'
import { extractJson } from './parse.js'
import { actionsPrompt, scenePrompt, scanPrompt, whysPrompt } from './prompts.js'
import { redact } from './redact.js'
import { getAccessToken, isBackendEnabled, proxyUrl } from './supabase.js'

export function scrub(text) {
  const redacted = redact(text)
  try {
    return deidentifyText(redacted)
  } catch {
    return redacted
  }
}

export function aiMode() {
  if (proxyUrl && isBackendEnabled) return 'grok'
  return 'offline'
}

async function complete({ prompt, images, task, maxTokens }) {
  if (aiMode() !== 'grok') {
    return { offline: true, text: '' }
  }
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in to the beta project to use Grok.')
  let response
  try {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: scrub(prompt),
        images: images || [],
        task: task || (images?.length ? 'vision' : 'text'),
        maxTokens: maxTokens || 1200,
      }),
    })
  } catch (error) {
    throw new Error(`Could not reach the beta AI proxy. ${error?.message || ''}`.trim())
  }
  let data = null
  try { data = await response.json() } catch { data = null }
  if (response.status === 401) throw new Error('Sign in again to use Grok.')
  if (response.status === 429) throw new Error('Daily AI limit reached. Try again tomorrow.')
  const text = data?.content?.[0]?.text || ''
  if (!response.ok || !text) {
    throw new Error(data?.error || 'Grok did not return a result. Try again in a moment.')
  }
  return { offline: false, text, provider: data.provider || 'xai', model: data.model || '' }
}

export async function extractForm(kind, image) {
  if (aiMode() !== 'grok') {
    return { offline: true, fields: offlineExtraction(kind) }
  }
  const result = await complete({ prompt: scanPrompt(kind), images: [image], task: 'vision', maxTokens: 1400 })
  const parsed = extractJson(result.text)
  return { offline: false, fields: parsed && typeof parsed === 'object' ? parsed : {} }
}

export async function checkScene(images, note) {
  const prompt = `${scenePrompt()}\nAdviser note: ${scrub(note || 'None')}`
  if (aiMode() !== 'grok') return { offline: true, result: offlineScene() }
  const result = await complete({ prompt, images, task: 'vision', maxTokens: 1600 })
  return { offline: false, result: extractJson(result.text) }
}

export async function rewriteActions(kind, fields) {
  if (aiMode() !== 'grok') return { offline: true, actions: offlineActions() }
  const result = await complete({ prompt: actionsPrompt(kind, scrub(JSON.stringify(fields))), task: 'text', maxTokens: 800 })
  const parsed = extractJson(result.text)
  const actions = Array.isArray(parsed) ? parsed.map(String) : []
  if (!actions.length) throw new Error('Grok did not return actions.')
  return { offline: false, actions }
}

export async function suggestWhys(fields) {
  if (aiMode() !== 'grok') return { offline: true, draft: offlineWhys() }
  const result = await complete({ prompt: whysPrompt(scrub(JSON.stringify(fields))), task: 'text', maxTokens: 1200 })
  return { offline: false, draft: extractJson(result.text) }
}
