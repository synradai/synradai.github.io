import { useState, useEffect } from 'react'
import { PHASE_NAMES } from '../constants'
import { formatDate, formatTime } from '../utils/format'
import { SettingsIcon, ThemeIcon, MicIcon } from './icons'
import { SECTION_LABEL } from './ui'

// Small glowing icon "orb" — the signature element across the app.
function IconOrb({ children, danger }) {
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
      background: danger
        ? 'radial-gradient(circle at 50% 32%, #fda4af 0%, #f43f5e 60%, #7f1d1d 100%)'
        : 'radial-gradient(circle at 50% 32%, #bfdbfe 0%, var(--glow-a) 58%, #1e3a8a 100%)',
      boxShadow: danger
        ? '0 0 18px rgba(244,63,94,0.45), inset 0 4px 7px rgba(255,255,255,0.3)'
        : '0 0 18px rgba(59,130,246,0.5), inset 0 4px 7px rgba(255,255,255,0.3)',
    }}>{children}</div>
  )
}

function ActionCard({ emoji, label, sub, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '1rem', padding: '1rem', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.7rem', minHeight: '7.5rem',
      }}
    >
      <IconOrb danger={danger}>{emoji}</IconOrb>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600, marginTop: '0.15rem' }}>{sub}</div>
      </div>
    </button>
  )
}

function Chip({ onClick, label, n }) {
  return (
    <button onClick={onClick} style={{ padding: '0.7rem 0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700 }}>
      {label}{n > 0 && <span style={{ color: 'var(--accent-soft)' }}> {n}</span>}
    </button>
  )
}

export default function HomeScreen({ currentShift, shiftHistory, incidentCount, learningCount, onStartShift, onContinueShift, onViewHistory, onIncidents, onLearnings, onSettings, onAskAI, onFieldReport, onViewFieldReports, fieldReportCount, onReportIncident, onDailyLog, advisorName, theme, onToggleTheme }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const lastShift = shiftHistory[0] || null
  const headerBtn = { color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }

  const raw = (advisorName || '').split('@')[0].split(/[ .]/)[0]
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''
  const greeting = first ? `Hi ${first},` : "G'day,"

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', position: 'relative', overflow: 'hidden', paddingBottom: '5.5rem' }}>
      {/* ambient glow */}
      <div style={{ position: 'absolute', top: '-15%', right: '-20%', width: 360, height: 360, background: 'radial-gradient(circle, rgba(59,130,246,0.22), rgba(34,211,238,0.08) 45%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1rem', position: 'relative' }}>
        {/* Header */}
        <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Safe Intelligence</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={onToggleTheme} title="Toggle theme" style={headerBtn}><ThemeIcon theme={theme} /></button>
            <button onClick={onSettings} title="Settings" style={headerBtn}><SettingsIcon size={22} /></button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1, background: theme === 'light' ? 'linear-gradient(180deg, #1e293b 0%, #2563eb 130%)' : 'linear-gradient(180deg, #ffffff 0%, #bcd2ef 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', fontWeight: 600 }}>
            {formatTime(now)} · {formatDate(now)}
          </p>
        </div>

        {/* Primary CTA — start / resume shift */}
        <button
          onClick={currentShift ? onContinueShift : onStartShift}
          style={{
            width: '100%', textAlign: 'left', border: 'none', borderRadius: '1rem', padding: '1.1rem 1.25rem',
            cursor: 'pointer', marginBottom: '0.75rem', color: '#fff',
            background: 'linear-gradient(135deg, var(--glow-a) 0%, #2563eb 55%, var(--glow-c) 100%)',
            boxShadow: '0 8px 26px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{currentShift ? "Resume today's shift" : 'Start New Shift'}</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.92, fontWeight: 600, marginTop: '0.2rem' }}>
              {currentShift ? `Phase ${(currentShift.phase || 0) + 1} · ${PHASE_NAMES[currentShift.phase || 0]}` : 'Begin your shift workflow'}
            </div>
          </div>
          <span style={{ fontSize: '1.5rem', opacity: 0.9 }}>→</span>
        </button>

        {/* Action grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <ActionCard emoji="🎤" label="Daily Log" sub="what I've been up to" onClick={onDailyLog} />
          <ActionCard emoji="📋" label="Field Leadership" sub="VFL observation" onClick={onFieldReport} />
        </div>

        {/* Report Incident — full width, prominent */}
        <button
          onClick={onReportIncident}
          style={{ width: '100%', textAlign: 'left', backgroundColor: 'var(--bg-card)', border: '1px solid var(--error-border)', borderRadius: '1rem', padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}
        >
          <IconOrb danger>⚠️</IconOrb>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Report Incident</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600, marginTop: '0.15rem' }}>Log an incident with photos &amp; AI report</div>
          </div>
        </button>

        {/* Count chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', marginBottom: '0.75rem' }}>
          <Chip onClick={onIncidents} label="Incidents" n={incidentCount} />
          <Chip onClick={onLearnings} label="Learnings" n={learningCount} />
          <Chip onClick={onViewFieldReports} label="Field Reports" n={fieldReportCount} />
        </div>

        {shiftHistory.length > 0 && (
          <button onClick={onViewHistory} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem' }}>
            View Past Shifts ({shiftHistory.length})
          </button>
        )}

        {/* Active / last shift summary */}
        {(currentShift || lastShift) && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ ...SECTION_LABEL, color: currentShift ? 'var(--accent)' : 'var(--text-muted)' }}>{currentShift ? 'Active Shift' : 'Last Shift'}</div>
            <ShiftCard shift={currentShift || lastShift} />
          </div>
        )}
      </div>

      {/* Bottom CTA pill — quick Gaz access */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))', background: 'linear-gradient(180deg, transparent, var(--bg-page) 45%)', pointerEvents: 'none' }}>
        <button onClick={onAskAI} style={{ pointerEvents: 'auto', display: 'flex', width: '100%', maxWidth: 700, margin: '0 auto', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.7rem 0.75rem 0.7rem 1.1rem', borderRadius: '999px', border: '1px solid var(--border-accent)', backgroundColor: 'var(--bg-panel)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
          <span>Ask Gaz anything…</span>
          <span style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, var(--glow-a), var(--glow-c))', boxShadow: '0 0 16px rgba(59,130,246,0.6)' }}><MicIcon size={17} /></span>
        </button>
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
