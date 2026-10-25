import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { brandFrom, exportReportPdf } from '../lib/reportPdf.js'
import {
  displayAnswer,
  formUrl,
  resolveQrForms,
  submissionsCsv,
} from '../lib/qrForms.js'
import { supabase } from '../lib/supabase.js'
import { formatWhen } from '../lib/time.js'
import { Button, Field } from './ui.jsx'

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function QrFormList({ app }) {
  const forms = resolveQrForms(app.qrForms)
  const [formId, setFormId] = useState('')
  const [stopped, setStopped] = useState('all')
  const rows = (app.submissions || []).filter((row) => {
    if (formId && row.formId !== formId) return false
    if (stopped === 'yes' && !row.stopped) return false
    if (stopped === 'no' && row.stopped) return false
    return true
  })

  useEffect(() => { app.refreshQr?.() }, [])

  const exportCsv = async () => {
    downloadText('qr-forms.csv', submissionsCsv(rows))
    await app.logExport({
      entity: 'form_submissions',
      entityId: app.site.activeSiteId || '',
      summary: 'Exported QR form submissions',
      detail: { count: rows.length, formId, stopped },
    }).catch(() => {})
  }

  return (
    <>
      <p className="eyebrow">QR forms</p>
      <h1>Submissions</h1>
      <p className="lede">Forms filed from a code on this site. A critical No is marked stop the job.</p>
      <div className="actions no-print">
        <a className="btn" href="#/hse/forms/codes">QR codes</a>
        <Button type="button" kind="ghost" onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="grid cards">
        <Field label="Form">
          <select value={formId} onChange={(event) => setFormId(event.target.value)}>
            <option value="">All forms</option>
            {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
          </select>
        </Field>
        <Field label="Result">
          <select value={stopped} onChange={(event) => setStopped(event.target.value)}>
            <option value="all">All</option>
            <option value="yes">Stop the job</option>
            <option value="no">Filed</option>
          </select>
        </Field>
      </div>
      {rows.length === 0 && <p className="muted">No submissions for this filter.</p>}
      <div className="grid cards">
        {rows.map((row) => (
          <a className="card" key={row.id} href={`#/hse/forms/${row.id}`}>
            <span className="tag live">{row.stopped ? 'Stop the job' : 'Filed'}</span>
            <strong>{row.formTitle}</strong>
            <span>{row.personName}{row.areaLabel ? ` · ${row.areaLabel}` : ''}</span>
            <span className="muted">{formatWhen(row.createdAt)}</span>
          </a>
        ))}
      </div>
    </>
  )
}

export function QrCodeSheet({ app }) {
  const forms = resolveQrForms(app.qrForms)
  const codes = app.qrCodes || []
  const [formId, setFormId] = useState(forms[0]?.id || 'take5')
  const [label, setLabel] = useState('')
  const [images, setImages] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const brand = brandFrom(app.site)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const next = {}
      for (const code of codes) {
        if (!code.active) continue
        next[code.id] = await QRCode.toDataURL(formUrl(code.token), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 280,
          color: { dark: '#07101f', light: '#ffffff' },
        })
      }
      if (!cancel) setImages(next)
    })()
    return () => { cancel = true }
  }, [codes])

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      await app.addQrCode({ targetId: formId, label })
      setLabel('')
    } catch (err) {
      setError(err.message || 'Could not create that code.')
    } finally {
      setBusy(false)
    }
  }

  const pdf = async () => {
    const items = codes.filter((code) => code.active && images[code.id]).map((code) => ({
      image: images[code.id],
      caption: `${forms.find((form) => form.id === code.targetId)?.title || code.targetId}${code.label ? ` — ${code.label}` : ''}`,
    }))
    await exportReportPdf({
      filename: 'qr-sheet.pdf',
      title: 'QR forms',
      dateLabel: app.site.siteName || '',
      clientName: brand.clientName,
      logo: brand.logo,
      blocks: [{ type: 'qr-grid', items }],
    })
    await app.logExport({
      entity: 'qr_codes',
      entityId: app.site.activeSiteId || '',
      summary: 'Exported QR sheet',
      detail: { count: items.length },
    }).catch(() => {})
  }

  return (
    <>
      <p className="eyebrow">QR forms</p>
      <h1>Codes</h1>
      <p className="lede">
        {brand.clientName || app.site.siteName || 'This site'}
        . Print the sheet and put a code on the area or the asset. The same code table can point at a register later.
        {' '}A critical No opens an action for {(app.site.sites || []).find((item) => item.id === app.site.activeSiteId)?.supervisorName || 'the site supervisor'}.
      </p>
      <div className="actions no-print">
        <a className="btn ghost" href="#/hse/forms">Submissions</a>
        <Button type="button" kind="ghost" onClick={() => window.print()}>Print</Button>
        <Button type="button" kind="ghost" onClick={pdf}>PDF</Button>
      </div>
      {app.canManageSites && (
        <div className="panel no-print">
          <Field label="Form">
            <select value={formId} onChange={(event) => setFormId(event.target.value)}>
              {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
            </select>
          </Field>
          <Field label="Area or asset" hint="Printed under the code. Example: Yard gate, or LV-12.">
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          {error && <p className="note">{error}</p>}
          <Button type="button" disabled={busy} onClick={create}>{busy ? 'Saving…' : 'Create code'}</Button>
        </div>
      )}
      {!app.canManageSites && <p className="muted no-print">Organisation admins create codes. You can still print this sheet.</p>}
      <div className="qr-sheet">
        {brand.logo ? <img className="public-logo" src={brand.logo} alt="" /> : null}
        {brand.clientName ? <h2>{brand.clientName}</h2> : null}
        <div className="qr-grid">
          {codes.filter((code) => code.active).map((code) => (
            <article key={code.id}>
              {images[code.id] ? <img src={images[code.id]} alt="" /> : <p className="muted">Preparing code…</p>}
              <strong>{forms.find((form) => form.id === code.targetId)?.title || 'Form'}</strong>
              <span>{code.label || app.site.siteName}</span>
              <a className="no-print" href={formUrl(code.token).replace(/^.*#/, '#')}>Open form</a>
              {app.canManageSites && (
                <button type="button" className="text-btn no-print" onClick={() => app.setQrActive(code.id, false)}>Deactivate</button>
              )}
            </article>
          ))}
        </div>
        {codes.every((code) => !code.active) && <p className="muted">No active codes on this site.</p>}
      </div>
    </>
  )
}

export function QrSubmission({ app, id }) {
  const row = (app.submissions || []).find((item) => item.id === id)
  const [photos, setPhotos] = useState({})

  useEffect(() => {
    if (!row || !supabase) return undefined
    let cancel = false
    ;(async () => {
      const next = {}
      for (const entry of Object.values(row.answers || {})) {
        const path = entry?.value?.path
        if (!path) continue
        const { data } = await supabase.storage.from('form-evidence').download(path)
        if (!data || cancel) continue
        next[entry.id] = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => resolve('')
          reader.readAsDataURL(data)
        })
      }
      if (!cancel) setPhotos(next)
    })()
    return () => { cancel = true }
  }, [row, id])

  if (!row) {
    return (
      <>
        <p className="eyebrow">QR forms</p>
        <h1>Submission not on this site</h1>
        <p className="lede"><a href="#/hse/forms">Back to submissions</a></p>
      </>
    )
  }

  const imageFor = (entry) => {
    if (typeof entry?.value === 'string' && entry.value.startsWith('data:')) return entry.value
    return photos[entry.id] || ''
  }

  const pdf = async () => {
    const brand = brandFrom(app.site)
    const blocks = Object.values(row.answers || {}).map((entry) => {
      if (entry.type === 'photo' || entry.type === 'signature') {
        const image = imageFor(entry)
        return image ? { type: 'photos', heading: entry.label, photos: [image] } : { type: 'section', heading: entry.label, body: 'Attached' }
      }
      return { type: 'section', heading: entry.label, body: displayAnswer(entry) }
    })
    await exportReportPdf({
      filename: 'qr-form.pdf',
      title: row.formTitle || 'QR form',
      dateLabel: formatWhen(row.createdAt),
      advisor: row.personName,
      clientName: brand.clientName,
      logo: brand.logo,
      blocks: [
        {
          type: 'meta',
          rows: [
            { label: 'Person', value: row.personName },
            { label: 'Company', value: row.company },
            { label: 'Role', value: row.role },
            { label: 'Area', value: row.areaLabel },
            { label: 'Result', value: row.stopped ? 'Stop the job' : 'Filed' },
          ],
        },
        ...blocks,
      ],
    })
    await app.logExport({
      entity: 'form_submissions',
      entityId: row.id,
      summary: 'Exported a QR form submission',
    }).catch(() => {})
  }

  return (
    <>
      <p className="eyebrow">QR forms</p>
      <h1>{row.formTitle}</h1>
      <p className="lede">{row.personName} · {formatWhen(row.createdAt)}{row.stopped ? ' · Stop the job' : ''}</p>
      <div className="actions no-print">
        <a className="btn ghost" href="#/hse/forms">All submissions</a>
        <Button type="button" kind="ghost" onClick={pdf}>PDF</Button>
        {row.actionId ? <a className="btn" href={`#/hse/record/${row.actionId}`}>Open the action</a> : null}
      </div>
      <div className="panel">
        {row.company ? <p>Company: {row.company}</p> : null}
        {row.role ? <p>Role: {row.role}</p> : null}
        {row.areaLabel ? <p>Area: {row.areaLabel}</p> : null}
        <p>Version {row.formVersion || 0}</p>
      </div>
      {Object.values(row.answers || {}).map((entry) => (
        <div className="panel" key={entry.id}>
          <h2>{entry.label}</h2>
          {entry.type === 'photo' || entry.type === 'signature' ? (
            imageFor(entry) ? <img className="public-photo" src={imageFor(entry)} alt="" /> : <p className="muted">Attached</p>
          ) : (
            <p>{displayAnswer(entry) || '—'}</p>
          )}
        </div>
      ))}
      {row.stopped && (
        <div className="note">
          Stop the job. {(row.failed || []).map((item) => item.label).join('; ')}
        </div>
      )}
    </>
  )
}
