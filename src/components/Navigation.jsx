import { PHASE_SHORT } from '../constants'
import { HomeIcon, IncidentsIcon, LearningsIcon, SettingsIcon, ThemeIcon, SparkleIcon, AlertCircleIcon, ClipboardIcon } from './icons'

function phaseHasContent(shift, i) {
  if (!shift) return false
  switch (i) {
    case 0: return !!(shift.handover?.notes || shift.handover?.openActions?.length)
    case 1: return !!(shift.meeting?.topics?.length || shift.meeting?.agendaNotes)
    case 2: return !!(shift.rounds?.length)
    case 3: return !!(shift.findingsReport)
    case 4: return !!(shift.debrief?.handoverNotes || shift.debrief?.signoffTime)
    default: return false
  }
}

export default function Navigation({ phases, currentPhase, shift, onPhaseChange, onHome, onIncidents, onLearnings, onSettings, onAskAI, onReportIncident, onFieldReport, theme, onToggleTheme }) {
  const done = phases.map((_, i) => phaseHasContent(shift, i))

  // Top-bar tool buttons, shared between desktop and mobile rows.
  const tools = [
    { onClick: onIncidents, title: 'Incidents', color: 'var(--text-faint)', Icon: IncidentsIcon },
    { onClick: onLearnings, title: 'Learnings', color: 'var(--text-faint)', Icon: LearningsIcon },
    { onClick: onFieldReport, title: 'Field Leadership Report', color: 'var(--accent-soft)', Icon: ClipboardIcon },
    { onClick: onAskAI, title: 'Ask Gaz', color: 'var(--accent)', Icon: SparkleIcon },
    { onClick: onReportIncident, title: 'Report Incident', color: 'var(--danger)', Icon: AlertCircleIcon },
    { onClick: onToggleTheme, title: 'Toggle theme', color: 'var(--text-faint)', Icon: (p) => <ThemeIcon theme={theme} {...p} /> },
    { onClick: onSettings, title: 'Settings', color: 'var(--text-faint)', Icon: SettingsIcon },
  ]

  return (
    <>
      {/* Desktop top nav */}
      <div className="hidden md:block" style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '3.25rem' }}>
            <button onClick={onHome} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1.25rem', padding: 0, flexShrink: 0 }}>
              ← Home
            </button>
            <nav style={{ display: 'flex', flex: 1, height: '100%' }}>
              {phases.map((name, i) => (
                <button
                  key={i}
                  onClick={() => onPhaseChange(i)}
                  style={{
                    padding: '0 0.625rem', height: '100%',
                    background: 'none', border: 'none',
                    borderBottom: `2.5px solid ${currentPhase === i ? 'var(--accent)' : 'transparent'}`,
                    color: currentPhase === i ? 'var(--accent-soft)' : done[i] ? 'var(--text-muted)' : 'var(--text-faint)',
                    fontSize: '0.7rem', fontWeight: currentPhase === i ? 800 : 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  {done[i] && currentPhase !== i && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--success)', flexShrink: 0, display: 'inline-block' }} />
                  )}
                  <span style={{ opacity: 0.5, marginRight: '0.15rem', fontSize: '0.6rem' }}>{i + 1}.</span>{name}
                </button>
              ))}
            </nav>
            {tools.map(({ onClick, title, color, Icon }) => (
              <button key={title} onClick={onClick} title={title} style={{ color, background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', flexShrink: 0 }}>
                <Icon size={17} />
              </button>
            ))}
          </div>

          {/* Progress strip */}
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '0.5rem' }}>
            {phases.map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => onPhaseChange(i)}
                  style={{
                    width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                    backgroundColor: currentPhase === i ? 'var(--accent)' : done[i] ? 'var(--success)' : 'var(--border)',
                    boxShadow: currentPhase === i ? '0 0 8px rgba(79,141,247,0.6)' : 'none',
                    transition: 'background-color 0.2s',
                  }}
                />
                {i < phases.length - 1 && (
                  <div style={{ flex: 1, height: 2, backgroundColor: done[i] ? 'var(--success-border)' : 'var(--border)', borderRadius: 1 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar — Home + the five phases; no top bar on mobile */}
      <div className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        backgroundColor: 'var(--bg-header)', borderTop: '1px solid var(--border)',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <button
          onClick={onHome}
          title="Home"
          style={{ flexShrink: 0, padding: '0.5rem 0.9rem 0.4rem', background: 'none', border: 'none', borderTop: '2.5px solid transparent', borderRight: '1px solid var(--border)', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon size={18} />
        </button>
        {PHASE_SHORT.map((short, i) => (
          <button
            key={i}
            onClick={() => onPhaseChange(i)}
            style={{
              flex: 1, padding: '0.5rem 0 0.4rem', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
              borderTop: `2.5px solid ${currentPhase === i ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '0.75rem', color: currentPhase === i ? 'var(--accent-soft)' : done[i] ? 'var(--success)' : 'var(--text-faint)' }}>
              {done[i] && currentPhase !== i ? '✓' : i + 1}
            </span>
            <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: currentPhase === i ? 'var(--accent-soft)' : done[i] ? 'var(--text-muted)' : 'var(--text-faint)' }}>
              {short}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
