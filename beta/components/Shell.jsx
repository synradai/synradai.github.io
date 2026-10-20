import { MODULES } from '../config/modules.js'
import { go } from '../lib/routes.js'

export default function Shell({ app, route, children }) {
  const { user, signOut, cloudNote, storageWarning, isAdmin } = app
  const enabled = app.navModules || MODULES.filter((mod) => app.modules[mod.id])
  const active = route.screen === 'home' || route.screen === 'setup' || route.screen === 'admin'
    ? route.screen
    : (['capture', 'scan', 'scene', 'register', 'record', 'investigate', 'hse', 'day', 'audit', 'actions', 'injury', 'inspections'].includes(route.screen) ? 'hse' : route.screen)

  const link = (mod) => (
    <a
      key={mod.id}
      href={mod.href}
      className={active === mod.id ? 'active' : ''}
      aria-current={active === mod.id ? 'page' : undefined}
    >
      {mod.label}
    </a>
  )

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="orbit" />
          <span>Safe Intelligence</span>
          <span className="pill">beta 1</span>
        </a>
        <button className="text-btn" onClick={signOut}>Sign out</button>
      </header>
      <nav className="phone-nav" aria-label="Modules">
        <button className={`chip${active === 'home' ? ' active' : ''}`} onClick={() => go('#/')}>Home</button>
        {enabled.map((mod) => (
          <button key={mod.id} className={`chip${active === mod.id ? ' active' : ''}`} onClick={() => go(mod.href)}>
            {mod.label}
          </button>
        ))}
        {isAdmin && <button className={`chip${active === 'admin' ? ' active' : ''}`} onClick={() => go('#/admin')}>Admin</button>}
      </nav>
      <div className="body">
        <aside className="rail">
          <a href="#/" className={active === 'home' ? 'active' : ''}>Home</a>
          <div className="group">Pillars</div>
          {enabled.filter((mod) => mod.group === 'pillar').map(link)}
          <div className="group">Registers</div>
          {enabled.filter((mod) => mod.group === 'register').map(link)}
          <div className="group">Site</div>
          <a href="#/setup" className={active === 'setup' ? 'active' : ''}>Site setup</a>
          {isAdmin && <a href="#/admin" className={active === 'admin' ? 'active' : ''}>Admin</a>}
          <button className="linkish" onClick={signOut}>Sign out</button>
        </aside>
        <main className="page">
          {user?.local && <div className="local-strip">Local preview — records stay on this device until the beta Supabase project is connected.</div>}
          {cloudNote && <div className="note">{cloudNote}</div>}
          {storageWarning && <div className="note">{storageWarning}</div>}
          {children}
        </main>
      </div>
    </div>
  )
}
