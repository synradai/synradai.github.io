import { useState, useRef, useEffect } from 'react'
import { loadImage, warpPerspective, applyEnhancement, cloneCanvas, dist, detectDocumentCorners } from '../utils/docScan'
import { FullScreenModal, PrimaryButton, ErrorBox } from './ui'

const ENHANCE_MODES = [
  { id: 'bw', label: 'B & W' },
  { id: 'color', label: 'Color' },
  { id: 'original', label: 'Original' },
]

const MAX_SRC = 1600
const MAX_OUT = 1100

function clampPoint(p, w, h) {
  return { x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) }
}

export default function DocScanner({ onClose, onSave }) {
  const [step, setStep] = useState('capture') // capture | crop | preview
  const [error, setError] = useState('')
  const [imgSrc, setImgSrc] = useState(null)
  const [imgEl, setImgEl] = useState(null) // canvas, .width/.height = source dims
  const [corners, setCorners] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [mode, setMode] = useState('bw')
  const [resultCanvas, setResultCanvas] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [liveCorners, setLiveCorners] = useState(null)
  const [videoDims, setVideoDims] = useState(null)
  const fileRef = useRef()
  const containerRef = useRef()
  const videoRef = useRef()
  const streamRef = useRef(null)

  const resetCorners = (w, h) => ([
    { x: w * 0.06, y: h * 0.06 },
    { x: w * 0.94, y: h * 0.06 },
    { x: w * 0.94, y: h * 0.94 },
    { x: w * 0.06, y: h * 0.94 },
  ])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const img = await loadImage(ev.target.result)
        const scale = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setImgSrc(canvas.toDataURL('image/jpeg', 0.9))
        setImgEl(canvas)
        setCorners(resetCorners(canvas.width, canvas.height))
        setStep('crop')
        setDetecting(true)
        setTimeout(() => {
          const detected = detectDocumentCorners(canvas)
          if (detected) setCorners(detected)
          setDetecting(false)
        }, 30)
      } catch (_) {
        setError('Could not load that image — try again.')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const autoDetect = () => {
    if (!imgEl) return
    setDetecting(true)
    setTimeout(() => {
      const detected = detectDocumentCorners(imgEl)
      setCorners(detected || resetCorners(imgEl.width, imgEl.height))
      setDetecting(false)
    }, 30)
  }

  // Live camera preview with a real-time edge-detection overlay.
  useEffect(() => {
    if (step !== 'capture') return
    let cancelled = false
    let liveInterval = null

    navigator.mediaDevices?.getUserMedia?.({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    }).then(async (stream) => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      const v = videoRef.current
      if (!v) { stream.getTracks().forEach(t => t.stop()); return }
      v.srcObject = stream
      try { await v.play() } catch (_) {}
      if (cancelled) return
      setVideoDims({ w: v.videoWidth, h: v.videoHeight })
      setCameraReady(true)

      liveInterval = setInterval(() => {
        if (!v.videoWidth) return
        const s = Math.min(1, 400 / Math.max(v.videoWidth, v.videoHeight))
        const work = document.createElement('canvas')
        work.width = Math.round(v.videoWidth * s)
        work.height = Math.round(v.videoHeight * s)
        work.getContext('2d').drawImage(v, 0, 0, work.width, work.height)
        const detected = detectDocumentCorners(work)
        setLiveCorners(detected ? detected.map(c => ({ x: c.x / s, y: c.y / s })) : null)
      }, 400)
    }).catch((err) => {
      if (!cancelled) setCameraError(err?.message || 'Could not access the camera.')
    })

    return () => {
      cancelled = true
      if (liveInterval) clearInterval(liveInterval)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setCameraReady(false)
      setLiveCorners(null)
      setCameraError('')
    }
  }, [step])

  const capturePhoto = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const scale = Math.min(1, MAX_SRC / Math.max(v.videoWidth, v.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(v.videoWidth * scale)
    canvas.height = Math.round(v.videoHeight * scale)
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
    setImgSrc(canvas.toDataURL('image/jpeg', 0.9))
    setImgEl(canvas)
    setCorners(resetCorners(canvas.width, canvas.height))
    setStep('crop')
    setDetecting(true)
    setTimeout(() => {
      const detected = detectDocumentCorners(canvas)
      if (detected) setCorners(detected)
      setDetecting(false)
    }, 30)
  }

  const pointerToSource = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    const px = (clientX - rect.left) / rect.width
    const py = (clientY - rect.top) / rect.height
    return clampPoint({ x: px * imgEl.width, y: py * imgEl.height }, imgEl.width, imgEl.height)
  }

  const onCornerDown = (idx) => (e) => {
    e.preventDefault()
    e.target.setPointerCapture?.(e.pointerId)
    setDragIdx(idx)
  }
  const onSvgMove = (e) => {
    if (dragIdx === null) return
    const p = pointerToSource(e.clientX, e.clientY)
    setCorners(prev => prev.map((c, i) => i === dragIdx ? p : c))
  }
  const onSvgUp = () => setDragIdx(null)

  const processImage = () => {
    setProcessing(true); setError('')
    setTimeout(() => {
      try {
        const pts = corners.map(c => [c.x, c.y])
        const [tl, tr, br, bl] = pts
        let outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)))
        let outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)))
        outW = Math.max(50, outW)
        outH = Math.max(50, outH)
        if (outW > MAX_OUT || outH > MAX_OUT) {
          const s = MAX_OUT / Math.max(outW, outH)
          outW = Math.round(outW * s)
          outH = Math.round(outH * s)
        }
        const canvas = warpPerspective(imgEl, pts, outW, outH)
        setResultCanvas(canvas)
        const enhanced = applyEnhancement(cloneCanvas(canvas), mode)
        setPreviewUrl(enhanced.toDataURL('image/jpeg', 0.8))
        setStep('preview')
      } catch (_) {
        setError('Could not process that scan — try adjusting the corners.')
      } finally {
        setProcessing(false)
      }
    }, 30)
  }

  useEffect(() => {
    if (step === 'preview' && resultCanvas) {
      const enhanced = applyEnhancement(cloneCanvas(resultCanvas), mode)
      setPreviewUrl(enhanced.toDataURL('image/jpeg', 0.8))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const save = () => { if (previewUrl) onSave(previewUrl) }

  const btnSecondary = { padding: '0.7rem 1rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }

  return (
    <FullScreenModal badge="📄" title="Document Scanner" onClose={onClose}>
      <ErrorBox style={{ marginBottom: '0.75rem' }}>{error}</ErrorBox>

      {step === 'capture' && (
        <div>
          {cameraError ? (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600, lineHeight: 1.6 }}>
                Take a photo of the JSA, permit, or other document. You'll be able to drag the corners to straighten it and clean it up next.
              </p>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '0.75rem', color: 'var(--on-accent)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                📷 Take Photo
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem', fontWeight: 600, lineHeight: 1.5 }}>
                Point the camera at the document — edges are highlighted automatically. Tap Capture when lined up.
              </p>
              <div style={{ position: 'relative', width: '100%', borderRadius: '0.5rem', overflow: 'hidden', backgroundColor: '#000' }}>
                <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', display: 'block' }} />
                {liveCorners && videoDims && (
                  <svg
                    viewBox={`0 0 ${videoDims.w} ${videoDims.h}`}
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    <polygon
                      points={liveCorners.map(c => `${c.x},${c.y}`).join(' ')}
                      fill="rgba(34,197,94,0.15)"
                      stroke="#22c55e"
                      strokeWidth={Math.max(2, videoDims.w * 0.006)}
                    />
                  </svg>
                )}
                {!cameraReady && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
                    Starting camera...
                  </div>
                )}
              </div>
              <PrimaryButton onClick={capturePhoto} disabled={!cameraReady} style={{ marginTop: '0.75rem' }}>
                📷 Capture
              </PrimaryButton>
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} style={{ ...btnSecondary, width: '100%', marginTop: '0.5rem' }}>
            {cameraError ? 'Choose Photo' : 'Choose Photo Instead'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
        </div>
      )}

      {step === 'crop' && imgEl && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem', fontWeight: 600, lineHeight: 1.5 }}>
            {detecting ? 'Detecting document edges...' : 'Drag the corners to adjust if needed.'}
          </p>
          <div ref={containerRef} style={{ position: 'relative', width: '100%', touchAction: 'none', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <img src={imgSrc} alt="Captured document" style={{ width: '100%', display: 'block' }} />
            <svg
              viewBox={`0 0 ${imgEl.width} ${imgEl.height}`}
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
              onPointerLeave={onSvgUp}
            >
              <polygon
                points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                fill="rgba(59,130,246,0.22)"
                stroke="#3b82f6"
                strokeWidth={imgEl.width * 0.005}
              />
              {corners.map((c, i) => (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={imgEl.width * 0.022}
                  fill="#3b82f6"
                  stroke="#fff"
                  strokeWidth={imgEl.width * 0.006}
                  onPointerDown={onCornerDown(i)}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                />
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button onClick={autoDetect} disabled={detecting} style={{ ...btnSecondary, flex: 1, opacity: detecting ? 0.6 : 1 }}>{detecting ? 'Detecting...' : '✨ Auto-Detect'}</button>
            <button onClick={() => setCorners(resetCorners(imgEl.width, imgEl.height))} style={{ ...btnSecondary, flex: 1 }}>Reset Corners</button>
            <button onClick={() => { setStep('capture'); setImgEl(null); setImgSrc(null) }} style={{ ...btnSecondary, flex: 1 }}>Retake</button>
          </div>
          <PrimaryButton onClick={processImage} loading={processing} style={{ marginTop: '0.75rem' }}>
            {processing ? 'Processing...' : 'Flatten & Continue'}
          </PrimaryButton>
        </div>
      )}

      {step === 'preview' && previewUrl && (
        <div>
          <img src={previewUrl} alt="Scanned document" style={{ width: '100%', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {ENHANCE_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.5rem',
                  border: mode === m.id ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  backgroundColor: mode === m.id ? 'var(--bg-highlight)' : 'var(--bg-panel)',
                  color: mode === m.id ? 'var(--accent-soft)' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <PrimaryButton onClick={save} style={{ marginBottom: '0.5rem' }}>Use This Scan</PrimaryButton>
          <button onClick={() => setStep('crop')} style={{ ...btnSecondary, width: '100%' }}>← Adjust Corners</button>
        </div>
      )}
    </FullScreenModal>
  )
}
