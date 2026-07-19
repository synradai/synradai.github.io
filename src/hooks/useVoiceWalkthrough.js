import { useState, useRef, useEffect } from 'react'

// One-mic voice walkthrough shared by the report composers. A single
// continuous speech session walks a list of fields in order:
//   - steps marked `auto: true` (short fields — company, location, type)
//     advance to the next box after each utterance: say it, it lands, moves on
//   - long fields stay put until "next" / "skip" / "done"
// Spoken commands always work: next / skip / done.
//
// `onText(key, transcript)` puts the words in the right field. Return the
// string 'stay' to hold the current step even if it's auto (e.g. the spoken
// incident type didn't match anything). `onStep(i)` fires on every move so the
// caller can scroll + highlight the active box.
export function useVoiceWalkthrough({ steps, onText, onStep, onError }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const activeRef = useRef(false)
  const stepRef = useRef(0)
  // Latest handlers, so the long-lived recognition callbacks never go stale.
  const h = useRef({})
  h.current = { steps, onText, onStep, onError }

  const stop = () => {
    activeRef.current = false
    try { recRef.current?.stop() } catch (_) {}
    setActive(false); setListening(false)
  }

  const goTo = (i) => {
    if (i >= h.current.steps.length) { stop(); return }
    setStep(i); stepRef.current = i
    h.current.onStep?.(i)
  }

  const beginRec = (SR) => {
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const t = e.results[i][0].transcript.trim()
        const lc = t.toLowerCase().replace(/[.!?,]/g, '').trim()
        if (lc === 'next' || lc === 'next section' || lc === 'next one') { goTo(stepRef.current + 1); continue }
        if (lc === 'skip' || lc === 'skip section' || lc === 'leave it') { goTo(stepRef.current + 1); continue }
        if (lc === 'done' || lc === 'finish' || lc === 'stop' || lc === 'that\'s it') { stop(); continue }
        const cur = h.current.steps[stepRef.current]
        const verdict = h.current.onText?.(cur.key, t)
        if (cur.auto && verdict !== 'stay') goTo(stepRef.current + 1)
      }
    }
    rec.onend = () => { if (activeRef.current) { try { rec.start() } catch (_) {} } else setListening(false) }
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return
      activeRef.current = false; setActive(false); setListening(false)
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') h.current.onError?.('Microphone permission denied — allow mic access in your settings.')
    }
    try { rec.start(); recRef.current = rec; setListening(true) } catch (_) { h.current.onError?.('Could not start voice — try again.') }
  }

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { h.current.onError?.('Voice isn\'t supported in this browser. On iPhone, tap the microphone on your keyboard for each box instead.'); return }
    if (!window.isSecureContext) { h.current.onError?.('Voice needs a secure (HTTPS) connection.'); return }
    setActive(true); activeRef.current = true
    goTo(0)
    beginRec(SR)
  }

  const next = () => goTo(stepRef.current + 1)

  // Kill the mic if the composer unmounts mid-walkthrough.
  useEffect(() => () => { activeRef.current = false; try { recRef.current?.stop() } catch (_) {} }, [])

  return { active, step, listening, start, stop, next }
}
