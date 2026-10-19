import { useEffect, useState } from 'react'
import CaptureForm from './components/CaptureForm.jsx'
import Home from './components/Home.jsx'
import HseHome from './components/HseHome.jsx'
import Investigate from './components/Investigate.jsx'
import Login from './components/Login.jsx'
import { KpiPreview, MaintenancePreview, ScaffoldPreview, StoresPreview, TrainingPreview } from './components/Mocks.jsx'
import PaperScan from './components/PaperScan.jsx'
import RecordView from './components/RecordView.jsx'
import Register from './components/Register.jsx'
import SceneCheck from './components/SceneCheck.jsx'
import Shell from './components/Shell.jsx'
import SiteSetup from './components/SiteSetup.jsx'
import { FORMS } from './config/forms.js'
import { routeFromHash } from './lib/routes.js'
import { AppState, useApp } from './state.jsx'

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return routeFromHash(hash)
}

function Screen({ route }) {
  const app = useApp()
  useEffect(() => { window.scrollTo(0, 0) }, [route.screen, route.id, route.kind])

  if (!app.ready) return <div className="login"><p className="muted">Opening beta…</p></div>
  if (!app.user) return <Login />

  let body = <Home app={app} />
  if (route.screen === 'setup') body = <SiteSetup app={app} />
  else if (route.screen === 'hse') body = <HseHome app={app} />
  else if (route.screen === 'capture' && FORMS[route.kind]) body = <CaptureForm key={route.kind} app={app} kind={route.kind} />
  else if (route.screen === 'scan') body = <PaperScan app={app} />
  else if (route.screen === 'scene') body = <SceneCheck app={app} />
  else if (route.screen === 'register') body = <Register app={app} />
  else if (route.screen === 'record') body = <RecordView key={route.id} app={app} id={route.id} />
  else if (route.screen === 'investigate') body = <Investigate key={route.id} app={app} id={route.id} />
  else if (route.screen === 'training') body = app.modules.training ? <TrainingPreview /> : <Hidden name="Training" />
  else if (route.screen === 'maintenance') body = app.modules.maintenance ? <MaintenancePreview /> : <Hidden name="Maintenance" />
  else if (route.screen === 'kpis') body = app.modules.kpis ? <KpiPreview /> : <Hidden name="KPIs & Forms" />
  else if (route.screen === 'stores') body = app.modules.stores ? <StoresPreview /> : <Hidden name="Stores" />
  else if (route.screen === 'scaffold') body = app.modules.scaffold ? <ScaffoldPreview /> : <Hidden name="Scaffold Register" />

  return <Shell app={app} route={route}>{body}</Shell>
}

function Hidden({ name }) {
  return (
    <>
      <h1>{name} is hidden</h1>
      <p className="lede">Site setup turned this module off. <a href="#/setup">Turn it back on</a>.</p>
    </>
  )
}

export default function BetaApp() {
  const route = useRoute()
  return (
    <AppState>
      <Screen route={route} />
    </AppState>
  )
}
