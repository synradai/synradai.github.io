import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { defaultModulePrefs } from './config/modules.js'
import { authReturnUrl, isBackendEnabled, liveProjectBlocked, supabase } from './lib/supabase.js'
import { loadModulePrefs, loadRows, loadSite, mergeRows, saveModulePrefs, saveRows, saveSite, slimForCloud } from './lib/store.js'

const AppContext = createContext(null)
const LOCAL_KEY = 'si-beta-local-user'

export function AppState({ children }) {
  const [ready, setReady] = useState(!isBackendEnabled)
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [localUser, setLocalUser] = useState(() => {
    if (isBackendEnabled) return null
    try { return JSON.parse(sessionStorage.getItem(LOCAL_KEY) || 'null') } catch { return null }
  })
  const [rows, setRows] = useState([])
  const [modules, setModules] = useState(() => loadModulePrefs(defaultModulePrefs()))
  const [site, setSite] = useState(() => loadSite())
  const [cloudNote, setCloudNote] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const orgIdRef = useRef(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (next && window.location.hash.includes('access_token')) {
        window.location.hash = '#/'
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user
    ? { id: session.user.id, email: session.user.email || 'Signed in', local: false }
    : localUser

  useEffect(() => {
    if (!user) return
    const local = loadRows()
    setRows(local)
    if (!supabase || user.local) return
    let cancel = false
    supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (!cancel) orgIdRef.current = data?.org_id || null
    })
    supabase.from('hse_records').select('id,kind,payload,updated_at').then(({ data, error }) => {
      if (cancel) return
      if (error) {
        setCloudNote('Cloud register is not on this project yet. Records stay on this device until the beta hse_records migration is applied.')
        return
      }
      const remote = (data || []).map((row) => ({
        ...(row.payload || {}),
        id: row.id,
        kind: row.kind || row.payload?.kind,
        updatedAt: row.payload?.updatedAt || row.updated_at,
      }))
      setRows((prev) => {
        const merged = mergeRows(prev, remote)
        try { saveRows(merged) } catch { /* keep memory copy */ }
        return merged
      })
      setCloudNote('')
    })
    return () => { cancel = true }
  }, [user?.id])

  const persist = (next) => {
    setRows(next)
    try {
      saveRows(next)
      setStorageWarning('')
    } catch {
      setStorageWarning('This device is out of storage. Remove some photos and try again.')
    }
  }

  const orgIdForUser = async () => {
    if (orgIdRef.current) return orgIdRef.current
    const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle()
    orgIdRef.current = data?.org_id || null
    return orgIdRef.current
  }

  const push = async (row) => {
    if (!supabase || !user || user.local) return
    const orgId = await orgIdForUser()
    if (!orgId) {
      setCloudNote('Saved on this device. Cloud sync is waiting for your organisation.')
      return
    }
    const { error } = await supabase.from('hse_records').upsert({
      id: row.id,
      org_id: orgId,
      user_id: user.id,
      kind: row.kind,
      payload: slimForCloud(row),
      updated_at: row.updatedAt,
    }, { onConflict: 'org_id,id' })
    if (error) setCloudNote('Saved on this device. Cloud sync failed. Apply the beta hse_records migration if that table is not there yet.')
  }

  const api = useMemo(() => ({
    ready,
    user,
    recovery,
    rows,
    modules,
    site,
    cloudNote,
    storageWarning,
    authError,
    authNotice,
    liveProjectBlocked,
    backend: isBackendEnabled,
    clearAuth() {
      setAuthError('')
      setAuthNotice('')
    },
    async signIn(email, password) {
      setAuthError('')
      setAuthNotice('')
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setAuthError(error.message || 'Could not sign in.')
    },
    async signUp(email, password, fullName) {
      setAuthError('')
      setAuthNotice('')
      if (password.length < 8) {
        setAuthError('Use at least 8 characters for your password.')
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authReturnUrl(),
          data: (fullName || '').trim() ? { full_name: fullName.trim() } : undefined,
        },
      })
      if (error) {
        setAuthError(error.message || 'Could not create the account.')
        return
      }
      if (!data.session) {
        setAuthNotice('Account created. Check your email to confirm it, then sign in.')
      }
    },
    async sendReset(email) {
      setAuthError('')
      setAuthNotice('')
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authReturnUrl(),
      })
      if (error) setAuthError(error.message || 'Could not send the reset email.')
      else setAuthNotice('Check your email for a reset link.')
    },
    async setPassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setAuthError(error.message || 'Could not update the password.')
      else setRecovery(false)
    },
    signInLocal() {
      const next = { id: 'local', email: 'On this device', local: true }
      sessionStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      setLocalUser(next)
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut()
      sessionStorage.removeItem(LOCAL_KEY)
      setLocalUser(null)
      setSession(null)
      window.location.hash = '#/'
    },
    addRecord(row) {
      const next = [row, ...rows.filter((item) => item.id !== row.id)]
      persist(next)
      push(row)
    },
    updateRecord(id, patch) {
      const next = rows.map((row) => row.id === id ? { ...row, ...patch, updatedAt: new Date().toISOString() } : row)
      persist(next)
      const saved = next.find((row) => row.id === id)
      if (saved) push(saved)
    },
    async deleteRecord(id) {
      persist(rows.filter((row) => row.id !== id))
      if (!supabase || !user || user.local) return
      let query = supabase.from('hse_records').delete().eq('id', id)
      if (orgIdRef.current) query = query.eq('org_id', orgIdRef.current)
      const { error } = await query
      if (error) setCloudNote('Removed on this device. The cloud copy could not be deleted, so it may come back on the next refresh.')
    },
    setModule(id, on) {
      if (id === 'hse') return
      const next = { ...modules, [id]: on, hse: true }
      setModules(next)
      saveModulePrefs(next)
    },
    setSite(patch) {
      const next = { ...site, ...patch }
      setSite(next)
      saveSite(next)
    },
  }), [ready, user, recovery, rows, modules, site, cloudNote, storageWarning, authError, authNotice])

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
