import { createClient } from '@supabase/supabase-js'

// The live Safe Intelligence project. Beta must never open a client to it,
// even if someone pastes that URL into .env.beta by mistake.
export const LIVE_PROJECT_REF = 'rgkiagqexoafmtxhrlqo'

const url = import.meta.env?.VITE_SUPABASE_URL || ''
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

export const supabaseUrl = url
export const liveProjectBlocked = Boolean(url && url.includes(LIVE_PROJECT_REF))
export const isBackendEnabled = Boolean(url && key) && !liveProjectBlocked
export const proxyUrl = import.meta.env?.VITE_AI_PROXY_URL || ''

export const supabase = isBackendEnabled ? createClient(url, key) : null

export async function getAccessToken() {
  if (!supabase) return ''
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}
