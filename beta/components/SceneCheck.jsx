import { useState } from 'react'
import { compressPhoto } from '../../src/utils/storage.js'
import { checkScene } from '../lib/ai.js'
import { matchFlags, withSeverityFlag } from '../lib/flags.js'
import { buildSceneRecord } from '../lib/record.js'
import { perthDateTimeLocal } from '../lib/time.js'
import { go } from '../lib/routes.js'
import { Button, Field, FlagList, OfflineBanner } from './ui.jsx'

export default function SceneCheck({ app }) {
  const [photos, setPhotos] = useState([])
  const [note, setNote] = useState('')
  const [siteArea, setSiteArea] = useState(app.site.siteName || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const add = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (photos.length >= 4) { setError('Four photos is the limit.'); return }
    const compressed = await compressPhoto(file)
    setPhotos((prev) => [...prev, compressed])
  }

  const run = async () => {
    if (!photos.length) { setError('Add at least one site photo.'); return }
    setBusy(true)
    setError('')
    try {
      const checked = await checkScene(photos, note)
      setResult(checked)
    } catch (err) {
      setError(err.message || 'Could not check the scene.')
    } finally {
      setBusy(false)
    }
  }

  const breaches = result ? [
    ...matchFlags(`${note}\n${JSON.stringify(result.result)}`),
    ...(result.result.possibleBreaches || []).map((item, index) => ({
      id: `scene-${index}`,
      notice: 'Possible breach — verify',
      instrument: item.instrument || 'Check the current WA instrument',
      pinpoint: item.pinpoint || 'Verify the pinpoint',
      label: item.area || '',
      why: item.why || '',
    })),
  ] : []

  const file = () => {
    const record = buildSceneRecord({
      fields: { occurredAt: perthDateTimeLocal(), siteArea, note, reporter: 'HSE adviser' },
      result: { ...result.result, offline: result.offline },
      flags: withSeverityFlag(breaches, 0),
    })
    record.scenePhotos = photos
    app.addRecord(record)
    go(`#/hse/record/${record.id}`)
  }

  const raise = () => {
    const hazards = (result?.result?.missedHazards || []).join('. ')
    sessionStorage.setItem('si-beta-prefill', JSON.stringify({
      kind: 'hazard',
      description: hazards,
      siteArea,
      immediateActions: note,
    }))
    go('#/hse/capture/hazard')
  }

  return (
    <>
      <p className="eyebrow">HSE · scene check</p>
      <h1>Scene photo check</h1>
      <p className="lede">Upload site photos. Grok flags missed hazards, missing detail, and possible breach areas. Every legal line is “possible breach — verify”.</p>
      <div className="panel">
        <Field label="Site / area">
          <input value={siteArea} onChange={(event) => setSiteArea(event.target.value)} placeholder="e.g. workshop bay 2" />
        </Field>
        <Field label="Note for the model" hint="Optional. Roles, not names.">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What were they doing in the photo?" />
        </Field>
        <div className="actions">
          <label className="btn ghost">Camera<input type="file" accept="image/*" capture="environment" hidden onChange={add} /></label>
          <label className="btn ghost">Upload<input type="file" accept="image/*" hidden onChange={add} /></label>
        </div>
        <div className="photos" style={{ marginTop: 8 }}>
          {photos.map((photo, index) => <img key={index} src={photo} alt="" />)}
        </div>
        {error && <p className="note">{error}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <Button type="button" disabled={busy} onClick={run}>{busy ? 'Checking…' : 'Check scene'}</Button>
        </div>
      </div>

      {result && (
        <div className="panel" style={{ marginTop: 12 }}>
          <OfflineBanner show={result.offline} />
          <h2>Missed hazards</h2>
          <ul>{(result.result.missedHazards || []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h2>Missed detail</h2>
          <ul>{(result.result.missedDetails || []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h2>Possible breach — verify</h2>
          <FlagList flags={breaches} />
          <div className="actions">
            <Button type="button" onClick={file}>Save to register</Button>
            <Button type="button" kind="ghost" onClick={raise}>Raise as hazard</Button>
          </div>
        </div>
      )}
    </>
  )
}
