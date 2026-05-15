import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

const isNativeShell = () => {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
}

const clearNativeShellCaches = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }
  } catch {
    // Cache cleanup is best-effort; app startup should stay fast and reliable.
  }
}

const startApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

if (isNativeShell()) {
  clearNativeShellCaches().finally(startApp)
} else {
  let updateWebApp = () => window.location.reload()

  updateWebApp = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('syncrova:web-update-ready'))
    }
  })

  window.addEventListener('syncrova:apply-web-update', () => updateWebApp(true))
  startApp()
}
