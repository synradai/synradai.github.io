// Generates PWA icons (hazard triangle on dark background) as raw PNGs.
// Pure Node + zlib, no image library needed.
import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by)
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = sign(px, py, ax, ay, bx, by)
  const d2 = sign(px, py, bx, by, cx, cy)
  const d3 = sign(px, py, cx, cy, ax, ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function generateIcon(size) {
  const bg = hexToRgb('#0f1320')
  const fg = hexToRgb('#fcd34d')
  const dark = hexToRgb('#0f1320')

  const margin = size * 0.15
  const ax = size / 2, ay = margin
  const bx = margin, by = size - margin
  const cx = size - margin, cy = size - margin

  const barW = size * 0.07
  const barX1 = size / 2 - barW / 2, barX2 = size / 2 + barW / 2
  const barY1 = size * 0.42, barY2 = size * 0.63
  const dotY1 = size * 0.69, dotY2 = size * 0.77

  const raw = Buffer.alloc((size * 3 + 1) * size)
  let pos = 0
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0
    for (let x = 0; x < size; x++) {
      let color = bg
      const px = x + 0.5, py = y + 0.5
      if (pointInTriangle(px, py, ax, ay, bx, by, cx, cy)) {
        color = fg
        if (px >= barX1 && px <= barX2 && ((py >= barY1 && py <= barY2) || (py >= dotY1 && py <= dotY2))) {
          color = dark
        }
      }
      raw[pos++] = color[0]
      raw[pos++] = color[1]
      raw[pos++] = color[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public', { recursive: true })
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 }
for (const [name, size] of Object.entries(sizes)) {
  writeFileSync(`public/${name}`, generateIcon(size))
  console.log(`wrote public/${name} (${size}x${size})`)
}
