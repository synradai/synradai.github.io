import { useState, useEffect, useCallback, useMemo } from 'react'
import { STORAGE_KEYS, PHASE_NAMES, createNewShift } from './constants'
import { safeSetItem } from './utils/storage'
import { isProxyMode } from './utils/api'
import { supabase, isBackendEnabled } from './utils/supabase'
import { pushItems, pullItems, mergeById, clearOwner } from './utils/sync'
import { getSubscription, computeAccess, isBillingEnabled, startCheckout } from './utils/billing'
import { needsMfaChallenge } from './utils/mfa'
import AuthScreen from './components/AuthScreen'
import Paywall from './components/Paywall'
import TwoFactorChallenge from './components/TwoFactorChallenge'
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
import IncomingHandover from './components/phases/IncomingHandover'
import MorningMeeting from './components/phases/MorningMeeting'
import SiteRounds from './components/phases/SiteRounds'
import FindingsMeeting from './components/phases/FindingsMeeting'
import DebriefHandover from './components/phases/DebriefHandover'

export default function App() {
  const [view, setView] = useState('home')
  const [currentPhase, setCurrentPhase] = useState(0)
  const [currentShift, setCurrentShift] = useState(null)
  const [shiftHistory, setShiftHistory] = useState([])
  const [apiKey, setApiKey] = useState('')
  // In proxy mode the Anthropic key lives server-side, so the user has no local
  // key — but AI is still available. Pass a truthy value so feature buttons
  // don't gate themselves off (callAnthropicAPI ignores it in proxy mode).
  const aiKey = apiKey || (isProxyMode ? 'proxy' : '')
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
  const [authReady, setAuthReady] = useState(!isBackendEnabled)
  const [restored, setRestored] = useState(false) // cloud backup pulled this session?
  const [access, setAccess] = useState({ allowed: true, trial: false, daysLeft: 0, status: 'unknown' })
  const [mfaNeeded, setMfaNeeded] = useState(false)
  const [mfaChecked, setMfaChecked] = useState(false)

  // Persist to localStorage and surface a warning if it fails (usually the
  // device is out of space). Never silently drop a save.
  const persist = useCallback((key, serialized) => {
    const res = safeSetItem(key, serialized)
    if (!res.ok) {
      setStorageWarning(res.quota
        ? "This device is out of storage. Recent photos or changes may not have saved — remove some photos, or clear old shifts, to free space."
        : "Couldn't save changes to this device.")
    }
  }, [])

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT)
      const h = localStorage.getItem(STORAGE_KEYS.HISTORY)
      const k = localStorage.getItem(STORAGE_KEYS.API_KEY)
      const l = localStorage.getItem(STORAGE_KEYS.LEARNINGS)
      const ac = localStorage.getItem(STORAGE_KEYS.ASK_CHATS)
      const t = localStorage.getItem(STORAGE_KEYS.THEME)
      const f = localStorage.getItem(STORAGE_KEYS.FIELD_REPORTS)
      const inc = localStorage.getItem(STORAGE_KEYS.INCIDENTS)
      const dl = localStorage.getItem(STORAGE_KEYS.DAILY_LOG)
      if (s) { const shift = JSON.parse(s); setCurrentShift(shift); setCurrentPhase(shift.phase || 0) }
      if (h) setShiftHistory(JSON.parse(h))
      if (k) setApiKey(k)
      if (l) setLearnings(JSON.parse(l))
      if (ac) setAskChats(JSON.parse(ac))
      if (t) setTheme(t)
      if (f) setFieldReports(JSON.parse(f))
      if (inc) setIncidents(JSON.parse(inc))
      if (dl) setDailyLog(JSON.parse(dl))
    } catch (_) {}
  }, [])

  // Load the current session and keep it in sync (only when backend is on).
  useEffect(() => {
    if (!isBackendEnabled) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    if (isBackendEnabled) await supabase.auth.signOut()
    clearOwner()
    setRestored(false)
    setAccess({ allowed: true, trial: false, daysLeft: 0, status: 'unknown' })
    setMfaNeeded(false)
    setMfaChecked(false)
    setView('home')
  }, [])

  // On login, check whether this session still needs a 2FA code.
  useEffect(() => {
    if (!isBackendEnabled || !session) { setMfaNeeded(false); setMfaChecked(true); return }
    setMfaChecked(false)
    let cancelled = false
    needsMfaChallenge().then(n => { if (!cancelled) { setMfaNeeded(n); setMfaChecked(true) } })
    return () => { cancelled = true }
  }, [session])

  const refreshAccess = useCallback(async () => {
    if (!isBillingEnabled) return
    setAccess(computeAccess(await getSubscription()))
  }, [])

  // Check subscription on login. If we've just returned from Stripe checkout,
  // give the webhook a moment then re-check, and tidy the URL.
  useEffect(() => {
    if (!isBillingEnabled || !session) return
    refreshAccess()
    if (typeof window !== 'undefined' && window.location.search.includes('billing=success')) {
      const t = setTimeout(refreshAccess, 2500)
      window.history.replaceState({}, '', window.location.pathname)
      return () => clearTimeout(t)
    }
  }, [session, refreshAccess])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    persist(STORAGE_KEYS.THEME, theme)
  }, [theme, persist])

  useEffect(() => {
    if (currentShift) persist(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(currentShift))
  }, [currentShift, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.HISTORY, JSON.stringify(shiftHistory))
  }, [shiftHistory, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.LEARNINGS, JSON.stringify(learnings))
  }, [learnings, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.ASK_CHATS, JSON.stringify(askChats))
  }, [askChats, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.FIELD_REPORTS, JSON.stringify(fieldReports))
  }, [fieldReports, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents))
  }, [incidents, persist])

  useEffect(() => {
    persist(STORAGE_KEYS.DAILY_LOG, JSON.stringify(dailyLog))
  }, [dailyLog, persist])

  // --- Cloud sync (only when a backend is configured + signed in) ---------

  // Restore once per login: pull cloud records and merge in any not held
  // locally (new device → full restore; same device → no-op / fills gaps).
  useEffect(() => {
    if (!isBackendEnabled || !session || restored) return
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
  }, [session, restored, currentShift])

  // Push on change (debounced for the live shift, immediate for finished sets).
  useEffect(() => {
    if (!isBackendEnabled || !session || !currentShift) return
    const t = setTimeout(() => pushItems('shifts', [currentShift], s => ({ shift_date: s.date })), 1500)
    return () => clearTimeout(t)
  }, [currentShift, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('shifts', shiftHistory, s => ({ shift_date: s.date }))
  }, [shiftHistory, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('incidents', incidents, i => ({ occurred_at: i.time, incident_type: i.incidentType }))
  }, [incidents, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('learnings', learnings)
  }, [learnings, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('field_reports', fieldReports)
  }, [fieldReports, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('daily_log', dailyLog)
  }, [dailyLog, session])

  useEffect(() => {
    if (!isBackendEnabled || !session) return
    pushItems('ask_chats', askChats)
  }, [askChats, session])

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

  const navigateToPhase = (phase) => {
    setCurrentPhase(phase)
    updateShift({ phase })
  }

  const saveApiKey = (key) => {
    setApiKey(key)
    persist(STORAGE_KEYS.API_KEY, key)
  }

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  const addLearning = (entry) => setLearnings(prev => [...prev, entry])
  const removeLearning = (id) => setLearnings(prev => prev.filter(l => l.id !== id))

  const addFieldReport = (entry) => setFieldReports(prev => [entry, ...prev])

  const addIncident = (entry) => setIncidents(prev => [entry, ...prev])

  const addDailyEntry = (entry) => setDailyLog(prev => [...prev, entry])
  const removeDailyEntry = (id) => setDailyLog(prev => prev.filter(e => e.id !== id))

  const allIncidents = useMemo(() => [
    ...(currentShift?.incidents || []).map(i => ({ ...i, shiftDate: currentShift.date })),
    ...shiftHistory.filter(s => s.id !== currentShift?.id).flatMap(s => (s.incidents || []).map(i => ({ ...i, shiftDate: s.date }))),
    ...incidents,
  ].sort((a, b) => new Date(b.time) - new Date(a.time)), [currentShift, shiftHistory, incidents])

  const renderPhase = () => {
    const props = { shift: currentShift, updateShift, apiKey: aiKey }
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

  // Wait for the session check before first paint (avoids a login-screen flash).
  if (!authReady) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }} />
  }

  // Backend on + not signed in → gate the whole app behind login.
  if (isBackendEnabled && !session) {
    return <AuthScreen />
  }

  // Signed in but 2FA code still required this session → hold here.
  if (isBackendEnabled && session && !mfaChecked) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }} />
  }
  if (isBackendEnabled && session && mfaNeeded) {
    return <TwoFactorChallenge onVerified={() => setMfaNeeded(false)} onSignOut={signOut} />
  }

  // Trial ended + no active subscription → paywall.
  if (isBillingEnabled && !access.allowed) {
    return <Paywall onSignOut={signOut} expired={access.status === 'expired'} />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {storageWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: 'calc(env(safe-area-inset-top) + 0.625rem) 0.875rem 0.625rem', backgroundColor: 'var(--danger)', color: 'var(--on-accent)' }}>
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
          incidentCount={allIncidents.length}
          learningCount={learnings.length}
          onStartShift={startNewShift}
          onContinueShift={() => setView('shift')}
          onViewHistory={() => setView('history')}
          onIncidents={() => setView('incidents')}
          onLearnings={() => setView('learnings')}
          onSettings={() => setView('settings')}
          onAskAI={() => setShowAskSafety(true)}
          onFieldReport={() => setShowFieldReport(true)}
          onViewFieldReports={() => setView('fieldreports')}
          fieldReportCount={fieldReports.length}
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
          <main className="flex-1 overflow-y-auto scrollbar-thin" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              {renderPhase()}
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
        <FieldLeadershipView reports={fieldReports} onBack={() => setView(currentShift ? 'shift' : 'home')} advisorName={session?.user?.user_metadata?.full_name || session?.user?.email || ''} />
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
          apiKey={aiKey}
          onSave={saveApiKey}
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
    </div>
  )
}
