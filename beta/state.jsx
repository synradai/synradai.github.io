import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS } from '../src/constants.js'
import { defaultModulePrefs } from './config/modules.js'
import { moduleRows, resolveMatrix, resolveTemplates, resolveWording, visibleModules } from './lib/config.js'
import { isUuid, rowsForSite } from './lib/ids.js'
import { injuryError, injuryPayload, mergeInjury, nextCaseCode, toPrivateCase } from './lib/injury.js'
import { logoError, readImageFile } from './lib/logo.js'
import { INJURY_KEY, LOCAL_KEY, MODULE_KEY, SITE_KEY, loadInjuryCases, loadModulePrefs, loadRows, loadSite, mergeRows, saveInjuryCases, saveModulePrefs, saveRows, saveSite, slimForCloud } from './lib/store.js'
import { generateId } from '../src/utils/storage.js'
import { canRemind, reminderPatch } from './lib/actions.js'
import { loadLocalActions, loadLocalCodes, loadLocalSubmissions, mapQrCode, mapSubmission, newToken, rememberSupervisor, resolveQrForms, saveLocalCodes } from './lib/qrForms.js'
import { perthDate } from './lib/time.js'
import { authReturnUrl, getAccessToken, isBackendEnabled, liveProjectBlocked, supabase, supabaseKey, supabaseUrl } from './lib/supabase.js'
import { openVault, pauseWrites, sealVault } from '../src/utils/secureStore.js'
import { safeGetItem } from '../src/utils/storage.js'

const AppContext = createContext(null)
const LOCAL_USER_KEY = 'si-beta-local-user'

function withActive(prev, patch) {
  const next = { ...prev, ...patch }
  const sites = next.sites || []
  const active = sites.find((item) => item.id === next.activeSiteId) || sites[0]
  if (!active) return next
  return {
    ...next,
    activeSiteId: active.id,
    siteName: active.name,
    ruleset: active.ruleset || 'general',
    mine: (active.ruleset || 'general') === 'mines',
  }
}

async function downloadLogo(path) {
  if (!supabase || !path) return ''
  try {
    const { data, error } = await supabase.storage.from('site-logos').download(path)
    if (error || !data) return ''
    return await readImageFile(data)
  } catch {
    return ''
  }
}

function emailCodeMessage(error) {
  const blob = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  if (blob.includes('rate') || blob.includes('too many') || blob.includes('only request this')) {
    return 'Too many emails just now. Wait a minute, then send another code.'
  }
  if (blob.includes('not authorized') || blob.includes('not authorised')) {
    return 'The built-in mailer only sends to addresses on the Supabase organisation team. Add this email under Organisation → Team, or turn on custom SMTP.'
  }
  if (blob.includes('email') && blob.includes('invalid')) return 'That email address doesn’t look right.'
  if (blob.includes('otp_expired')) return 'That code has expired. Send a new one.'
  if (blob.includes('expired') && blob.includes('invalid')) return 'That code didn’t match, or it has expired. Check the email or send a new one.'
  if (blob.includes('expired')) return 'That code has expired. Send a new one.'
  if (blob.includes('otp') || blob.includes('token')) return 'That code didn’t match. Check the email and try again.'
  return error?.message || 'Could not send the code.'
}

function passwordSignInMessage(error) {
  const blob = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  if (blob.includes('invalid login') || blob.includes('invalid_credentials')) {
    return 'That email and password did not match. Use Email me a 6-digit code to open or create the account.'
  }
  return error?.message || 'Could not sign in.'
}

export function AppState({ children }) {
  const [ready, setReady] = useState(!isBackendEnabled)
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [localUser, setLocalUser] = useState(() => {
    if (isBackendEnabled) return null
    try { return JSON.parse(sessionStorage.getItem(LOCAL_USER_KEY) || 'null') } catch { return null }
  })
  const [rows, setRows] = useState([])
  const [injuryCases, setInjuryCases] = useState([])
  const [orgRole, setOrgRole] = useState('member')
  const [modules, setModules] = useState(() => defaultModulePrefs())
  const [site, setSite] = useState(() => loadSite())
  const [cloudNote, setCloudNote] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [vaultReady, setVaultReady] = useState(false)
  const [vaultError, setVaultError] = useState('')
  const [sealTick, setSealTick] = useState(0)
  const [remoteConfig, setRemoteConfig] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(!isBackendEnabled)
  const [orgMembers, setOrgMembers] = useState([])
  const [qrCodes, setQrCodes] = useState([])
  const [submissions, setSubmissions] = useState([])
  const orgIdRef = useRef(null)
  const seenUser = useRef(undefined)
  const sealing = useRef(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    }).catch(() => setReady(true))
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
  const userId = session?.user?.id || localUser?.id || null

  useEffect(() => {
    const prev = seenUser.current
    if (prev && prev !== userId) {
      pauseWrites()
      sealing.current = true
      setVaultReady(false)
      setRows([])
      setInjuryCases([])
      setQrCodes([])
      setSubmissions([])
      setOrgRole('member')
      setOrgMembers([])
      setModules(defaultModulePrefs())
      setSite(loadSite())
      sealVault().finally(() => {
        sealing.current = false
        setSealTick((tick) => tick + 1)
      })
    }
    seenUser.current = userId
  }, [userId])

  useEffect(() => {
    if (isBackendEnabled && !localUser) return undefined
    const sync = () => {
      setQrCodes(loadLocalCodes())
      setSubmissions(loadLocalSubmissions())
      const actions = loadLocalActions()
      if (!actions.length) return
      setRows((prev) => {
        const ids = new Set(prev.map((row) => row.id))
        const extra = actions.filter((row) => row?.id && !ids.has(row.id))
        if (!extra.length) return prev
        const next = [...extra, ...prev]
        saveRows(next).catch(() => {})
        return next
      })
    }
    window.addEventListener('si-qr-local', sync)
    return () => window.removeEventListener('si-qr-local', sync)
  }, [localUser])

  useEffect(() => {
    if (!userId || sealing.current || recovery) return
    let cancel = false
    ;(async () => {
      try {
        await openVault(userId)
        await safeGetItem(LOCAL_KEY)
        await safeGetItem(MODULE_KEY)
        await safeGetItem(SITE_KEY)
        await safeGetItem(INJURY_KEY)
        await safeGetItem(STORAGE_KEYS.DEIDENT_TERMS)
        if (cancel || sealing.current) return
        const local = loadRows()
        const deviceActions = (!supabase || localUser) ? loadLocalActions() : []
        const seen = new Set(local.map((row) => row.id))
        setRows([...deviceActions.filter((row) => row?.id && !seen.has(row.id)), ...local])
        if (!supabase || localUser) {
          setQrCodes(loadLocalCodes())
          setSubmissions(loadLocalSubmissions())
        }
        setInjuryCases(loadInjuryCases())
        setModules(loadModulePrefs(defaultModulePrefs()))
        setSite(loadSite())
        setVaultError('')
        setVaultReady(true)
        if (!supabase || localUser) return
        const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', userId).maybeSingle()
        if (cancel || sealing.current) return
        orgIdRef.current = profile?.org_id || null
        setOrgRole(profile?.role === 'admin' ? 'admin' : 'member')
        if (profile?.org_id) {
          const { data: people } = await supabase.from('profiles').select('id, full_name').eq('org_id', profile.org_id)
          let orgPeople = []
          if (!cancel && !sealing.current) {
            const selfName = session?.user?.email || 'You'
            orgPeople = (people || []).map((person) => ({
              id: person.id,
              name: person.full_name || (person.id === userId ? selfName : 'Member'),
            }))
            if (!orgPeople.some((person) => person.id === userId)) orgPeople.unshift({ id: userId, name: selfName })
            setOrgMembers(orgPeople)
          }
          const [orgRes, siteRes, peopleRes] = await Promise.all([
            supabase.from('organisations').select('name').eq('id', profile.org_id).maybeSingle(),
            supabase.from('sites').select('id,name,client_name,logo_path,ruleset,supervisor_id,created_at').order('created_at'),
            supabase.from('people').select('id,site_id,full_name,role,email,phone'),
          ])
          if (!cancel && !sealing.current && !siteRes.error && siteRes.data?.length) {
            const loadedSites = await Promise.all(siteRes.data.map(async (row) => ({
              id: row.id,
              name: row.name,
              clientName: row.client_name || '',
              ruleset: row.ruleset || 'general',
              logoPath: row.logo_path || '',
              logoDataUrl: row.logo_path ? await downloadLogo(row.logo_path) : '',
              supervisorId: row.supervisor_id || '',
              supervisorName: orgPeople.find((person) => person.id === row.supervisor_id)?.name || '',
            })))
            const loadedPeople = peopleRes.error ? null : (peopleRes.data || []).map((person) => ({
              id: person.id,
              siteId: person.site_id,
              fullName: person.full_name || '',
              role: person.role || '',
              email: person.email || '',
              phone: person.phone || '',
            }))
            if (!cancel && !sealing.current) {
              setSite((prev) => {
                const known = loadedSites.find((item) => item.id === prev.activeSiteId)
                  || loadedSites.find((item) => item.name === prev.siteName)
                  || loadedSites[0]
                const next = withActive(prev, {
                  orgName: orgRes.data?.name || prev.orgName || '',
                  sites: loadedSites.map((item) => ({
                    ...item,
                    logoDataUrl: item.logoDataUrl || prev.sites?.find((local) => local.id === item.id)?.logoDataUrl || '',
                  })),
                  people: loadedPeople || prev.people || [],
                  activeSiteId: known.id,
                  setupDone: true,
                })
                saveSite(next).catch(() => {})
                return next
              })
            }
          }
          if (!cancel && !sealing.current) {
            const [codeRes, subRes] = await Promise.all([
              supabase.from('qr_codes').select('id,token,site_id,target_type,target_id,label,active,created_at').order('created_at', { ascending: false }),
              supabase.from('form_submissions').select('id,site_id,qr_id,form_id,form_version,form_title,area_label,person_name,company,role,answers,failed,stopped,action_id,created_at').order('created_at', { ascending: false }).limit(400),
            ])
            if (!cancel && !sealing.current) {
              if (!codeRes.error) setQrCodes((codeRes.data || []).map(mapQrCode))
              if (!subRes.error) setSubmissions((subRes.data || []).map(mapSubmission))
            }
          }
        }
        const { data, error } = await supabase.from('hse_records').select('id,kind,payload,updated_at,site_id')
        if (cancel || sealing.current) return
        if (error) {
          setCloudNote('Cloud register is not on this project yet. Records stay on this device until the beta hse_records migration is applied.')
          return
        }
        const remote = (data || []).map((row) => ({
          ...(row.payload || {}),
          id: row.id,
          kind: row.kind || row.payload?.kind,
          siteId: row.site_id || row.payload?.siteId || '',
          updatedAt: row.payload?.updatedAt || row.updated_at,
        }))
        setRows((prev) => {
          const merged = mergeRows(prev, remote)
          saveRows(merged).catch(() => {})
          return merged
        })
        const [indexRes, privateRes] = await Promise.all([
          supabase.from('injury_case_index').select('id,case_code,event_id,classification,status,restricted_from,rtw_on,review_on,created_at,site_id'),
          supabase.from('injury_cases').select('id,case_code,event_id,classification,status,restricted_from,rtw_on,review_on,person_name,body_part,treatment,mechanism,duties,case_notes,note,user_id,created_at,site_id'),
        ])
        if (!cancel && !indexRes.error) {
          const remoteInjury = mergeInjury(indexRes.data || [], privateRes.error ? [] : (privateRes.data || []))
          setInjuryCases((prev) => {
            const remoteIds = new Set(remoteInjury.map((item) => item.id))
            const pending = prev.filter((item) => item.private && !remoteIds.has(item.id))
            const mergedInjury = [...pending, ...remoteInjury]
            saveInjuryCases(mergedInjury).catch(() => {})
            return mergedInjury
          })
        }
        setCloudNote('')
      } catch {
        if (!cancel) {
          setVaultReady(false)
          setVaultError('Could not open saved records on this device. Sign out and sign in again.')
        }
      }
    })()
    return () => { cancel = true }
  }, [userId, localUser, recovery, sealTick, session?.user?.email])

  useEffect(() => {
    if (!userId || !vaultReady) return undefined
    if (!supabase || localUser) {
      setIsAdmin(false)
      setAdminChecked(true)
      setRemoteConfig({})
      return undefined
    }
    let cancel = false
    const load = async () => {
      const [{ data: adminRow, error: adminError }, { data, error }] = await Promise.all([
        supabase.from('beta_admins').select('user_id').eq('user_id', userId).maybeSingle(),
        supabase.from('app_config').select('key,value,version,updated_at'),
      ])
      if (cancel) return
      setAdminChecked(true)
      if (!adminError) setIsAdmin(Boolean(adminRow))
      if (!error && Array.isArray(data)) {
        const map = {}
        for (const row of data) map[row.key] = row
        setRemoteConfig(map)
      }
    }
    load()
    const onWake = () => {
      if (document.visibilityState === 'hidden') return
      load()
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    const channel = supabase
      .channel(`app-config-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => load())
      .subscribe()
    return () => {
      cancel = true
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
      supabase.removeChannel(channel)
    }
  }, [userId, localUser, vaultReady])

  const persist = (next) => {
    setRows(next)
    saveRows(next).then((res) => {
      if (res?.locked) return
      setStorageWarning('')
    }).catch((error) => {
      if (error?.quota) setStorageWarning('This device is out of storage. Remove some photos and try again.')
    })
  }

  const orgIdForUser = async () => {
    if (orgIdRef.current) return orgIdRef.current
    const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle()
    orgIdRef.current = data?.org_id || null
    return orgIdRef.current
  }

  const push = async (row) => {
    if (!supabase || !user || user.local || !vaultReady) return
    const orgId = await orgIdForUser()
    if (!orgId) {
      setCloudNote('Saved on this device. Cloud sync is waiting for your organisation.')
      return
    }
    const { error } = await supabase.from('hse_records').upsert({
      id: row.id,
      org_id: orgId,
      user_id: user.id,
      site_id: isUuid(row.siteId) ? row.siteId : null,
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
    rows: rowsForSite(rows, site.activeSiteId),
    modules,
    site,
    cloudNote,
    storageWarning,
    authError,
    authNotice,
    vaultReady,
    vaultError,
    liveProjectBlocked,
    backend: isBackendEnabled,
    clearAuth() {
      setAuthError('')
      setAuthNotice('')
    },
    async signIn(email, password) {
      setAuthError('')
      setAuthNotice('')
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setAuthError(passwordSignInMessage(error))
      } catch (error) {
        setAuthError(error?.message || 'Could not sign in. Check the connection and try again.')
      }
    },
    async sendEmailCode(email) {
      setAuthError('')
      setAuthNotice('')
      const address = String(email || '').trim()
      if (!address || !address.includes('@')) {
        setAuthError('Enter the email address that should receive the code.')
        return false
      }
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true },
        })
        if (error) {
          setAuthError(emailCodeMessage(error))
          return false
        }
        setAuthNotice('Code sent. Check your inbox and spam folder.')
        return true
      } catch (error) {
        setAuthError(error?.message || 'Could not send the code. Check the connection and try again.')
        return false
      }
    },
    async verifyEmailCode(email, token) {
      setAuthError('')
      const address = String(email || '').trim()
      const code = String(token || '').replace(/\D/g, '')
      if (code.length < 6) {
        setAuthError('Enter the 6-digit code from the email.')
        return false
      }
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: address,
          token: code,
          type: 'email',
        })
        if (error) {
          setAuthError(emailCodeMessage(error))
          return false
        }
        return true
      } catch (error) {
        setAuthError(error?.message || 'Could not check that code. Check the connection and try again.')
        return false
      }
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
      sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(next))
      setLocalUser(next)
    },
    async signOut() {
      pauseWrites()
      sealing.current = true
      seenUser.current = null
      setVaultReady(false)
      setRows([])
      setInjuryCases([])
      setQrCodes([])
      setSubmissions([])
      setOrgRole('member')
      setOrgMembers([])
      setModules(defaultModulePrefs())
      setSite(loadSite())
      setIsAdmin(false)
      setAdminChecked(!isBackendEnabled)
      setRemoteConfig({})
      await sealVault()
      if (supabase) await supabase.auth.signOut()
      setLocalUser(null)
      setSession(null)
      setRecovery(false)
      sealing.current = false
      window.location.hash = '#/'
    },
    addRecord(row) {
      const stamped = { ...row, siteId: row.siteId || site.activeSiteId || '' }
      const next = [stamped, ...rows.filter((item) => item.id !== stamped.id)]
      persist(next)
      push(stamped)
    },
    saveRecords(list) {
      const now = new Date().toISOString()
      const incoming = new Map((list || []).filter((row) => row?.id).map((row) => [row.id, { ...row, siteId: row.siteId || site.activeSiteId || '', updatedAt: now }]))
      const existing = new Set(rows.map((row) => row.id))
      const added = []
      for (const row of incoming.values()) {
        if (!existing.has(row.id)) added.push(row)
      }
      const next = [...added, ...rows.map((row) => incoming.get(row.id) || row)]
      persist(next)
      for (const row of incoming.values()) push(row)
    },
    updateRecord(id, patch) {
      const next = rows.map((row) => row.id === id ? { ...row, ...patch, updatedAt: new Date().toISOString() } : row)
      persist(next)
      const saved = next.find((row) => row.id === id)
      if (saved) push(saved)
    },
    async remindAction(id) {
      const row = rows.find((item) => item.id === id)
      const today = perthDate()
      if (!row || !canRemind(row, today)) {
        return { reminded: false, sent: false, reason: 'This action was already reminded today, or it is not overdue.' }
      }
      const recordLocal = () => {
        const patch = reminderPatch(row, today)
        const next = rows.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)
        persist(next)
        const saved = next.find((item) => item.id === id)
        if (saved) push(saved)
      }
      if (!supabase || !user || user.local) {
        recordLocal()
        return { reminded: true, sent: false, reason: 'Reminder recorded on this device.' }
      }
      try {
        const token = await getAccessToken()
        const response = await fetch(`${supabaseUrl}/functions/v1/action-reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(supabaseKey ? { apikey: supabaseKey } : {}),
          },
          body: JSON.stringify({ actionId: id }),
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) {
          return { reminded: false, sent: false, reason: data.error || 'Sign in again, then try the reminder.' }
        }
        recordLocal()
        if (data.sent) return { reminded: true, sent: true, reason: 'Reminder emailed to the owner.' }
        return { reminded: true, sent: false, reason: data.reason || data.error || 'Reminder recorded in the app. Email could not be sent.' }
      } catch {
        recordLocal()
        return { reminded: true, sent: false, reason: 'Reminder recorded on this device. Email could not be sent.' }
      }
    },
    async deleteRecord(id) {
      const now = new Date().toISOString()
      const touched = []
      const next = []
      for (const row of rows) {
        if (row.id === id) continue
        const links = Array.isArray(row.links) ? row.links.filter((link) => link?.id !== id) : row.links
        if (Array.isArray(row.links) && links.length !== row.links.length) {
          const updated = { ...row, links, updatedAt: now }
          touched.push(updated)
          next.push(updated)
        } else {
          next.push(row)
        }
      }
      persist(next)
      for (const row of touched) push(row)
      if (!supabase || !user || user.local || !vaultReady) return
      let query = supabase.from('hse_records').delete().eq('id', id)
      if (orgIdRef.current) query = query.eq('org_id', orgIdRef.current)
      const { error } = await query
      if (error) setCloudNote('Removed on this device. The cloud copy could not be deleted, so it may come back on the next refresh.')
    },
    async saveInjury(fields) {
      const problem = injuryError(fields)
      if (problem) throw new Error(problem)
      const id = fields.id || generateId()
      const siteId = fields.siteId || site.activeSiteId || ''
      const localCase = toPrivateCase({
        id,
        siteId,
        caseCode: nextCaseCode(injuryCases),
        eventId: fields.eventId,
        classification: fields.classification,
        status: fields.status || 'open',
        restrictedFrom: fields.restrictedFrom,
        rtwOn: fields.rtwOn,
        createdAt: new Date().toISOString(),
        personName: fields.personName,
        bodyPart: fields.bodyPart,
        treatment: fields.treatment,
        note: fields.note,
        mechanism: fields.mechanism,
        duties: fields.duties,
        caseNotes: fields.caseNotes,
        reviewOn: fields.reviewOn,
        userId: user?.id || '',
      })
      const writeLocal = (item) => {
        setInjuryCases((prev) => {
          const next = [item, ...prev.filter((row) => row.id !== item.id)]
          saveInjuryCases(next).catch(() => {})
          return next
        })
      }
      writeLocal(localCase)
      if (!supabase || !user || user.local) return localCase
      const { data, error } = await supabase.from('injury_cases').insert({ id, ...injuryPayload({ ...fields, siteId }) })
        .select('id,case_code,event_id,classification,status,restricted_from,rtw_on,review_on,person_name,body_part,treatment,mechanism,duties,case_notes,note,user_id,created_at,site_id')
        .maybeSingle()
      if (error || !data) {
        setCloudNote('Saved on this device. The injury case could not be stored for the organisation yet.')
        return localCase
      }
      const saved = toPrivateCase(data)
      writeLocal(saved)
      return saved
    },
    async updateInjury(id, fields) {
      const existing = injuryCases.find((row) => row.id === id)
      if (!existing?.private) throw new Error('This case is not open for you to edit.')
      const problem = injuryError(fields)
      if (problem) throw new Error(problem)
      const siteId = fields.siteId || existing.siteId || site.activeSiteId || ''
      const localCase = toPrivateCase({
        ...existing,
        ...fields,
        id,
        siteId,
        caseCode: existing.caseCode,
        userId: existing.userId,
      })
      setInjuryCases((prev) => {
        const next = prev.map((row) => row.id === id ? localCase : row)
        saveInjuryCases(next).catch(() => {})
        return next
      })
      if (!supabase || !user || user.local) return localCase
      let query = supabase.from('injury_cases').update(injuryPayload({ ...fields, siteId })).eq('id', id)
      if (orgIdRef.current) query = query.eq('org_id', orgIdRef.current)
      const { data, error } = await query
        .select('id,case_code,event_id,classification,status,restricted_from,rtw_on,review_on,person_name,body_part,treatment,mechanism,duties,case_notes,note,user_id,created_at,site_id')
        .maybeSingle()
      if (error || !data) {
        setCloudNote('Saved on this device. The injury case could not be updated for the organisation yet.')
        return localCase
      }
      const saved = toPrivateCase(data)
      setInjuryCases((prev) => {
        const next = prev.map((row) => row.id === id ? saved : row)
        saveInjuryCases(next).catch(() => {})
        return next
      })
      return saved
    },
    setModule(id, on) {
      if (id === 'hse') return
      const next = { ...modules, [id]: on, hse: true }
      setModules(next)
      saveModulePrefs(next).catch(() => {})
    },
    setSite(patch) {
      setSite((prev) => {
        let sites = prev.sites || []
        if (patch.siteName != null || patch.ruleset != null || patch.clientName != null) {
          sites = sites.map((item) => (item.id === prev.activeSiteId ? {
            ...item,
            name: patch.siteName ?? item.name,
            ruleset: patch.ruleset ?? item.ruleset,
            clientName: patch.clientName ?? item.clientName,
          } : item))
        }
        const next = withActive({ ...prev, sites }, patch)
        saveSite(next).catch(() => {})
        return next
      })
    },
    selectSite(id) {
      setSite((prev) => {
        const next = withActive(prev, { activeSiteId: id, setupDone: true })
        saveSite(next).catch(() => {})
        return next
      })
    },
    async addSite({ name, ruleset = 'general', clientName = '' } = {}) {
      const cleanName = String(name || '').trim()
      if (!cleanName) throw new Error('Add the site name.')
      const draft = {
        id: crypto.randomUUID(),
        name: cleanName,
        clientName: String(clientName || '').trim(),
        ruleset: ruleset || 'general',
        logoPath: '',
        logoDataUrl: '',
      }
      const remember = (item) => {
        setSite((prev) => {
          const sites = [...(prev.sites || []).filter((siteRow) => siteRow.id !== item.id), item]
          const next = withActive(prev, { sites, activeSiteId: item.id, setupDone: true })
          saveSite(next).catch(() => {})
          return next
        })
      }
      if (!supabase || !user || user.local) {
        remember(draft)
        return draft
      }
      const { data, error } = await supabase.from('sites').insert({
        name: draft.name,
        client_name: draft.clientName,
        ruleset: draft.ruleset,
      }).select('id,name,client_name,logo_path,ruleset').single()
      if (error) throw new Error(error.message || 'Could not add that site.')
      const saved = {
        id: data.id,
        name: data.name,
        clientName: data.client_name || '',
        ruleset: data.ruleset || 'general',
        logoPath: data.logo_path || '',
        logoDataUrl: '',
      }
      remember(saved)
      return saved
    },
    async updateSite(id, patch) {
      setSite((prev) => {
        const sites = (prev.sites || []).map((item) => (item.id === id ? { ...item, ...patch } : item))
        const next = withActive(prev, { sites })
        saveSite(next).catch(() => {})
        return next
      })
      if (patch.supervisorId !== undefined || patch.supervisorName !== undefined) {
        rememberSupervisor(id, patch.supervisorName, patch.supervisorId)
        const stored = loadLocalCodes()
        const next = (stored.length ? stored : qrCodes).map((code) => (
          code.siteId === id
            ? {
                ...code,
                supervisorId: patch.supervisorId !== undefined ? patch.supervisorId : code.supervisorId,
                supervisorName: patch.supervisorName !== undefined ? patch.supervisorName : code.supervisorName,
              }
            : code
        ))
        if (!supabase || !user || user.local) saveLocalCodes(next)
        setQrCodes(next)
      }
      if (!supabase || !user || user.local) return
      const row = {}
      if (patch.name != null) row.name = patch.name
      if (patch.clientName != null) row.client_name = patch.clientName
      if (patch.ruleset != null) row.ruleset = patch.ruleset
      if (patch.logoPath != null) row.logo_path = patch.logoPath
      if (Object.prototype.hasOwnProperty.call(patch, 'supervisorId')) row.supervisor_id = patch.supervisorId || null
      if (!Object.keys(row).length) return
      const { error } = await supabase.from('sites').update(row).eq('id', id)
      if (error) throw new Error(error.message || 'Could not save that site.')
    },
    async removeSite(id) {
      if ((site.sites || []).length <= 1) throw new Error('Keep at least one site.')
      if (supabase && user && !user.local) {
        const { error } = await supabase.from('sites').delete().eq('id', id)
        if (error) throw new Error('This site still has records, or it could not be removed.')
      }
      setSite((prev) => {
        const sites = (prev.sites || []).filter((item) => item.id !== id)
        const active = sites.find((item) => item.id === prev.activeSiteId) || sites[0]
        const next = withActive(prev, { sites, activeSiteId: active?.id || '' })
        saveSite(next).catch(() => {})
        return next
      })
    },
    async uploadLogo(id, file) {
      const problem = logoError(file)
      if (problem) throw new Error(problem)
      const dataUrl = await readImageFile(file)
      if (!supabase || !user || user.local) {
        setSite((prev) => {
          const sites = (prev.sites || []).map((item) => (item.id === id ? { ...item, logoDataUrl: dataUrl, logoPath: '' } : item))
          const next = withActive(prev, { sites })
          saveSite(next).catch(() => {})
          return next
        })
        return
      }
      const orgId = await orgIdForUser()
      if (!orgId) throw new Error('Your account has no organisation yet.')
      const path = `${orgId}/${id}/logo`
      const { error } = await supabase.storage.from('site-logos').upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      })
      if (error) throw new Error(error.message || 'Could not store the logo.')
      const { error: rowError } = await supabase.from('sites').update({ logo_path: path }).eq('id', id)
      if (rowError) throw new Error(rowError.message || 'Could not save the logo on this site.')
      setSite((prev) => {
        const sites = (prev.sites || []).map((item) => (item.id === id ? { ...item, logoPath: path, logoDataUrl: dataUrl } : item))
        const next = withActive(prev, { sites })
        saveSite(next).catch(() => {})
        return next
      })
    },
    async saveOrgName(name) {
      const clean = String(name || '').trim()
      if (!clean) throw new Error('Add the company name.')
      setSite((prev) => {
        const next = { ...prev, orgName: clean }
        saveSite(next).catch(() => {})
        return next
      })
      if (!supabase || !user || user.local) return
      const orgId = await orgIdForUser()
      if (!orgId) throw new Error('Your account has no organisation yet.')
      const { error } = await supabase.from('organisations').update({ name: clean }).eq('id', orgId)
      if (error) throw new Error(error.message || 'Could not save the company name.')
    },
    async commitImport({ records = [], people = [] } = {}) {
      if (records.length) {
        const now = new Date().toISOString()
        const stamped = records.map((row) => ({
          ...row,
          siteId: row.siteId || site.activeSiteId || '',
          updatedAt: now,
        }))
        const ids = new Set(stamped.map((row) => row.id))
        persist([...stamped, ...rows.filter((row) => !ids.has(row.id))])
        for (const row of stamped) push(row)
      }
      if (!people.length) return
      setSite((prev) => {
        const incoming = new Map(people.map((person) => [person.id, person]))
        const nextPeople = [...people, ...(prev.people || []).filter((person) => !incoming.has(person.id))]
        const next = { ...prev, people: nextPeople }
        saveSite(next).catch(() => {})
        return next
      })
      if (!supabase || !user || user.local) return
      const payload = people
        .filter((person) => isUuid(person.id) && isUuid(person.siteId))
        .map((person) => ({
          id: person.id,
          site_id: person.siteId,
          full_name: person.fullName,
          role: person.role || '',
          email: person.email || '',
          phone: person.phone || '',
        }))
      if (!payload.length) return
      const { error } = await supabase.from('people').upsert(payload, { onConflict: 'id' })
      if (error) setCloudNote('Saved on this device. People could not be stored for the organisation yet.')
    },
    qrCodes: (qrCodes || []).filter((code) => code.siteId === site.activeSiteId),
    submissions: (submissions || []).filter((row) => row.siteId === site.activeSiteId),
    qrForms: resolveQrForms(remoteConfig.qr_forms?.value),
    async addQrCode({ targetId, label } = {}) {
      const active = (site.sites || []).find((item) => item.id === site.activeSiteId) || {}
      const row = {
        id: crypto.randomUUID(),
        token: newToken(),
        siteId: site.activeSiteId,
        targetType: 'form',
        targetId,
        label: String(label || '').trim(),
        active: true,
        createdAt: new Date().toISOString(),
        siteName: active.name || site.siteName || '',
        clientName: active.clientName || '',
        supervisorId: active.supervisorId || '',
        supervisorName: active.supervisorName || '',
      }
      rememberSupervisor(site.activeSiteId, active.supervisorName, active.supervisorId)
      if (!supabase || !user || user.local) {
        const next = [row, ...qrCodes.filter((code) => code.id !== row.id)]
        setQrCodes(next)
        saveLocalCodes(next)
        return row
      }
      const { data, error } = await supabase.from('qr_codes').insert({
        site_id: site.activeSiteId,
        token: row.token,
        target_type: 'form',
        target_id: targetId,
        label: row.label,
      }).select('id,token,site_id,target_type,target_id,label,active,created_at').single()
      if (error) throw new Error(error.message || 'Could not create that code.')
      const saved = { ...mapQrCode(data), siteName: row.siteName, clientName: row.clientName, supervisorId: row.supervisorId, supervisorName: row.supervisorName }
      setQrCodes((prev) => [saved, ...prev.filter((code) => code.id !== saved.id)])
      return saved
    },
    async setQrActive(id, active) {
      const next = qrCodes.map((code) => (code.id === id ? { ...code, active } : code))
      setQrCodes(next)
      if (!supabase || !user || user.local) {
        saveLocalCodes(next)
        return
      }
      const { error } = await supabase.from('qr_codes').update({ active }).eq('id', id)
      if (error) throw new Error(error.message || 'Could not update that code.')
    },
    async refreshQr() {
      if (!supabase || !user || user.local) {
        setQrCodes(loadLocalCodes())
        setSubmissions(loadLocalSubmissions())
        return
      }
      const [codeRes, subRes] = await Promise.all([
        supabase.from('qr_codes').select('id,token,site_id,target_type,target_id,label,active,created_at').order('created_at', { ascending: false }),
        supabase.from('form_submissions').select('id,site_id,qr_id,form_id,form_version,form_title,area_label,person_name,company,role,answers,failed,stopped,action_id,created_at').order('created_at', { ascending: false }).limit(400),
      ])
      if (!codeRes.error) setQrCodes((codeRes.data || []).map(mapQrCode))
      if (!subRes.error) setSubmissions((subRes.data || []).map(mapSubmission))
    },
    injuryCases: rowsForSite(injuryCases, site.activeSiteId),
    people: (site.people || []).filter((person) => person.siteId === site.activeSiteId),
    canManageSites: Boolean(user?.local) || !isBackendEnabled || orgRole === 'admin',
    orgMembers,
    orgRole,
    wording: resolveWording(remoteConfig.wording?.value),
    moduleConfig: moduleRows(remoteConfig.modules?.value),
    navModules: visibleModules(moduleRows(remoteConfig.modules?.value), modules),
    formsConfig: remoteConfig.forms?.value || null,
    inspectionTemplates: resolveTemplates(remoteConfig.inspection_templates?.value),
    trainingMatrix: resolveMatrix(remoteConfig.training_matrix?.value),
    configRaw: {
      wording: remoteConfig.wording?.value ?? null,
      forms: remoteConfig.forms?.value ?? null,
      modules: remoteConfig.modules?.value ?? null,
      inspection_templates: remoteConfig.inspection_templates?.value ?? null,
      training_matrix: remoteConfig.training_matrix?.value ?? null,
      qr_forms: remoteConfig.qr_forms?.value ?? null,
    },
    configMeta: Object.fromEntries(['wording', 'forms', 'modules', 'inspection_templates', 'training_matrix', 'qr_forms'].map((key) => {
      const row = remoteConfig[key]
      return [key, {
        version: row?.version || 0,
        updatedAt: row?.updated_at || null,
        customized: Boolean(row),
      }]
    })),
    isAdmin,
    adminChecked,
    async saveConfig(key, value) {
      if (!supabase || !user || user.local) throw new Error('Sign in to the beta project to edit configuration.')
      const orgId = await orgIdForUser()
      if (!orgId) throw new Error('Your account has no organisation yet.')
      const { error } = await supabase.from('app_config').upsert({
        org_id: orgId,
        key,
        value,
      }, { onConflict: 'org_id,key' })
      if (error) throw new Error(error.message || 'Could not save.')
      const { data } = await supabase.from('app_config').select('key,value,version,updated_at').eq('key', key).maybeSingle()
      if (data) setRemoteConfig((prev) => ({ ...prev, [key]: data }))
    },
    async logExport({ entity, entityId, summary, detail }) {
      if (!supabase || !user || user.local) return
      const orgId = await orgIdForUser()
      if (!orgId) return
      const { error } = await supabase.from('audit_events').insert({
        org_id: orgId,
        actor_id: user.id,
        action: 'export',
        entity,
        entity_id: entityId || '',
        summary: summary || 'Exported',
        after: detail || null,
      })
      if (error) throw new Error(error.message || 'Could not record the export.')
    },
    async resetConfig(key) {
      if (!supabase || !user || user.local) throw new Error('Sign in to the beta project to edit configuration.')
      const orgId = orgIdRef.current
      let query = supabase.from('app_config').delete().eq('key', key)
      if (orgId) query = query.eq('org_id', orgId)
      const { error } = await query
      if (error) throw new Error(error.message || 'Could not reset.')
      setRemoteConfig((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
  }), [ready, user, recovery, rows, injuryCases, orgMembers, orgRole, modules, site, cloudNote, storageWarning, authError, authNotice, vaultReady, vaultError, remoteConfig, isAdmin, adminChecked, qrCodes, submissions])

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
