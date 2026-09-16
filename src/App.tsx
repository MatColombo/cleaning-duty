import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BootScreen } from './components/BootScreen'
import { useAuth } from './contexts/AuthContext'
import { useData } from './contexts/DataContext'
import { useI18n } from './contexts/I18nContext'
import { ActionsPage } from './pages/ActionsPage'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { InsightsPage } from './pages/InsightsPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { SettingsPage } from './pages/SettingsPage'
import { SuppliesPage } from './pages/SuppliesPage'
import { SetupPage } from './pages/SetupPage'
import { OverviewPage } from './pages/OverviewPage'
import { applyTheme } from './lib/theme'

export default function App() {
  const { user, loading: authLoading, appearancePalette } = useAuth()
  const { data, workspaces, loading: dataLoading, error } = useData()
  const { t } = useI18n()
  const busy = authLoading || Boolean(user && dataLoading)
  const [bootVisible, setBootVisible] = useState(true)
  const [bootExiting, setBootExiting] = useState(false)
  const bootStartedAt = useRef(Date.now())

  useEffect(() => { applyTheme(appearancePalette) }, [appearancePalette])

  useEffect(() => {
    if (busy) {
      if (!bootVisible || bootExiting) bootStartedAt.current = Date.now()
      setBootVisible(true)
      setBootExiting(false)
      return
    }
    if (!bootVisible) return
    const delay = Math.max(0, 520 - (Date.now() - bootStartedAt.current))
    let hideTimer: number | undefined
    const exitTimer = window.setTimeout(() => {
      setBootExiting(true)
      hideTimer = window.setTimeout(() => setBootVisible(false), 360)
    }, delay)
    return () => {
      window.clearTimeout(exitTimer)
      if (hideTimer !== undefined) window.clearTimeout(hideTimer)
    }
  }, [busy, bootVisible])

  let content = null
  if (!busy) {
    if (!user) content = <AuthPage />
    else {
      const activeHomes = workspaces.filter((workspace) => !workspace.archivedAt)
      if (!data && activeHomes.length > 0) {
        content = <main className="center-page"><section className="card auth-card stack" role={error ? 'alert' : undefined}>
          <div><div className="eyebrow">House Care</div><h1>{error ? 'Home unavailable' : 'Opening your home…'}</h1><p className="muted">{error ?? 'Loading the last home used by this account.'}</p></div>
          {error && <button className="button primary" onClick={() => location.reload()}>Reload</button>}
        </section></main>
      } else if (!data) content = <SetupPage />
      else content = <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="today" element={<Navigate to="/" replace />} />
          <Route path="task/:taskId" element={<OverviewPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="supplies" element={<SuppliesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    }
  }

  return <>
    {content}
    {bootVisible && <BootScreen exiting={bootExiting} />}
    <span className="sr-only" aria-live="polite">{busy ? t('loadingApp') : ''}</span>
  </>
}
