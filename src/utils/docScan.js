// Lightweight document-scanner helpers: perspective ("flatten") correction
// and contrast/B&W enhancement, all via Canvas — no external libraries.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v }

export function cloneCanvas(c) {
  const n = document.createElement('canvas')
  n.width = c.width
  n.height = c.height
  n.getContext('2d').drawImage(c, 0, 0)
  return n
}

// Solve an 8x8 linear system via Gaussian elimination with partial pivoting.
function solve8(A, b) {
  const n = 8
  const M = A.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k
    ;[M[i], M[maxRow]] = [M[maxRow], M[i]]
    const pivot = M[i][i] || 1e-12
    for (let k = i; k <= n; k++) M[i][k] /= pivot
    for (let k = 0; k < n; k++) {
      if (k === i) continue
      const factor = M[k][i]
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j]
    }
  }
  return M.map(row => row[n])
}

// Coefficients [a,b,c,d,e,f,g,h] mapping (x,y) -> (X,Y):
// X = (a*x+b*y+c)/(g*x+h*y+1), Y = (d*x+e*y+f)/(g*x+h*y+1)
function getPerspectiveTransform(src, dst) {
  const A = []
  const B = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [X, Y] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    B.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    B.push(Y)
  }
  return solve8(A, B)
}

// Warp `src` (an Image or Canvas) so the quad `srcPoints` (TL, TR, BR, BL,
// in source pixel coords) is flattened into an outW x outH rectangle.
export function warpPerspective(src, srcPoints, outW, outH) {
  const sw = src.width, sh = src.height
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = sw
  srcCanvas.height = sh
  const sctx = srcCanvas.getContext('2d')
  sctx.drawImage(src, 0, 0, sw, sh)
  const srcData = sctx.getImageData(0, 0, sw, sh).data

  const dstPoints = [[0, 0], [outW, 0], [outW, outH], [0, outH]]
  const m = getPerspectiveTransform(dstPoints, srcPoints)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH
  const octx = outCanvas.getContext('2d')
  const outImg = octx.createImageData(outW, outH)
  const out = outImg.data

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = m[6] * x + m[7] * y + 1
      const sx = (m[0] * x + m[1] * y + m[2]) / denom
      const sy = (m[3] * x + m[4] * y + m[5]) / denom
      const idx = (y * outW + x) * 4
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        out[idx] = 255; out[idx + 1] = 255; out[idx + 2] = 255; out[idx + 3] = 255
        continue
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy)
      const x1 = x0 + 1, y1 = y0 + 1
      const fx = sx - x0, fy = sy - y0
      for (let c = 0; c < 3; c++) {
        const p00 = srcData[(y0 * sw + x0) * 4 + c]
        const p10 = srcData[(y0 * sw + x1) * 4 + c]
        const p01 = srcData[(y1 * sw + x0) * 4 + c]
        const p11 = srcData[(y1 * sw + x1) * 4 + c]
        const top = p00 * (1 - fx) + p10 * fx
        const bottom = p01 * (1 - fx) + p11 * fx
        out[idx + c] = top * (1 - fy) + bottom * fy
      }
      out[idx + 3] = 255
    }
  }
  octx.putImageData(outImg, 0, 0)
  return outCanvas
}

// Enhancement modes: 'bw' (high-contrast greyscale, good for text),
// 'color' (mild contrast/brightness boost), 'original' (no change).
export function applyEnhancement(canvas, mode) {
  if (mode === 'original') return canvas
  const ctx = canvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    if (mode === 'bw') {
      const gray = clamp((0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.6 + 128 + 25)
      d[i] = d[i + 1] = d[i + 2] = gray
    } else if (mode === 'color') {
      d[i] = clamp((r - 128) * 1.25 + 128 + 8)
      d[i + 1] = clamp((g - 128) * 1.25 + 128 + 8)
      d[i + 2] = clamp((b - 128) * 1.25 + 128 + 8)
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

export function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

// --- Automatic edge detection ---
// Finds the document's 4 corners by looking for the strongest edges in a
// downscaled grayscale copy, then taking the extreme points along the two
// diagonal axes (x+y and x-y). This is a lightweight stand-in for full
// contour detection and works well for a document photographed against a
// reasonably contrasting background.

function grayscaleAt(src, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height))
  const w = Math.max(1, Math.round(src.width * scale))
  const h = Math.max(1, Math.round(src.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(src, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const gray = new Float32Array(w * h)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return { gray, w, h, scale }
}

function sobelMagnitude(gray, w, h) {
  const mag = new Float32Array(w * h)
  let max = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
        + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1]
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1]
      const m = Math.sqrt(gx * gx + gy * gy)
      mag[i] = m
      if (m > max) max = m
    }
  }
  return { mag, max }
}

function otsuThreshold(values, max) {
  if (max <= 0) return 0
  const bins = 256
  const hist = new Array(bins).fill(0)
  for (let i = 0; i < values.length; i++) {
    hist[Math.min(bins - 1, Math.floor((values[i] / max) * (bins - 1)))]++
  }
  const total = values.length
  let sum = 0
  for (let i = 0; i < bins; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, bestVar = -1
  for (let i = 0; i < bins; i++) {
    wB += hist[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) { bestVar = between; best = i }
  }
  return (best / (bins - 1)) * max
}

function polygonArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

// Returns [{x,y} TL, TR, BR, BL] in `src` pixel coordinates, or null if no
// confident document outline was found (caller should fall back to a default crop).
export function detectDocumentCorners(src) {
  const WORK = 400
  const { gray, w, h, scale } = grayscaleAt(src, WORK)
  const { mag, max } = sobelMagnitude(gray, w, h)
  if (max <= 0) return null
  const threshold = Math.max(otsuThreshold(mag, max), max * 0.15)

  const margin = Math.max(2, Math.round(Math.min(w, h) * 0.01))
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity
  let tl = null, tr = null, br = null, bl = null
  let count = 0
  for (let y = margin; y < h - margin; y++) {
    for (let x = margin; x < w - margin; x++) {
      const i = y * w + x
      if (mag[i] < threshold) continue
      count++
      const sum = x + y
      const diff = x - y
      if (sum < minSum) { minSum = sum; tl = [x, y] }
      if (sum > maxSum) { maxSum = sum; br = [x, y] }
      if (diff > maxDiff) { maxDiff = diff; tr = [x, y] }
      if (diff < minDiff) { minDiff = diff; bl = [x, y] }
    }
  }

  if (!tl || !tr || !br || !bl || count < w * h * 0.01) return null

  const pts = [tl, tr, br, bl].map(([x, y]) => [x / scale, y / scale])
  if (polygonArea(pts) < src.width * src.height * 0.08) return null

  return pts.map(([x, y]) => ({
    x: Math.max(0, Math.min(src.width, x)),
    y: Math.max(0, Math.min(src.height, y)),
  }))
}
