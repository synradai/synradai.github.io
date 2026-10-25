import { useState } from 'react'
import { RULESETS } from '../config/regulations.js'
import { Button, Field } from './ui.jsx'

function SiteCard({ app, item, locked, busy, run }) {
  const [name, setName] = useState(item.name || '')
  const [clientName, setClientName] = useState(item.clientName || '')
  const [ruleset, setRuleset] = useState(item.ruleset || 'general')
  const many = (app.site.sites || []).length > 1

  return (
    <div className="panel">
      <Field label="Site name">
        <input value={name} disabled={locked || busy} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Client name" hint="Printed on PDF exports for this site.">
        <input value={clientName} disabled={locked || busy} onChange={(event) => setClientName(event.target.value)} />
      </Field>
      <Field label="Which regulations apply on this site?" hint={RULESETS.find((rule) => rule.id === ruleset)?.note}>
        <select value={ruleset} disabled={locked || busy} onChange={(event) => setRuleset(event.target.value)}>
          {RULESETS.map((rule) => (
            <option key={rule.id} value={rule.id}>{rule.label} — {rule.instrument}</option>
          ))}
        </select>
      </Field>
      <Field label="Logo" hint="PNG, JPEG, or WebP. Under 1 MB. Shown on PDF exports for this site.">
        {item.logoDataUrl ? <img src={item.logoDataUrl} alt="" style={{ width: 72, height: 72, objectFit: 'contain', background: '#fff', borderRadius: 8 }} /> : <p className="muted">No logo yet.</p>}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={locked || busy}
          aria-label={`Logo for ${item.name}`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) run(() => app.uploadLogo(item.id, file))
          }}
        />
      </Field>
      {!locked && (
        <div className="actions">
          <Button
            type="button"
            disabled={busy}
            onClick={() => run(() => app.updateSite(item.id, { name: name.trim(), clientName: clientName.trim(), ruleset }))}
          >
            Save site
          </Button>
          {many && (
            <Button type="button" kind="ghost" disabled={busy} onClick={() => run(() => app.removeSite(item.id))}>
              Remove site
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SiteSetup({ app }) {
  const locked = !app.canManageSites
  const [company, setCompany] = useState(app.site.orgName || '')
  const [draft, setDraft] = useState({ name: '', ruleset: app.site.ruleset || 'general', clientName: '' })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (work) => {
    setNote('')
    setBusy(true)
    try {
      await work()
    } catch (error) {
      setNote(error?.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="eyebrow">Site setup</p>
      <h1>Company and sites</h1>
      <p className="lede">One company account holds every site. Records stay on the site you pick in the header. The client name and logo are printed on that site’s PDFs.</p>
      {locked && <p className="note">An organisation admin changes the company name, sites, and logo. You can still switch site in the header.</p>}
      {note && <p className="note">{note}</p>}
      <div className="panel">
        <Field label="Company name">
          <input value={company} disabled={locked || busy} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        {!locked && <Button type="button" disabled={busy} onClick={() => run(() => app.saveOrgName(company))}>Save company</Button>}
      </div>
      {(app.site.sites || []).map((item) => (
        <SiteCard key={item.id} app={app} item={item} locked={locked} busy={busy} run={run} />
      ))}
      {!locked && (
        <div className="panel">
          <h2>Add a site</h2>
          <Field label="Site name">
            <input value={draft.name} disabled={busy} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Workshop" />
          </Field>
          <Field label="Client name">
            <input value={draft.clientName} disabled={busy} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} />
          </Field>
          <Field label="Regulations">
            <select value={draft.ruleset} disabled={busy} onChange={(event) => setDraft({ ...draft, ruleset: event.target.value })}>
              {RULESETS.map((rule) => (
                <option key={rule.id} value={rule.id}>{rule.label}</option>
              ))}
            </select>
          </Field>
          <Button
            type="button"
            disabled={busy}
            onClick={() => run(async () => {
              await app.addSite(draft)
              setDraft({ name: '', ruleset: draft.ruleset, clientName: '' })
            })}
          >
            Add site
          </Button>
        </div>
      )}
      <div className="panel">
        <h2>Modules on this device</h2>
        <p className="muted">These switches only change the navigation. HSE stays on.</p>
        {(app.moduleConfig || []).filter((mod) => !mod.locked).map((mod) => (
          <label className="check" key={mod.id}>
            <input
              type="checkbox"
              checked={mod.adminEnabled && Boolean(app.modules[mod.id])}
              disabled={!mod.adminEnabled}
              onChange={(event) => app.setModule(mod.id, event.target.checked)}
            />
            <span>
              <strong>{mod.label}</strong>
              <div className="muted">{mod.adminEnabled ? mod.question : 'Off for the organisation. An admin turns it back on.'}</div>
            </span>
          </label>
        ))}
        <p><a href="#/import">Import records into {app.site.siteName || 'this site'}</a></p>
      </div>
    </>
  )
}
