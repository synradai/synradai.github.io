import { MODULES } from '../config/modules.js'
import { Button, Field } from './ui.jsx'

export default function SiteSetup({ app }) {
  return (
    <>
      <p className="eyebrow">Site setup</p>
      <h1>What does this site run?</h1>
      <p className="lede">Answers only change the navigation. HSE stays on. Nothing here is sent anywhere until you save an HSE record.</p>
      <div className="panel">
        <Field label="Site name" hint="Used as the starting site / area on new HSE records. Not a company name.">
          <input value={app.site.siteName || ''} onChange={(event) => app.setSite({ siteName: event.target.value, setupDone: true })} placeholder="e.g. Red Range workshop" />
        </Field>
        <Field label="Is this a mine site?">
          <select value={app.site.mine ? 'yes' : 'no'} onChange={(event) => app.setSite({ mine: event.target.value === 'yes', setupDone: true })}>
            <option value="yes">Yes — WHS (Mines) Regulations 2022 apply</option>
            <option value="no">No — general WHS duties only</option>
          </select>
        </Field>
        {MODULES.filter((mod) => !mod.locked).map((mod) => (
          <label className="check" key={mod.id}>
            <input
              type="checkbox"
              checked={Boolean(app.modules[mod.id])}
              onChange={(event) => app.setModule(mod.id, event.target.checked)}
            />
            <span>
              <strong>{mod.label}</strong>
              <div className="muted">{mod.question}</div>
            </span>
          </label>
        ))}
        <Button type="button" onClick={() => { window.location.hash = '#/' }}>Done</Button>
      </div>
    </>
  )
}
