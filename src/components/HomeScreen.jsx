import { useState, useEffect, useRef } from 'react'
import { PHASE_NAMES } from '../constants'
import { formatDate, formatTime } from '../utils/format'
import { SettingsIcon, ThemeIcon, MicIcon, ClipboardIcon, LearningsIcon, HistoryIcon, IncidentsIcon } from './icons'
import { SECTION_LABEL } from './ui'

// HELM display face — condensed industrial (Bahnschrift on Windows, Avenir
// Next Condensed on iOS). Used for the brand mark and mission titles.
const DISPLAY = "'Bahnschrift', 'Avenir Next Condensed', 'Arial Narrow', system-ui, sans-serif"

// Small glowing icon "orb" — the signature element across the app.
function IconOrb({ children, danger, size = 42 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 38 ? '1.2rem' : '1rem',
      background: danger
        ? 'radial-gradient(circle at 50% 32%, #fda4af 0%, #f43f5e 60%, #7f1d1d 100%)'
        : 'radial-gradient(circle at 50% 32%, #ffe4c4 0%, var(--glow-a) 55%, #6b2d08 100%)',
      boxShadow: danger
        ? '0 0 18px rgba(244,63,94,0.45), inset 0 4px 7px rgba(255,255,255,0.3)'
        : '0 0 18px rgba(255,122,26,0.4), inset 0 4px 7px rgba(255,255,255,0.3)',
    }}>{children}</div>
  )
}

// Quick-action card inside the turnstile (Daily Log, Field Report, …)
function QuickCard({ onClick, icon, label, n }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem', padding: '0.9rem 0.5rem 0.75rem', width: '6.75rem', backgroundColor: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: '0.6rem', cursor: 'pointer', flexShrink: 0, scrollSnapAlign: 'center', position: 'relative', willChange: 'transform' }}>
      <span style={{ width: 44, height: 44, borderRadius: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-soft)', backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)' }}>{icon}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      {n > 0 && (
        <span style={{ position: 'absolute', top: 7, right: 7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: '999px', backgroundColor: 'var(--accent)', color: 'var(--on-accent)', fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      )}
    </button>
  )
}

// Turnstile carousel: the centred card faces you, the rest rotate away like a
// drum. Driven by native scroll (snap + momentum) with transforms applied per
// frame, so it works on every phone. Respects reduced-motion.
function Turnstile({ children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const update = () => {
      raf = 0
      const mid = el.scrollLeft + el.clientWidth / 2
      for (const card of el.children) {
        const c = card.offsetLeft + card.offsetWidth / 2
        const k = Math.max(-2, Math.min(2, (c - mid) / card.offsetWidth))
        const a = Math.abs(k)
        card.style.transform = `perspective(900px) rotateY(${k * -24}deg) scale(${1 - Math.min(a, 1.6) * 0.12})`
        card.style.opacity = `${1 - Math.min(a, 2) * 0.3}`
        card.style.zIndex = `${20 - Math.round(a * 5)}`
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div
      ref={ref}
      className="scrollbar-none"
      style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', scrollSnapType: 'x mandatory', margin: '0 -1rem 1.25rem', padding: '0.25rem calc(50% - 3.375rem)', alignItems: 'stretch', isolation: 'isolate', position: 'relative', zIndex: 0 }}
    >
      {children}
    </div>
  )
}

// Count-up for the board numerals — eases to the target on mount so opening
// the app always starts with your numbers ticking upward. Respects
// reduced-motion (jumps straight to the value).
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(target)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf
    const start = performance.now()
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setV(Math.round(target * e))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

// "Your Board" — the safety board at the mine gate, except these numbers are
// yours and they only go up. Running totals across everything ever filed.
function SiteBoard({ shiftHistory, incidents, fieldReports, dailyLog }) {
  const shifts = (shiftHistory || []).length
  const actions = (shiftHistory || []).reduce((n, s) => n + (s.rounds || []).filter(r => r.tag === 'Action').length, 0)
  // Same conservative maths as the shift-complete screen: each captured item
  // ≈ 6 min of typing you didn't do.
  const items = (shiftHistory || []).reduce((n, s) => n + (s.rounds || []).length + (s.incidents || []).length + (s.findingsReport ? 1 : 0), 0)
    + (incidents || []).length + (fieldReports || []).length + (dailyLog || []).length
  const mins = items * 6

  const cShifts = useCountUp(shifts)
  const cActions = useCountUp(actions)
  const cMins = useCountUp(mins)
  const savedLabel = cMins >= 60 ? (cMins / 60).toFixed(cMins % 60 === 0 ? 0 : 1) : cMins
  const savedUnit = cMins >= 60 ? 'hrs saved' : 'min saved'

  if (shifts + items === 0) return null

  const cell = (val, label, glow) => (
    <div key={label} style={{ flex: 1, textAlign: 'center', padding: '0.8rem 0.25rem' }}>
      <div style={{
        fontSize: '1.85rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
        ...(glow
          ? { background: 'linear-gradient(135deg, var(--glow-a), var(--glow-b))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }
          : { color: 'var(--text-primary)' }),
      }}>{val}</div>
      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginTop: '0.4rem' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--border-accent)', borderRadius: '0.5rem', padding: '0.9rem 1rem 0.4rem', marginBottom: '0.75rem', position: 'relative', overflow: 'hidden' }}>
      {/* solid top-rail, like the gate board */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: 'var(--accent)' }} />
      <div style={{ ...SECTION_LABEL, marginBottom: 0, letterSpacing: '0.22em' }}>Site board</div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {cell(cShifts, 'Shifts filed')}
        <div style={{ width: 2, backgroundColor: 'var(--border)', margin: '0.9rem 0' }} />
        {cell(cActions, 'Actions raised')}
        <div style={{ width: 2, backgroundColor: 'var(--border)', margin: '0.9rem 0' }} />
        {cell(`${savedLabel}`, savedUnit, true)}
      </div>
    </div>
  )
}

// "2h ago" / "Yesterday" / date — recent-activity timestamps.
function ago(time) {
  const d = new Date(time)
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  if (hrs < 48) return 'Yesterday'
  return formatDate(time)
}

// One row in the Recent Activity list: tinted icon tile + title + kind · time.
function RecentRow({ icon, tint, title, kind, time, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', backgroundColor: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: '0.5rem', padding: '0.75rem 0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
      <div style={{ width: 38, height: 38, borderRadius: '0.4rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', backgroundColor: tint, border: '1px solid var(--border)' }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600, marginTop: '0.1rem' }}>{kind} · {ago(time)}</div>
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: '0.9rem', flexShrink: 0 }}>›</span>
    </button>
  )
}

export default function HomeScreen({ currentShift, shiftHistory, incidents, learningCount, fieldReports, dailyLog, onStartShift, onContinueShift, onViewHistory, onIncidents, onLearnings, onSettings, onAskAI, onFieldReport, onViewFieldReports, onReportIncident, onDailyLog, advisorName, theme, onToggleTheme }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const headerBtn = { color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }

  const raw = (advisorName || '').split('@')[0].split(/[ .]/)[0]
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''

  // Everything recent, newest first — shifts, incidents, reports, log entries.
  const recentItems = [
    ...(incidents || []).map(i => ({ icon: '⚠️', tint: 'var(--error-bg-strong)', title: i.incidentType || 'Incident', kind: 'Incident', time: i.time, onClick: onIncidents })),
    ...(fieldReports || []).map(r => ({ icon: '📋', tint: 'var(--bg-highlight)', title: r.location || r.activity || 'VFL observation', kind: 'Field Report', time: r.time, onClick: onViewFieldReports })),
    ...(dailyLog || []).map(e => ({ icon: '🎤', tint: 'var(--bg-highlight)', title: e.text || 'Log entry', kind: 'Daily Log', time: e.time, onClick: onDailyLog })),
    ...(shiftHistory || []).filter(s => s.id !== currentShift?.id).map(s => ({ icon: '⛑️', tint: 'var(--success-bg)', title: `Shift — ${formatDate(s.date)}`, kind: `Phase ${(s.phase || 0) + 1} of 5`, time: s.date, onClick: onViewHistory })),
  ].filter(x => x.time).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
      {/* ambient aurora glow */}
      <div style={{ position: 'absolute', top: '-15%', right: '-20%', width: 380, height: 380, background: 'radial-gradient(circle, rgba(255,122,26,0.26), rgba(255,157,61,0.10) 45%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '10%', left: '-25%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,122,26,0.12), transparent 65%)', filter: 'blur(24px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1rem', position: 'relative' }}>
        {/* Topbar — brand mark, live clock, controls */}
        <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Safe Intelligence
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
              {formatTime(now)}
            </span>
            <button onClick={onToggleTheme} title="Toggle theme" style={headerBtn}><ThemeIcon theme={theme} /></button>
            <button onClick={onSettings} title="Settings" style={headerBtn}><SettingsIcon size={22} /></button>
          </div>
        </div>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0.5rem 0 1.1rem' }}>
          {first ? `G'day ${first}` : "G'day"} · {formatDate(now)}
        </p>

        {/* TODAY'S MISSION — the one glance: where you're up to, what's next */}
        <div style={{ position: 'relative', backgroundColor: 'var(--bg-panel)', border: '2px solid var(--border-accent)', borderRadius: '0.5rem', padding: '1rem 1.1rem 1.1rem 1.45rem', marginBottom: '0.75rem', overflow: 'hidden' }}>
          {/* hazard stripe */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 8, background: 'repeating-linear-gradient(-45deg, var(--accent) 0 7px, var(--bg-page) 7px 14px)' }} />
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '0.55rem' }}>
            Today's Mission
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.05, color: 'var(--text-primary)' }}>
            {currentShift ? PHASE_NAMES[currentShift.phase || 0] : 'Shift not started'}
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent)', marginTop: '0.3rem' }}>
            {currentShift ? `PHASE ${(currentShift.phase || 0) + 1} OF 5` : 'READY WHEN YOU ARE'}
          </div>
          {/* phase track */}
          <div style={{ display: 'flex', gap: 4, margin: '0.7rem 0 0.55rem' }}>
            {PHASE_NAMES.map((_, i) => (
              <span key={i} style={{ height: 6, flex: 1, borderRadius: 2, backgroundColor: currentShift && i <= (currentShift.phase || 0) ? 'var(--accent)' : 'var(--border)' }} />
            ))}
          </div>
          <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
            {currentShift
              ? ((currentShift.phase || 0) < 4
                ? <>Next: <b style={{ color: 'var(--text-primary)' }}>{PHASE_NAMES[(currentShift.phase || 0) + 1]}</b></>
                : <>Final phase — <b style={{ color: 'var(--text-primary)' }}>bring it home</b></>)
              : <>First up: <b style={{ color: 'var(--text-primary)' }}>{PHASE_NAMES[0]}</b></>}
          </div>
          <button
            onClick={currentShift ? onContinueShift : onStartShift}
            style={{ width: '100%', padding: '0.85rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 4, color: 'var(--on-accent)', fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 6px 20px rgba(255,122,26,0.3)' }}
          >
            {currentShift ? 'Resume ▸' : 'Start shift ▸'}
          </button>
        </div>

        {/* Ask Gaz */}
        <button onClick={onAskAI} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.55rem 0.55rem 1.1rem', borderRadius: '0.5rem', border: '2px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-faint)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
          <span>Ask Gaz anything…</span>
          <span style={{ width: 38, height: 38, borderRadius: '0.35rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', backgroundColor: 'var(--accent)', boxShadow: '0 0 14px rgba(255,122,26,0.4)' }}><MicIcon size={18} /></span>
        </button>

        {/* Report Incident — always one tap from home */}
        <button
          onClick={onReportIncident}
          style={{ width: '100%', textAlign: 'left', backgroundColor: 'var(--bg-card)', border: '2px solid var(--error-border)', borderRadius: '0.5rem', padding: '0.9rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}
        >
          <IconOrb danger><span style={{ color: '#fff', display: 'flex' }}><IncidentsIcon size={20} /></span></IconOrb>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>Report Incident</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600, marginTop: '0.15rem' }}>Log an incident with photos &amp; AI report</div>
          </div>
        </button>

        {/* Site board — running totals, mine-gate style */}
        <SiteBoard shiftHistory={shiftHistory} incidents={incidents} fieldReports={fieldReports} dailyLog={dailyLog} />

        {/* Quick actions — turnstile carousel, swipe to spin */}
        <Turnstile>
          <QuickCard onClick={onDailyLog} icon={<MicIcon size={20} />} label="Daily Log" />
          <QuickCard onClick={onFieldReport} icon={<ClipboardIcon size={19} />} label="Field Report" />
          <QuickCard onClick={onLearnings} icon={<LearningsIcon size={19} />} label="Learnings" n={learningCount} />
          <QuickCard onClick={onViewHistory} icon={<HistoryIcon size={19} />} label="Past Shifts" n={(shiftHistory || []).length} />
        </Turnstile>

        {/* Recent activity */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Recent Activity</div>
          {recentItems.length > 0 && (
            <button onClick={onViewHistory} style={{ background: 'none', border: 'none', color: 'var(--accent-soft)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>View All</button>
          )}
        </div>
        {recentItems.length === 0 ? (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px dashed var(--border-accent)', borderRadius: '0.875rem', padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: 0, fontWeight: 600 }}>
              Your shifts, incidents and reports will show up here.
            </p>
          </div>
        ) : (
          recentItems.map((item, i) => <RecentRow key={i} {...item} />)
        )}
      </div>
    </div>
  )
}

function ShiftCard({ shift }) {
  const actions = (shift.rounds || []).filter(r => r.tag === 'Action')
  const incidents = shift.incidents || []
  return (
    <div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
        {formatDate(shift.date)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', textAlign: 'center' }}>
        {[
          { val: `${(shift.phase || 0) + 1}/5`, label: 'Phase', color: 'var(--accent)' },
          { val: actions.length, label: 'Actions', color: 'var(--accent-soft)' },
          { val: incidents.length, label: 'Incidents', color: incidents.length > 0 ? 'var(--error-text)' : 'var(--success-text)' },
        ].map(({ val, label, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--bg-stat)', borderRadius: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color }}>{val}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
