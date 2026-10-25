import { useEffect, useState } from 'react'
import Actions from './components/Actions.jsx'
import Admin from './components/Admin.jsx'
import Audit from './components/Audit.jsx'
import CaptureForm from './components/CaptureForm.jsx'
import DailyRecord from './components/DailyRecord.jsx'
import Dashboard from './components/Dashboard.jsx'
import Home from './components/Home.jsx'
import HseHome from './components/HseHome.jsx'
import Injury from './components/Injury.jsx'
import Inspections from './components/Inspections.jsx'
import Investigate from './components/Investigate.jsx'
import Login from './components/Login.jsx'
import Leads from './components/Leads.jsx'
import { MaintenancePreview, ScaffoldPreview, StoresPreview } from './components/Mocks.jsx'
import Training from './components/Training.jsx'
import PaperScan from './components/PaperScan.jsx'
import RecordView from './components/RecordView.jsx'
import Register from './components/Register.jsx'
import SceneCheck from './components/SceneCheck.jsx'
import Shell from './components/Shell.jsx'
import Import from './components/Import.jsx'
import PublicForm from './components/PublicForm.jsx'
import { QrCodeSheet, QrFormList, QrSubmission } from './components/QrForms.jsx'
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
  if (route.screen === 'public-form') return <PublicForm token={route.token} />
  if (app.recovery || !app.user) return <Login />
  if (!app.vaultReady) {
    return (
      <div className="login">
        <div className="card login-card">
          <p className="muted">{app.vaultError || 'Opening beta…'}</p>
          {app.vaultError ? <button className="btn ghost" type="button" onClick={app.signOut}>Sign out</button> : null}
        </div>
      </div>
    )
  }

  let body = <Home app={app} />
  if (route.screen === 'setup') body = <SiteSetup app={app} />
  else if (route.screen === 'import') body = <Import app={app} />
  else if (route.screen === 'hse') body = <HseHome app={app} />
  else if (route.screen === 'dashboard') body = <Dashboard app={app} />
  else if (route.screen === 'day') body = <DailyRecord app={app} />
  else if (route.screen === 'audit') body = <Audit app={app} />
  else if (route.screen === 'actions') body = <Actions app={app} />
  else if (route.screen === 'injury') body = <Injury key={route.id || 'list'} app={app} id={route.id} />
  else if (route.screen === 'inspections') body = <Inspections app={app} />
  else if (route.screen === 'capture' && FORMS[route.kind]) body = <CaptureForm key={route.kind} app={app} kind={route.kind} />
  else if (route.screen === 'scan') body = <PaperScan app={app} />
  else if (route.screen === 'scene') body = <SceneCheck app={app} />
  else if (route.screen === 'register') body = <Register app={app} />
  else if (route.screen === 'record') body = <RecordView key={route.id} app={app} id={route.id} />
  else if (route.screen === 'investigate') body = <Investigate key={route.id} app={app} id={route.id} />
  else if (route.screen === 'training') body = app.modules.training ? <Training app={app} /> : <Hidden name="Training" />
  else if (route.screen === 'maintenance') body = app.modules.maintenance ? <MaintenancePreview /> : <Hidden name="Maintenance" />
  else if (route.screen === 'kpis') body = app.modules.kpis ? <Leads app={app} /> : <Hidden name="KPIs & Forms" />
  else if (route.screen === 'stores') body = app.modules.stores ? <StoresPreview /> : <Hidden name="Stores" />
  else if (route.screen === 'scaffold') body = app.modules.scaffold ? <ScaffoldPreview /> : <Hidden name="Scaffold Register" />
  else if (route.screen === 'forms') body = <QrFormList app={app} />
  else if (route.screen === 'form-codes') body = <QrCodeSheet app={app} />
  else if (route.screen === 'form-detail') body = <QrSubmission key={route.id} app={app} id={route.id} />
  else if (route.screen === 'admin') body = <Admin app={app} />

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
