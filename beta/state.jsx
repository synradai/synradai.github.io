import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { defaultModulePrefs } from './config/modules.js'
import { isBackendEnabled, liveProjectBlocked, supabase } from './lib/supabase.js'
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
    supabase.from('hse_records').select('id,kind,payload,updated_at').then(({ data, error }) => {
      if (cancel) return
      if (error) {
        setCloudNote('Cloud register is not on this project yet. Records stay on this device. Run supabase/beta/hse-records.sql on the beta project when you are ready.')
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

  const push = async (row) => {
    if (!supabase || !user || user.local) return
    const { error } = await supabase.from('hse_records').upsert({
      id: row.id,
      user_id: user.id,
      kind: row.kind,
      payload: slimForCloud(row),
      updated_at: row.updatedAt,
    })
    if (error) setCloudNote('Saved on this device. The beta cloud register rejected the sync — check that hse-records.sql has been run.')
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
    liveProjectBlocked,
    backend: isBackendEnabled,
    async signIn(email, password) {
      setAuthError('')
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setAuthError(error.message || 'Could not sign in.')
    },
    async sendReset(email) {
      setAuthError('')
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/beta/`,
      })
      if (error) setAuthError(error.message || 'Could not send the reset email.')
      else setAuthError('Check your email for a reset link.')
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
    deleteRecord(id) {
      persist(rows.filter((row) => row.id !== id))
      if (supabase && user && !user.local) supabase.from('hse_records').delete().eq('id', id)
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
  }), [ready, user, recovery, rows, modules, site, cloudNote, storageWarning, authError])

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
