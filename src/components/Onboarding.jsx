import { useState } from 'react'
import { PHASE_SHORT } from '../constants'
import { PrimaryButton } from './ui'

// First-run walkthrough — shown once, so a new trial user actually understands
// the shift workflow, voice capture, offline behaviour and data handling before
// they're dropped into the app. Dismissal is remembered on the device.
const SLIDES = [
  {
    icon: '👋',
    title: "G'day — welcome to Safe Intelligence",
    body: "Your shift, written up for you. Talk it in as you go and the paperwork's done before you're back at the crib room.",
  },
  {
    icon: '📋',
    title: 'Your whole shift, one swipe at a time',
    body: 'A shift moves through five phases. Swipe between them — each one captures what matters and rolls straight into your reports.',
    phases: true,
  },
  {
    icon: '🎙️',
    title: "Talk, don't type",
    body: 'Tap the mic and just talk. Gaz turns your voice notes into site rounds, incident reports and handovers, written to Australian standards.',
  },
  {
    icon: '📶',
    title: 'Built for site, not the office',
    body: "Works offline where there's no signal. Everything saves to your phone and syncs when you're back in range.",
  },
  {
    icon: '🔒',
    title: 'Your data stays yours',
    body: 'Scanned documents have company names and branding stripped before anything is sent for write-up. Your records stay private to your account.',
  },
]

export default function Onboarding({ onDone, advisorName }) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1
  const first = advisorName ? advisorName.trim().split(/\s+/)[0] : ''

  const next = () => (last ? onDone() : setI(i + 1))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 1rem) 1.5rem calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
      {/* Skip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: '1.5rem' }}>
        {!last && (
          <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            Skip
          </button>
        )}
      </div>

      {/* Slide body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <div key={i} className="entry-in" style={{ width: '100%' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.6rem', backgroundColor: 'var(--bg-panel)', border: '1.5px solid var(--border-accent)', boxShadow: '0 0 44px rgba(255,157,61,0.22)' }}>
            {slide.icon}
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem', lineHeight: 1.2 }}>
            {i === 0 && first ? `G'day ${first} — welcome to Safe Intelligence` : slide.title}
          </h1>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
            {slide.body}
          </p>

          {slide.phases && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              {PHASE_SHORT.map((p, idx) => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-soft)', backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border-accent)' }}>
                    {p}
                  </span>
                  {idx < PHASE_SHORT.length - 1 && <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>→</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress dots + advance */}
      <div style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {SLIDES.map((_, idx) => (
            <span key={idx} style={{ width: idx === i ? 20 : 7, height: 7, borderRadius: 999, backgroundColor: idx === i ? 'var(--accent)' : 'var(--border-accent)', transition: 'width 0.2s ease' }} />
          ))}
        </div>
        <PrimaryButton onClick={next}>
          {last ? "Let's go" : 'Next'}
        </PrimaryButton>
      </div>
    </div>
  )
}
