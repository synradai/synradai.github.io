import { useState, useRef } from 'react'
import { callAnthropicAPI, buildPolishPrompt } from '../utils/api'

const SAFETY_WORDS = [
  'hazard identified', 'hazard', 'near miss', 'PPE not worn', 'PPE required', 'PPE',
  'SWMS not followed', 'SWMS', 'JSA required', 'JSA',
  'permit to work', 'hot work permit', 'permit cancelled',
  'isolation required', 'isolation', 'LOTO', 'tagged out', 'locked out',
  'exclusion zone', 'exclusion zone breached', 'spotter required', 'spotter absent',
  'barricaded', 'barricade removed', 'secured',
  'working at heights', 'fall risk', 'edge protection missing',
  'confined space', 'confined space entry',
  'elevated work platform', 'EWP',
  'scaffolding incomplete', 'scaffolding',
  'pre-start incomplete', 'pre-start not completed', 'pre-start',
  'plant defect', 'plant out of service', 'plant',
  'crusher', 'conveyor', 'haul truck', 'excavator', 'dozer', 'grader',
  'heat stress risk', 'heat stress', 'hydration check required',
  'dust suppression', 'dust levels elevated', 'dust',
  'noise hazard', 'hearing protection required',
  'corrective action required', 'corrective action',
  'immediately rectified', 'immediately',
  'crew briefed', 'crew notified',
  'supervisor notified', 'supervisor',
  'site manager notified', 'site manager',
  'emergency services', 'medical attention required',
  'under investigation', 'investigation required',
  'maintenance shutdown', 'maintenance required',
  'permit required', 'risk assessment required',
  'ROM pad', 'processing plant', 'tailings dam',
  'blast exclusion zone', 'blast clearance',
  'tailgate meeting', 'toolbox talk',
]

export default function SafetyTextarea({ value, onChange, placeholder, rows = 3, style, apiKey }) {
  const [suggestions, setSuggestions] = useState([])
  const [cursorWordStart, setCursorWordStart] = useState(0)
  const [cursorWordEnd, setCursorWordEnd] = useState(0)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [voiceErr, setVoiceErr] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [polishErr, setPolishErr] = useState('')
  const ref = useRef()
  const recRef = useRef(null)
  const valueRef = useRef(value)
  const listeningRef = useRef(false)
  const silenceTimerRef = useRef(null)
  valueRef.current = value

  const setNativeValue = (newVal) => {
    const nativeInput = ref.current
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(nativeInput, newVal)
    nativeInput.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const handleChange = (e) => {
    onChange(e)
    updateSuggestions(e.target.value, e.target.selectionStart)
  }

  const updateSuggestions = (val, cursor) => {
    const before = val.slice(0, cursor)
    // get last word or phrase fragment (up to 3 words back)
    const match = before.match(/[\w\s]{1,30}$/)
    if (!match) { setSuggestions([]); return }

    const fragment = match[0].trimStart().toLowerCase()
    if (fragment.length < 2) { setSuggestions([]); return }

    const wordStart = cursor - match[0].length + (match[0].length - match[0].trimStart().length)
    setCursorWordStart(wordStart)
    setCursorWordEnd(cursor)

    const hits = SAFETY_WORDS.filter(w =>
      w.toLowerCase().startsWith(fragment) && w.toLowerCase() !== fragment
    ).slice(0, 5)

    setSuggestions(hits)
  }

  const applySuggestion = (word) => {
    const before = value.slice(0, cursorWordStart)
    const after = value.slice(cursorWordEnd)
    const newVal = before + word + after
    const newCursor = cursorWordStart + word.length

    setNativeValue(newVal)
    ref.current.setSelectionRange(newCursor, newCursor)
    ref.current.focus()
    setSuggestions([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setSuggestions([])
  }

  const VOICE_ERROR_MESSAGES = {
    'not-allowed': 'Microphone permission denied — check your browser/site settings and allow microphone access.',
    'service-not-allowed': 'Microphone permission denied — check your browser/site settings and allow microphone access.',
    'audio-capture': 'No microphone found on this device.',
    'network': 'Voice recognition needs an internet connection.',
  }

  // Auto-stop after 30s of true silence so the mic doesn't run forever — but
  // keep listening through normal thinking pauses (timer resets on any speech).
  const SILENCE_MS = 30000
  const armSilence = () => {
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      listeningRef.current = false
      try { recRef.current?.stop() } catch (_) {}
      setListening(false)
      setInterim('')
    }, SILENCE_MS)
  }

  const startVoice = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) { setVoiceErr('Voice input is not supported in this browser. On iPhone, use the microphone on your keyboard instead.'); return }
    if (!window.isSecureContext) {
      setVoiceErr('Voice input needs a secure connection (HTTPS) or localhost.')
      return
    }
    setVoiceErr('')
    setSuggestions([])
    listeningRef.current = true
    setListening(true)
    armSilence()
    beginRec(SpeechRec)
  }

  // Keep listening through natural pauses. Mobile browsers auto-end speech
  // recognition after a short silence, so while the mic is on we restart it
  // instead of stopping — only the Stop button (or a real error) ends it.
  const beginRec = (SpeechRec) => {
    const rec = new SpeechRec()
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let final = '', inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else inter += e.results[i][0].transcript
      }
      if (final.trim()) {
        const cur = valueRef.current || ''
        const sep = cur && !/\s$/.test(cur) ? ' ' : ''
        setNativeValue(cur + sep + final.trim() + ' ')
      }
      setInterim(inter)
      if (final.trim() || inter.trim()) armSilence() // speech heard — reset the 30s clock
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return // pause — let onend restart
      listeningRef.current = false
      clearTimeout(silenceTimerRef.current)
      setListening(false)
      setVoiceErr(VOICE_ERROR_MESSAGES[e.error] || 'Voice input stopped — tap Voice to try again.')
    }
    rec.onend = () => {
      setInterim('')
      if (listeningRef.current) {
        try { rec.start() } catch (_) {
          try { beginRec(SpeechRec) } catch (_) { listeningRef.current = false; setListening(false) }
        }
      } else {
        clearTimeout(silenceTimerRef.current)
        setListening(false)
      }
    }
    try {
      rec.start()
      recRef.current = rec
    } catch (_) {
      listeningRef.current = false
      setListening(false)
      setVoiceErr('Could not start voice input — try again.')
    }
  }

  const stopVoice = () => {
    listeningRef.current = false
    clearTimeout(silenceTimerRef.current)
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }

  const runAI = async () => {
    if (!apiKey || !value?.trim() || polishing) return
    setPolishing(true)
    setPolishErr('')
    try {
      const fixed = await callAnthropicAPI(apiKey, buildPolishPrompt(value), 1500)
      setNativeValue(fixed.trim())
    } catch (e) {
      setPolishErr(e.message)
    } finally {
      setPolishing(false)
    }
  }

  const sep = listening && interim && value && !/\s$/.test(value) ? ' ' : ''
  const displayValue = listening ? value + sep + interim : value

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
          {suggestions.map(word => (
            <button
              key={word}
              onMouseDown={e => { e.preventDefault(); applySuggestion(word) }}
              style={{
                padding: '0.2rem 0.65rem', border: '1.5px solid var(--accent)',
                borderRadius: '1rem', backgroundColor: 'var(--border-accent)',
                color: 'var(--accent-soft)', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {word}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={listening ? stopVoice : startVoice}
            style={{
              padding: '0.2rem 0.65rem', border: 'none', borderRadius: '1rem', cursor: 'pointer',
              backgroundColor: listening ? 'var(--error-bg-strong)' : 'var(--border)',
              color: listening ? 'var(--error-text)' : 'var(--text-muted)',
              fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
            }}
          >
            {listening ? '● Stop' : '🎤 Voice'}
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={runAI}
            disabled={!apiKey || !value?.trim() || polishing || listening}
            title={!apiKey ? 'Add an API key in Settings to use AI fixes' : 'Rewrite professionally: concise, formal tone, correct safety terminology'}
            style={{
              padding: '0.2rem 0.65rem', border: 'none', borderRadius: '1rem',
              cursor: (!apiKey || !value?.trim() || polishing || listening) ? 'not-allowed' : 'pointer',
              backgroundColor: 'var(--border)',
              color: 'var(--accent-soft)',
              fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
              opacity: (!apiKey || !value?.trim() || listening) ? 0.4 : 1,
            }}
          >
            {polishing ? '✨ AI...' : '✨ AI'}
          </button>
        </div>
      </div>

      {voiceErr && <div style={{ fontSize: '0.7rem', color: 'var(--error-text)', marginBottom: '0.4rem', fontWeight: 600 }}>{voiceErr}</div>}
      {polishErr && <div style={{ fontSize: '0.7rem', color: 'var(--error-text)', marginBottom: '0.4rem', fontWeight: 600 }}>{polishErr}</div>}

      <textarea
        ref={ref}
        value={displayValue}
        onChange={listening ? onChange : handleChange}
        readOnly={listening}
        onKeyDown={handleKeyDown}
        onSelect={e => !listening && updateSuggestions(e.target.value, e.target.selectionStart)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...style, color: (listening && interim) ? 'var(--text-muted)' : style?.color }}
      />
    </div>
  )
}
