import { createClient } from '@supabase/supabase-js'

// The live Safe Intelligence project. Beta must never open a client to it,
// even if someone pastes that URL into .env.beta by mistake.
export const LIVE_PROJECT_REF = 'rgkiagqexoafmtxhrlqo'

const url = import.meta.env?.VITE_SUPABASE_URL || ''
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

export const supabaseUrl = url
export const supabaseKey = key
export const liveProjectBlocked = Boolean(url && url.includes(LIVE_PROJECT_REF))
export const isBackendEnabled = Boolean(url && key) && !liveProjectBlocked
export const proxyUrl = import.meta.env?.VITE_AI_PROXY_URL || ''
// Magic-link emails must return to beta, not the site-root Site URL.
export const BETA_EMAIL_REDIRECT = 'https://synradai.github.io/beta/'

export function authFlowForLocation(search = '', hash = '') {
  const hashParams = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  if (hashParams.get('access_token')) return 'implicit'
  const query = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  if (query.get('code')) return 'pkce'
  return 'implicit'
}

const authFlow = authFlowForLocation(
  typeof window === 'undefined' ? '' : window.location.search,
  typeof window === 'undefined' ? '' : window.location.hash,
)

export const supabase = isBackendEnabled
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: authFlow,
      },
    })
  : null

export function authReturnUrl() {
  if (typeof window === 'undefined') return ''
  const next = new URL(window.location.href)
  next.hash = ''
  next.search = ''
  return next.toString()
}

export async function getAccessToken() {
  if (!supabase) return ''
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}
