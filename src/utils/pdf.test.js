import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReportPdf } from './pdf.js'

// 1x1 red PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('jspdf export builds a readable report', () => {
  const doc = buildReportPdf({
    title: 'Incident report',
    dateLabel: '19 Oct 2026',
    advisor: 'Test advisor',
    blocks: [
      { type: 'meta', rows: [{ label: 'Location', value: 'North pit' }] },
      { type: 'section', heading: 'What happened', body: 'A hose parted on the pump skid. The area was barricaded.' },
      { type: 'photos', heading: 'Photos', photos: [PNG] },
    ],
  })
  const bytes = new Uint8Array(doc.output('arraybuffer'))
  const header = String.fromCharCode(...bytes.slice(0, 5))
  assert.equal(header, '%PDF-')
  assert.equal(doc.getNumberOfPages() >= 1, true)
  const blob = doc.output('blob')
  assert.equal(blob.type, 'application/pdf')
  assert.equal(blob.size > 500, true)
})
