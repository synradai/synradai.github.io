import { MODULES } from '../config/modules.js'
import { REPEALED_LAW } from '../config/regulations.js'

export default function Home({ app }) {
  const open = app.rows.filter((row) => row.status === 'open' || row.status === 'investigation').length
  return (
    <>
      <p className="eyebrow">Western Australia · field test</p>
      <h1>Safe Intelligence</h1>
      <p className="lede">HSE capture is live in this beta. The other modules are clickable previews with sample data, marked Preview.</p>
      <div className="grid cards">
        {MODULES.filter((mod) => app.modules[mod.id]).map((mod) => (
          <a className="card" href={mod.href} key={mod.id}>
            <span className={`tag ${mod.id === 'hse' ? 'live' : 'preview'}`}>{mod.id === 'hse' ? 'Working' : 'Preview'}</span>
            <strong>{mod.label}</strong>
            <span>{mod.id === 'hse' ? `${open} open record${open === 1 ? '' : 's'} on this device.` : mod.question}</span>
          </a>
        ))}
        <a className="card" href="#/setup">
          <span className="tag">Site</span>
          <strong>Site setup</strong>
          <span>Answer a few questions to show or hide modules.</span>
        </a>
      </div>
      <p className="hint" style={{ marginTop: '1rem' }}>{REPEALED_LAW.name} is not used. {REPEALED_LAW.note}</p>
    </>
  )
}
