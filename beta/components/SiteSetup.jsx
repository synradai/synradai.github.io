import { MODULES } from '../config/modules.js'
import { RULESETS } from '../config/regulations.js'
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
        <Field label="Which regulations apply on this site?" hint={RULESETS.find((item) => item.id === (app.site.ruleset || 'general'))?.note}>
          <select
            value={app.site.ruleset || 'general'}
            onChange={(event) => app.setSite({ ruleset: event.target.value, mine: event.target.value === 'mines', setupDone: true })}
          >
            {RULESETS.map((item) => (
              <option key={item.id} value={item.id}>{item.label} — {item.instrument}</option>
            ))}
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
