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
import TwoFactorChallenge from './components/TwoFactorChallenge.jsx'
import TwoFactorEnroll from './components/TwoFactorEnroll.jsx'
import Leads from './components/Leads.jsx'
import { MaintenancePreview, ScaffoldPreview, StoresPreview } from './components/Mocks.jsx'
import Training from './components/Training.jsx'
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

const PREVIEW_QR = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 29 29">' +
  '<rect width="29" height="29" fill="#fff"/>' +
  '<g fill="#111">' +
  '<path d="M2 2h7v7H2zm2 2v3h3V4zM20 2h7v7h-7zm2 2v3h3V4zM2 20h7v7H2zm2 2v3h3v-3z"/>' +
  '<path d="M12 2h2v2h-2zm4 0h2v2h-2zM12 6h5v2h-5zM18 6h1v2h-1zM12 10h2v2h-2zm4 0h3v2h-3zm4 0h2v2h-2zm4 0h3v2h-3z"/>' +
  '<path d="M2 12h2v2H2zm4 0h3v2H6zm4 0h2v5h-2zm4 0h2v2h-2zm6 0h3v2h-3zm4 0h2v3h-2z"/>' +
  '<path d="M12 16h7v2h-7zm8 0h3v2h-3zM2 16h2v2H2zm6 2h3v2H8zm12 2h5v2h-5zM12 20h2v3h-2zm4 0h3v2h-3zm4 2h2v3h-2z"/>' +
  '<path d="M12 24h5v3h-5zm6 0h2v2h-2zm4 0h5v3h-5z"/>' +
  '</g></svg>'
)

function Screen({ route }) {
  const app = useApp()
  useEffect(() => { window.scrollTo(0, 0) }, [route.screen, route.id, route.kind])

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const preview = new URLSearchParams(window.location.search).get('mfa')
    if (preview === 'enroll') {
      return (
        <TwoFactorEnroll
          preview={{ factorId: 'preview', secret: 'JBSWY3DPEHPK3PXP', qrCode: PREVIEW_QR }}
          onVerified={() => {}}
          onSignOut={() => {}}
        />
      )
    }
    if (preview === 'challenge') {
      return <TwoFactorChallenge onVerified={() => {}} onSignOut={() => {}} />
    }
  }

  if (!app.ready) return <div className="login"><p className="muted">Opening beta…</p></div>
  if (app.recovery || !app.user) return <Login />
  if (!app.user.local && app.mfaGate !== 'ready') {
    if (app.mfaGate === 'enroll') return <TwoFactorEnroll onVerified={app.refreshMfa} onSignOut={app.signOut} />
    if (app.mfaGate === 'challenge') return <TwoFactorChallenge onVerified={app.refreshMfa} onSignOut={app.signOut} />
    if (app.mfaGate === 'error') {
      return (
        <div className="login">
          <div className="card login-card">
            <h1>Two-factor check failed</h1>
            <p className="lede">Records stay closed until the authenticator check succeeds.</p>
            <button className="btn" type="button" onClick={app.refreshMfa}>Try again</button>
            <button className="btn ghost" type="button" onClick={app.signOut}>Sign out</button>
          </div>
        </div>
      )
    }
    return <div className="login"><p className="muted">Checking two-factor authentication…</p></div>
  }
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
