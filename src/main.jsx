import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service worker is disabled while iterating fast (it was serving stale cached
// builds → blank screens). Actively remove any SW already on the device and
// clear its caches so updates always load cleanly.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
  if (typeof caches !== 'undefined') caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {})
}
