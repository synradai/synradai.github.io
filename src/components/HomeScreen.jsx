import { useState, useEffect } from 'react'
import { PHASE_NAMES } from '../constants'
import { formatDate, formatTime } from '../utils/format'
import { SettingsIcon, ThemeIcon, SparkleIcon, AlertCircleIcon } from './icons'
import { SECTION_LABEL, CARD } from './ui'

export default function HomeScreen({ currentShift, shiftHistory, incidentCount, learningCount, onStartShift, onContinueShift, onViewHistory, onIncidents, onLearnings, onSettings, onAskAI, onFieldReport, onViewFieldReports, fieldReportCount, onReportIncident, onDailyLog, theme, onToggleTheme }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const lastShift = shiftHistory[0] || null

  const headerBtn = { color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...SECTION_LABEL, marginBottom: '0.2rem' }}>
              Safe Intelligence
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Field Hub
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={onToggleTheme} title="Toggle theme" style={headerBtn}>
              <ThemeIcon theme={theme} />
            </button>
            <button onClick={onSettings} title="Settings" style={headerBtn}>
              <SettingsIcon size={22} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Clock */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {formatTime(now)}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {formatDate(now)}
          </div>
        </div>

        {/* Start / Resume */}
        <div style={CARD}>
          <div style={{ ...SECTION_LABEL, marginBottom: '1rem' }}>New Shift</div>
          <button
            onClick={onStartShift}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer' }}
          >
            Start New Shift
          </button>
          {currentShift && (
            <button
              onClick={onContinueShift}
              style={{
                width: '100%', marginTop: '0.625rem', padding: '0.75rem 1rem',
                backgroundColor: 'transparent', border: '1.5px solid var(--border-accent)',
                borderRadius: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', fontWeight: 600,
              }}
            >
              <span>Continue today's shift</span>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.8rem' }}>
                Phase {(currentShift.phase || 0) + 1} — {PHASE_NAMES[currentShift.phase || 0]} →
              </span>
            </button>
          )}
        </div>

        {/* Ask Gaz */}
        <div style={CARD}>
          <div style={{ ...SECTION_LABEL, marginBottom: '1rem' }}>Quick Help</div>
          <button
            onClick={onAskAI}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span style={{ fontSize: '1.25rem' }}>👷</span> Ask Gaz
            <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.85 }}>· your safety mate</span>
          </button>
        </div>

        {/* Daily Log */}
        <div style={CARD}>
          <div style={{ ...SECTION_LABEL, marginBottom: '1rem' }}>Daily Log</div>
          <button
            onClick={onDailyLog}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            🎤 What I've been up to
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: '0.625rem 0 0', fontWeight: 600, textAlign: 'center' }}>
            Talk through your day — know exactly what you did when asked.
          </p>
        </div>

        {/* Field Leadership */}
        <div style={CARD}>
          <div style={{ ...SECTION_LABEL, marginBottom: '1rem' }}>Field Leadership</div>
          <button
            onClick={onFieldReport}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer' }}
          >
            New Field Leadership Report
          </button>
        </div>

        {/* Report Incident */}
        <div style={{ ...CARD, borderColor: 'var(--error-border)' }}>
          <div style={{ ...SECTION_LABEL, color: 'var(--error-text)', marginBottom: '1rem' }}>Incidents</div>
          <button
            onClick={onReportIncident}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--danger)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <AlertCircleIcon size={20} /> Report Incident
          </button>
        </div>

        {/* Active shift card */}
        {currentShift && (
          <div style={{ ...CARD, padding: '1rem' }}>
            <div style={SECTION_LABEL}>Active Shift</div>
            <ShiftCard shift={currentShift} />
          </div>
        )}

        {/* Last shift */}
        {!currentShift && lastShift && (
          <div style={{ ...CARD, padding: '1rem' }}>
            <div style={{ ...SECTION_LABEL, color: 'var(--text-muted)' }}>Last Shift</div>
            <ShiftCard shift={lastShift} />
          </div>
        )}

        {/* History link */}
        {shiftHistory.length > 0 && (
          <button
            onClick={onViewHistory}
            style={{
              width: '100%', padding: '0.75rem',
              backgroundColor: 'transparent', border: '1.5px solid var(--border)',
              borderRadius: '0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem',
              cursor: 'pointer', fontWeight: 700, marginBottom: '0.625rem',
            }}
          >
            View Past Shifts ({shiftHistory.length})
          </button>
        )}

        {/* Incidents / Learnings / Field Reports */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
          <GridButton onClick={onIncidents}>Incidents {incidentCount > 0 && `(${incidentCount})`}</GridButton>
          <GridButton onClick={onLearnings}>Learnings {learningCount > 0 && `(${learningCount})`}</GridButton>
          <GridButton onClick={onViewFieldReports}>Field Reports {fieldReportCount > 0 && `(${fieldReportCount})`}</GridButton>
        </div>
      </div>
    </div>
  )
}

function GridButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.75rem',
        backgroundColor: 'transparent', border: '1.5px solid var(--border)',
        borderRadius: '0.75rem', color: 'var(--text-muted)', fontSize: '0.78rem',
        cursor: 'pointer', fontWeight: 700,
      }}
    >
      {children}
    </button>
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
      <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600 }}>
        Phase: {PHASE_NAMES[shift.phase || 0]}
      </div>
    </div>
  )
}
