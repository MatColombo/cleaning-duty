import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { I18nProvider } from './contexts/I18nContext'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { registerInstallPromptCapture } from './lib/pwa'
import './styles.css'

registerInstallPromptCapture()

const enableServiceWorker = import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW_DEV === 'true'
if ('serviceWorker' in navigator && enableServiceWorker) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then((registration) => {
    window.dispatchEvent(new Event('housecare:sw-ready'))
    if (registration.waiting) window.dispatchEvent(new Event('housecare:update-ready'))
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new Event('housecare:update-ready'))
        }
      })
    })
  }).catch(console.error))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <I18nProvider>
          <AuthProvider>
            <DataProvider><App /></DataProvider>
          </AuthProvider>
        </I18nProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
