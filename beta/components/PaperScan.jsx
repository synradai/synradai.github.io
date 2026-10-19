import { useState } from 'react'
import DocScanner from '../../src/components/DocScanner.jsx'
import { FORM_KINDS } from '../config/forms.js'
import { resolveForm } from '../lib/config.js'
import { compressPhoto } from '../../src/utils/storage.js'
import { extractForm } from '../lib/ai.js'
import CaptureForm from './CaptureForm.jsx'
import { Button } from './ui.jsx'

export default function PaperScan({ app }) {
  const [kind, setKind] = useState('incident')
  const [photo, setPhoto] = useState('')
  const [scanner, setScanner] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)

  const take = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhoto(await compressPhoto(file))
    setDraft(null)
    setError('')
  }

  const read = async () => {
    if (!photo) { setError('Add a photo of the paper form first.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await extractForm(kind, photo, resolveForm(kind, app.formsConfig))
      setDraft({ ...result.fields, photos: [photo], offline: result.offline })
    } catch (err) {
      setError(err.message || 'Could not read the form.')
    } finally {
      setBusy(false)
    }
  }

  if (scanner) {
    return <DocScanner onClose={() => setScanner(false)} onSave={(url) => { setPhoto(url); setScanner(false); setDraft(null) }} />
  }

  if (draft) {
    const { offline, ...fields } = draft
    return (
      <CaptureForm
        app={app}
        kind={kind}
        source="scan"
        initial={{ ...fields, offline }}
        banner={offline ? null : <p className="offline-banner">Grok read the photo. Check every field before you file it.</p>}
      />
    )
  }

  return (
    <>
      <p className="eyebrow">HSE · paper form</p>
      <h1>Scan a paper form</h1>
      <p className="lede">Take or straighten a photo. Grok vision fills the matching form. You review it before anything is filed.</p>
      <div className="panel">
        <div className="field">
          <span className="field-label">Which form is this?</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {FORM_KINDS.map((item) => <option key={item.id} value={item.id}>{resolveForm(item.id, app.formsConfig)?.label || item.label}</option>)}
          </select>
        </div>
        <div className="actions">
          <label className="btn ghost">Camera<input type="file" accept="image/*" capture="environment" hidden onChange={take} /></label>
          <label className="btn ghost">Upload<input type="file" accept="image/*" hidden onChange={take} /></label>
          <Button type="button" kind="ghost" onClick={() => setScanner(true)}>Straighten and crop</Button>
        </div>
        {photo && <img src={photo} alt="Paper form" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12, marginTop: 12 }} />}
        {error && <p className="note">{error}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <Button type="button" disabled={busy} onClick={read}>{busy ? 'Reading…' : 'Read with Grok'}</Button>
          {photo && <Button type="button" kind="ghost" onClick={() => setDraft({ photos: [photo] })}>Type it myself</Button>}
        </div>
      </div>
    </>
  )
}
