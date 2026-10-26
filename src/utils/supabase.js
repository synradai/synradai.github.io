import { createClient } from '@supabase/supabase-js'
import { forwardForeignAuth } from './foreignAuth.js'

// Reads from .env (see .env.example). Both values are safe to ship in the
// frontend — the anon key only works through row-level security, which limits
// every user to their own organisation's data.
const url = import.meta.env?.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

// When the env vars aren't set, the app runs in its original "no backend"
// mode (local-only, bring-your-own-key). This keeps `npm run dev` working
// for anyone who hasn't configured Supabase.
// Dev-only preview mode: open http://localhost:5173/?demo to skip login and
// browse the UI directly (local-only data). DEV flag means this can never
// activate in a production build.
const demoMode = import.meta.env?.DEV && typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('demo')
// Run before the client is created so a beta token in the URL is not consumed here.
export const authRedirecting = typeof window !== 'undefined' && forwardForeignAuth(window.location, window.localStorage, url)
export const isBackendEnabled = Boolean(url && anonKey) && !demoMode && !authRedirecting

export const supabase = isBackendEnabled ? createClient(url, anonKey) : null

// The current user's access token, for authenticating calls to the AI proxy.
export async function getAccessToken() {
  if (!supabase) return ''
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}
