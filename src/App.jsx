import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { STORAGE_KEYS, PHASE_NAMES, createNewShift } from './constants'
import { discardRetiredSecrets, forgetItem, safeGetItem, safeSetItem } from './utils/storage'
import { seedCompanies } from './utils/companies'
import { isProxyMode } from './utils/api'
import { supabase, isBackendEnabled } from './utils/supabase'
import { pushItems, pullItems, mergeById, clearOwner } from './utils/sync'
import { getSubscription, computeAccess, isBillingEnabled, startCheckout } from './utils/billing'
import { getMfaGate } from './utils/mfa'
import { needsAiAck } from './utils/disclaimer'
import { openVault, pauseWrites, sealVault } from './utils/secureStore'
import { buzz } from './utils/haptics'
import AuthScreen from './components/AuthScreen'
import ResetPassword from './components/ResetPassword'
import AiDisclaimer from './components/AiDisclaimer'
import Onboarding from './components/Onboarding'
import SaveTick from './components/SaveTick'
import ShiftComplete from './components/ShiftComplete'
import Paywall from './components/Paywall'
import TwoFactorChallenge from './components/TwoFactorChallenge'
import TwoFactorEnroll from './components/TwoFactorEnroll'
import DailyLog from './components/DailyLog'
import HomeScreen from './components/HomeScreen'
import Navigation from './components/Navigation'
import Settings from './components/Settings'
import ShiftHistory from './components/ShiftHistory'
import IncidentReport from './components/IncidentReport'
import IncidentsView from './components/IncidentsView'
import Learnings from './components/Learnings'
import AskSafety from './components/AskSafety'
import FieldLeadershipReport from './components/FieldLeadershipReport'
import FieldLeadershipView from './components/FieldLeadershipView'
import SwipeContainer from './components/SwipeContainer'
import IncomingHandover from './components/phases/IncomingHandover'
import MorningMeeting from './components/phases/MorningMeeting'
import SiteRounds from './components/phases/SiteRounds'
import FindingsMeeting from './components/phases/FindingsMeeting'
import DebriefHandover from './components/phases/DebriefHandover'

// Sample otpauth mark so the enrol layout can be opened with ?mfa=enroll in dev.
const PREVIEW_QR = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 29 29">' +
  '<rect width="29" height="29" fill="#fff"/>' +
  '<g fill="#111">' +
  '<path d="M2 2h7v7H2zm2 2v3h3V4zM20 2h7v7h-7zm2 2v3h3V4zM2 20h7v7H2zm2 2v3h3v-3z"/>' +
  '<path d="M12 2h2v2h-2zm4 0h2v2h-2zM12 6h5v2h-5zM18 6h1v2h-1zM12 10h2v2h-2zm4 0h3v2h-3zm4 0h2v2h-2zm4 0h3v2h-3z"/>' +
  '<path d="M2 12h2v2H2zm4 0h3v2H6zm4 0h2v5h-2zm4 0h2v2h-2zm6 0h3v2h-3zm4 0h2v3h-2z"/>' +
  '<path d="M12 16h7v2h-7zm8 0h3v2h-3zM2 16h2v2H2zm6 2h3v2H8zm12 2h5v2h-5zM12 20h2v3h-2zm4 0h3v2h-3zm4 2h2v3h-2z"/>' +
  '<path d="M12 24h5v3h-5zm6 0h2v2h-2zm4 0h5v3h-5z"/>' +
  '</g></svg>'
)

export default function App() {
  const [view, setView] = useState('home')
  const [currentPhase, setCurrentPhase] = useState(0)
  const [slideDir, setSlideDir] = useState('') // phase-change slide direction
  const [currentShift, setCurrentShift] = useState(null)
  const [shiftHistory, setShiftHistory] = useState([])
  // The model key stays on the server. A truthy stand-in keeps the AI buttons
  // enabled when this build has a proxy; the value is never sent anywhere.
  const aiKey = isProxyMode ? 'proxy' : ''
  const [showIncident, setShowIncident] = useState(false)
  const [showAskSafety, setShowAskSafety] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [learnings, setLearnings] = useState([])
  const [askChats, setAskChats] = useState([])
  const [fieldReports, setFieldReports] = useState([])
  const [showFieldReport, setShowFieldReport] = useState(false)
  const [incidents, setIncidents] = useState([])
  const [dailyLog, setDailyLog] = useState([])
  const [storageWarning, setStorageWarning] = useState('')
  // Auth: only relevant when a Supabase backend is configured. `authReady`
  // gates the first paint so we don't flash the login screen before the
  // existing session loads.
  const [session, setSession] = useState(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [authReady, setAuthReady] = useState(!isBackendEnabled)
  const [restored, setRestored] = useState(false) // cloud backup pulled this session?
  const [access, setAccess] = useState({ allowed: true, trial: false, daysLeft: 0, status: 'unknown' })
  // pending | enroll | challenge | ready | error. Records stay closed until ready.
  const [mfaGate, setMfaGate] = useState(isBackendEnabled ? 'pending' : 'ready')
  const [mfaError, setMfaError] = useState('')
  const [vaultReady, setVaultReady] = useState(false)
  const [sealTick, setSealTick] = useState(0)
  const seenUser = useRef(null)
  const sealing = useRef(false)
  const [ackNeeded, setAckNeeded] = useState(false)
  const [ackChecked, setAckChecked] = useState(false)
  // First-run walkthrough — remembered per device, shown once.
  const [onboardNeeded, setOnboardNeeded] = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEYS.ONBOARDED) } catch (_) { return false }
  })
  // Holds the just-finished shift while the completion celebration is showing.
  const [celebrating, setCelebrating] = useState(null)
  // Transient "filed ✓" pill after a save — { id, label } so rapid saves restart it.
  const [tick, setTick] = useState(null)

  // Persist to localStorage and surface a warning if it fails (usually the
  // device is out of space). Never silently drop a save.
  const persist = useCallback((key, serialized) => {
    safeSetItem(key, serialized).then((res) => {
      if (!res || res.ok || res.locked) return
      setStorageWarning(res.quota
        ? "This device is out of storage. Recent photos or changes may not have saved — remove some photos, or clear old shifts, to free space."
        : "Couldn't save changes to this device.")
    })
  }, [])

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEYS.THEME)
      if (t) setTheme(t)
    } catch (_) {}
  }, [])

  const clearRecords = useCallback(() => {
    setCurrentShift(null)
    setCurrentPhase(0)
    setShiftHistory([])
    setLearnings([])
    setAskChats([])
    setFieldReports([])
    setIncidents([])
    setDailyLog([])
    setVaultReady(false)
    setRestored(false)
  }, [])

  // Load the current session and keep it in sync (only when backend is on).
  useEffect(() => {
    if (!isBackendEnabled) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    pauseWrites()
    clearRecords()
    setMfaGate('pending')
    setAckNeeded(false)
    setAckChecked(!isBackendEnabled)
    seenUser.current = null
    try { await sealVault() } catch (_) {}
    clearOwner()
    if (isBackendEnabled) {
      try { await supabase.auth.signOut() } catch (_) {}
    }
    setAccess({ allowed: true, trial: false, daysLeft: 0, status: 'unknown' })
    setView('home')
  }, [clearRecords])

  // A different account on this device wipes the previous person's records
  // before anything of theirs can be read.
  const userId = session?.user?.id || null

  useEffect(() => {
    const prev = seenUser.current
    if (userId) seenUser.current = userId
    if (!prev || !userId || prev === userId) return
    let cancelled = false
    sealing.current = true
    pauseWrites()
    clearRecords()
    setMfaGate('pending')
    sealVault().finally(() => {
      sealing.current = false
      if (!cancelled) setSealTick((n) => n + 1)
    })
    return () => { cancelled = true }
  }, [userId, clearRecords])

  // After sign-in, require aal2 before any record is read or synced.
  // Depends on the user id, not the session object, so a token refresh does
  // not tear the vault down and reload every record.
  useEffect(() => {
    if (!isBackendEnabled) { setMfaGate('ready'); return }
    if (!session || passwordRecovery) { setMfaGate('pending'); setVaultReady(false); return }
    let cancelled = false
    setMfaGate('pending')
    setVaultReady(false)
    getMfaGate().then(gate => {
      if (cancelled) return
      setMfaGate(gate)
      setMfaError(gate === 'error' ? 'Could not check two-factor status. Try again, or sign out.' : '')
    })
    return () => { cancelled = true }
  }, [userId, passwordRecovery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open the session vault, migrate any plaintext, then let the screens render.
  useEffect(() => {
    if (mfaGate !== 'ready') return
    if (isBackendEnabled && (!session || passwordRecovery)) return
    if (sealing.current) return
    const userId = session?.user?.id || 'local'
    let cancelled = false
    ;(async () => {
      try {
        await openVault(userId)
        discardRetiredSecrets()
        const [s, h, l, ac, f, inc, dl] = await Promise.all([
          safeGetItem(STORAGE_KEYS.CURRENT_SHIFT),
          safeGetItem(STORAGE_KEYS.HISTORY),
          safeGetItem(STORAGE_KEYS.LEARNINGS),
          safeGetItem(STORAGE_KEYS.ASK_CHATS),
          safeGetItem(STORAGE_KEYS.FIELD_REPORTS),
          safeGetItem(STORAGE_KEYS.INCIDENTS),
          safeGetItem(STORAGE_KEYS.DAILY_LOG),
        ])
        await Promise.all([
          safeGetItem(STORAGE_KEYS.KNOWN_PEOPLE),
          safeGetItem(STORAGE_KEYS.KNOWN_COMPANIES),
          safeGetItem(STORAGE_KEYS.DEIDENT_TERMS),
          safeGetItem(STORAGE_KEYS.FIELD_REPORT_COMPANY),
          safeGetItem(STORAGE_KEYS.INCIDENT_COMPANY),
        ])
        if (cancelled) return
        if (s) { const shift = JSON.parse(s); setCurrentShift(shift); setCurrentPhase(shift.phase || 0) }
        if (h) setShiftHistory(JSON.parse(h))
        if (l) setLearnings(JSON.parse(l))
        if (ac) setAskChats(JSON.parse(ac))
        if (f) setFieldReports(JSON.parse(f))
        if (inc) setIncidents(JSON.parse(inc))
        if (dl) setDailyLog(JSON.parse(dl))
      } catch (_) {
        // Unreadable local data is dropped inside safeGetItem. Sync refills it.
      } finally {
        if (!cancelled) setVaultReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [mfaGate, userId, passwordRecovery, sealTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // On login, check whether the AI disclaimer still needs acknowledging
  // (named + logged — required before anyone uses the AI features).
  // This reads disclaimer_acks, so it waits until the session is aal2.
  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) {
      if (!session) { setAckNeeded(false); setAckChecked(true) }
      return
    }
    setAckChecked(false)
    let cancelled = false
    needsAiAck().then(n => { if (!cancelled) { setAckNeeded(n); setAckChecked(true) } })
    return () => { cancelled = true }
  }, [session, vaultReady])

  const refreshAccess = useCallback(async () => {
    if (!isBillingEnabled) return
    setAccess(computeAccess(await getSubscription()))
  }, [])

  // Check subscription on login. If we've just returned from Stripe checkout,
  // give the webhook a moment then re-check, and tidy the URL.
  useEffect(() => {
    if (!isBillingEnabled || !session || !vaultReady) return
    refreshAccess()
    if (typeof window !== 'undefined' && window.location.search.includes('billing=success')) {
      const t = setTimeout(refreshAccess, 2500)
      window.history.replaceState({}, '', window.location.pathname)
      return () => clearTimeout(t)
    }
  }, [session, refreshAccess, vaultReady])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    persist(STORAGE_KEYS.THEME, theme)
  }, [theme, persist])

  useEffect(() => {
    if (!vaultReady || !currentShift) return
    persist(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(currentShift))
  }, [currentShift, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.HISTORY, JSON.stringify(shiftHistory))
  }, [shiftHistory, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.LEARNINGS, JSON.stringify(learnings))
  }, [learnings, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.ASK_CHATS, JSON.stringify(askChats))
  }, [askChats, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.FIELD_REPORTS, JSON.stringify(fieldReports))
  }, [fieldReports, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents))
  }, [incidents, persist, vaultReady])

  useEffect(() => {
    if (!vaultReady) return
    persist(STORAGE_KEYS.DAILY_LOG, JSON.stringify(dailyLog))
  }, [dailyLog, persist, vaultReady])

  // Backfill company memory from reports saved before it existed — no-op once
  // anything is stored, so counts never inflate on reload.
  useEffect(() => {
    if (!vaultReady) return
    seedCompanies([
      ...incidents.map(i => i.companyName),
      ...(currentShift?.incidents || []).map(i => i.companyName),
      ...shiftHistory.flatMap(s => (s.incidents || []).map(i => i.companyName)),
      ...fieldReports.flatMap(r => [r.companyAssessed, r.yourCompany]),
    ])
  }, [incidents, fieldReports, currentShift, shiftHistory, vaultReady])

  // --- Cloud sync (only when a backend is configured + signed in) ---------

  // Restore once per login: pull cloud records and merge in any not held
  // locally (new device → full restore; same device → no-op / fills gaps).
  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady || restored) return
    let cancelled = false
    ;(async () => {
      const [cShifts, cIncidents, cLearnings, cFieldReports, cDailyLog, cAskChats] = await Promise.all([
        pullItems('shifts'), pullItems('incidents'), pullItems('learnings'), pullItems('field_reports'),
        pullItems('daily_log'), pullItems('ask_chats'),
      ])
      if (cancelled) return
      // Don't drop the active shift into history if it's still in progress.
      const activeId = currentShift?.id
      setShiftHistory(prev => mergeById(prev, cShifts.filter(s => s.id !== activeId)))
      setIncidents(prev => mergeById(prev, cIncidents))
      setLearnings(prev => mergeById(prev, cLearnings))
      setFieldReports(prev => mergeById(prev, cFieldReports))
      setDailyLog(prev => mergeById(prev, cDailyLog))
      setAskChats(prev => mergeById(prev, cAskChats))
      setRestored(true)
    })()
    return () => { cancelled = true }
  }, [session, restored, currentShift, vaultReady])

  // Push on change (debounced for the live shift, immediate for finished sets).
  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady || !currentShift) return
    const t = setTimeout(() => pushItems('shifts', [currentShift], s => ({ shift_date: s.date })), 1500)
    return () => clearTimeout(t)
  }, [currentShift, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('shifts', shiftHistory, s => ({ shift_date: s.date }))
  }, [shiftHistory, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('incidents', incidents, i => ({ occurred_at: i.time, incident_type: i.incidentType }))
  }, [incidents, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('learnings', learnings)
  }, [learnings, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('field_reports', fieldReports)
  }, [fieldReports, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('daily_log', dailyLog)
  }, [dailyLog, session, vaultReady])

  useEffect(() => {
    if (!isBackendEnabled || !session || !vaultReady) return
    pushItems('ask_chats', askChats)
  }, [askChats, session, vaultReady])

  const updateShift = useCallback((updates) => {
    setCurrentShift(prev => ({ ...prev, ...updates }))
  }, [])

  const archiveShift = useCallback((shift) => {
    if (!shift) return
    setShiftHistory(prev => {
      const idx = prev.findIndex(s => s.id === shift.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = shift; return u }
      return [shift, ...prev.slice(0, 49)]
    })
  }, [])

  const startNewShift = useCallback(() => {
    if (currentShift) archiveShift(currentShift)
    const newShift = createNewShift()
    setCurrentShift(newShift)
    setCurrentPhase(0)
    setView('shift')
  }, [currentShift, archiveShift])

  // End the shift for good: archive it, clear the active slot, back to home.
  const finishShift = useCallback(() => {
    if (!currentShift) return
    const done = currentShift
    archiveShift(done)
    setCelebrating(done) // show the completion celebration over home
    setCurrentShift(null)
    setCurrentPhase(0)
    forgetItem(STORAGE_KEYS.CURRENT_SHIFT)
    setView('home')
  }, [currentShift, archiveShift])

  const navigateToPhase = (phase) => {
    setSlideDir(phase > currentPhase ? 'in-right' : phase < currentPhase ? 'in-left' : '')
    setCurrentPhase(phase)
    updateShift({ phase })
    buzz(15) // tactile phase click
  }

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  const dismissOnboarding = () => {
    setOnboardNeeded(false)
    persist(STORAGE_KEYS.ONBOARDED, '1')
  }

  // Micro-win: buzz + a brief "filed ✓" pill. Every save should feel like one.
  const showTick = useCallback((label) => {
    buzz(20)
    setTick({ id: Date.now(), label })
  }, [])
  useEffect(() => {
    if (!tick) return
    const t = setTimeout(() => setTick(null), 1450)
    return () => clearTimeout(t)
  }, [tick])

  const addLearning = (entry) => { setLearnings(prev => [...prev, entry]); showTick('Learning saved') }
  const removeLearning = (id) => setLearnings(prev => prev.filter(l => l.id !== id))

  const addFieldReport = (entry) => { setFieldReports(prev => [entry, ...prev]); showTick('Field report filed') }

  const addIncident = (entry) => { setIncidents(prev => [entry, ...prev]); showTick('Incident filed') }

  const addDailyEntry = (entry) => { setDailyLog(prev => [...prev, entry]); showTick('Logged') }
  const removeDailyEntry = (id) => setDailyLog(prev => prev.filter(e => e.id !== id))

  const allIncidents = useMemo(() => [
    ...(currentShift?.incidents || []).map(i => ({ ...i, shiftDate: currentShift.date })),
    ...shiftHistory.filter(s => s.id !== currentShift?.id).flatMap(s => (s.incidents || []).map(i => ({ ...i, shiftDate: s.date }))),
    ...incidents,
  ].sort((a, b) => new Date(b.time) - new Date(a.time)), [currentShift, shiftHistory, incidents])

  const renderPhase = () => {
    const props = { shift: currentShift, updateShift, apiKey: aiKey, onFinish: finishShift }
    const phases = [IncomingHandover, MorningMeeting, SiteRounds, FindingsMeeting, DebriefHandover]
    const Phase = phases[currentPhase]
    if (!Phase) return null
    return (
      <>
        <Phase {...props} />
        {currentPhase < 4 && (
          <div style={{ padding: '0 1rem 2rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
            <button
              onClick={() => navigateToPhase(currentPhase + 1)}
              style={{
                width: '100%', padding: '0.875rem 1rem',
                backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)',
                borderRadius: '0.75rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: '1.5rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Next Phase</span>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.95rem' }}>
                {PHASE_NAMES[currentPhase + 1]} →
              </span>
            </button>
          </div>
        )}
      </>
    )
  }

  // Local-only look at the 2FA screens. Stripped from production builds.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const preview = new URLSearchParams(window.location.search).get('mfa')
    if (preview === 'enroll') {
      return (
        <TwoFactorEnroll
          preview={{
            factorId: 'preview',
            secret: 'JBSWY3DPEHPK3PXP',
            qrCode: PREVIEW_QR,
          }}
          onVerified={() => {}}
          onSignOut={() => {}}
        />
      )
    }
    if (preview === 'challenge') {
      return <TwoFactorChallenge onVerified={() => {}} onSignOut={() => {}} />
    }
  }

  // Wait for the session check before first paint (avoids a login-screen flash).
  if (!authReady) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }} />
  }

  // Backend on + not signed in → gate the whole app behind login.
  if (isBackendEnabled && !session) {
    return <AuthScreen />
  }

  // Landed here from a password-reset email link → must set a new password
  // before doing anything else with the (temporary) recovery session.
  if (isBackendEnabled && session && passwordRecovery) {
    return <ResetPassword onDone={() => setPasswordRecovery(false)} />
  }

  // Password-only sessions stay on enrol or the code challenge. No records yet.
  if (isBackendEnabled && session && (mfaGate === 'pending' || mfaGate === 'error')) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        {mfaGate === 'error' && (
          <div style={{ maxWidth: 340, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1.5 }}>{mfaError}</p>
            <button onClick={() => { setMfaGate('pending'); getMfaGate().then(setMfaGate) }} style={{ marginTop: '1rem', padding: '0.75rem 1.25rem', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: '0.5rem', fontWeight: 800, cursor: 'pointer' }}>Try again</button>
            <button onClick={signOut} style={{ display: 'block', width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--text-faint)', fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
          </div>
        )}
      </div>
    )
  }
  if (isBackendEnabled && session && mfaGate === 'enroll') {
    return <TwoFactorEnroll onVerified={() => getMfaGate().then(setMfaGate)} onSignOut={signOut} />
  }
  if (isBackendEnabled && session && mfaGate === 'challenge') {
    return <TwoFactorChallenge onVerified={() => getMfaGate().then(setMfaGate)} onSignOut={signOut} />
  }

  if (!vaultReady) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }} />
  }

  // AI disclaimer: named + logged acknowledgment before first use.
  if (isBackendEnabled && session && !ackChecked) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }} />
  }
  if (isBackendEnabled && session && ackNeeded) {
    return (
      <AiDisclaimer
        defaultName={session?.user?.user_metadata?.full_name || ''}
        onDone={() => setAckNeeded(false)}
      />
    )
  }

  // Trial ended + no active subscription → paywall.
  if (isBillingEnabled && !access.allowed) {
    return <Paywall onSignOut={signOut} expired={access.status === 'expired'} />
  }

  // First run on this device → one-time walkthrough before the app.
  if (onboardNeeded) {
    return <Onboarding onDone={dismissOnboarding} advisorName={session?.user?.user_metadata?.full_name || ''} />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {storageWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: 'calc(env(safe-area-inset-top) + 0.625rem) 0.875rem 0.625rem', backgroundColor: 'var(--danger)', color: 'var(--on-danger)' }}>
          <span style={{ fontSize: '0.9rem', lineHeight: 1.3 }}>⚠</span>
          <p style={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>{storageWarning}</p>
          <button onClick={() => setStorageWarning('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--on-accent)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem' }}>✕</button>
        </div>
      )}

      {access.trial && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: 'calc(0.5rem + env(safe-area-inset-top)) 0.875rem 0.5rem', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-accent)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-soft)' }}>
            {access.daysLeft} day{access.daysLeft === 1 ? '' : 's'} left in your free trial
          </span>
          <button onClick={() => startCheckout().catch(() => {})} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.5rem', color: 'var(--on-accent)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>
            Subscribe
          </button>
        </div>
      )}

      {view === 'home' && (
        <HomeScreen
          currentShift={currentShift}
          shiftHistory={shiftHistory}
          incidents={allIncidents}
          learningCount={learnings.length}
          fieldReports={fieldReports}
          dailyLog={dailyLog}
          onStartShift={startNewShift}
          onContinueShift={() => setView('shift')}
          onViewHistory={() => setView('history')}
          onIncidents={() => setView('incidents')}
          onLearnings={() => setView('learnings')}
          onSettings={() => setView('settings')}
          onAskAI={() => setShowAskSafety(true)}
          onFieldReport={() => setShowFieldReport(true)}
          onViewFieldReports={() => setView('fieldreports')}
          onReportIncident={() => setShowIncident(true)}
          onDailyLog={() => setView('dailylog')}
          advisorName={session?.user?.user_metadata?.full_name || session?.user?.email || ''}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {view === 'shift' && currentShift && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <Navigation
            phases={PHASE_NAMES}
            currentPhase={currentPhase}
            shift={currentShift}
            onPhaseChange={navigateToPhase}
            onHome={() => { archiveShift(currentShift); setView('home') }}
            onIncidents={() => setView('incidents')}
            onLearnings={() => setView('learnings')}
            onSettings={() => setView('settings')}
            onAskAI={() => setShowAskSafety(true)}
            onReportIncident={() => setShowIncident(true)}
            onFieldReport={() => setShowFieldReport(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
          <main className="flex-1 overflow-y-auto scrollbar-thin" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <SwipeContainer
                canPrev={currentPhase > 0}
                canNext={currentPhase < 4}
                onPrev={() => navigateToPhase(currentPhase - 1)}
                onNext={() => navigateToPhase(currentPhase + 1)}
                slideDir={slideDir}
                panelKey={currentPhase}
              >
                {renderPhase()}
              </SwipeContainer>
            </div>
          </main>
        </div>
      )}

      {view === 'history' && (
        <ShiftHistory history={shiftHistory} onBack={() => setView('home')} />
      )}

      {view === 'incidents' && (
        <IncidentsView incidents={allIncidents} onBack={() => setView(currentShift ? 'shift' : 'home')} advisorName={session?.user?.user_metadata?.full_name || session?.user?.email || ''} />
      )}

      {view === 'fieldreports' && (
        <FieldLeadershipView reports={fieldReports} onBack={() => setView(currentShift ? 'shift' : 'home')} onNew={() => setShowFieldReport(true)} advisorName={session?.user?.user_metadata?.full_name || session?.user?.email || ''} />
      )}

      {view === 'learnings' && (
        <Learnings
          entries={learnings}
          onAdd={addLearning}
          onRemove={removeLearning}
          apiKey={aiKey}
          onBack={() => setView(currentShift ? 'shift' : 'home')}
        />
      )}

      {view === 'dailylog' && (
        <DailyLog
          entries={dailyLog}
          onAdd={addDailyEntry}
          onRemove={removeDailyEntry}
          apiKey={aiKey}
          onBack={() => setView(currentShift ? 'shift' : 'home')}
        />
      )}

      {view === 'settings' && (
        <Settings
          onBack={() => setView(currentShift ? 'shift' : 'home')}
          userEmail={session?.user?.email}
          onSignOut={signOut}
        />
      )}

      {showIncident && (
        <IncidentReport
          apiKey={aiKey}
          onClose={() => setShowIncident(false)}
          onSave={(incident) => {
            if (currentShift) {
              updateShift({ incidents: [...(currentShift.incidents || []), incident] })
              showTick('Incident filed')
            } else {
              addIncident(incident)
            }
            setShowIncident(false)
          }}
        />
      )}

      {showFieldReport && (
        <FieldLeadershipReport
          apiKey={aiKey}
          onClose={() => setShowFieldReport(false)}
          onSave={(report) => {
            addFieldReport(report)
            setShowFieldReport(false)
          }}
        />
      )}

      {showAskSafety && (
        <AskSafety
          initialChats={askChats}
          onPersist={setAskChats}
          apiKey={aiKey}
          learnings={learnings}
          onClose={() => setShowAskSafety(false)}
        />
      )}

      {celebrating && (
        <ShiftComplete
          shift={celebrating}
          advisorName={session?.user?.user_metadata?.full_name || session?.user?.email || ''}
          onDone={() => setCelebrating(null)}
        />
      )}

      {tick && <SaveTick key={tick.id} label={tick.label} />}
    </div>
  )
}
