import { REPEALED_LAW } from '../config/regulations.js'

export default function Home({ app }) {
  const open = app.rows.filter((row) => row.status === 'open' || row.status === 'investigation').length
  const modules = app.navModules || []
  return (
    <>
      <p className="eyebrow">Western Australia · field test</p>
      <h1>{app.wording?.homeTitle || 'Safe Intelligence'}</h1>
      <p className="lede">{app.wording?.homeLede}</p>
      <div className="grid cards">
        {modules.map((mod) => (
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
