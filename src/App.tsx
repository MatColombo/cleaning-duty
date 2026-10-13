import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LegacyRouteRedirect } from './components/LegacyRouteRedirect'
import { BootScreen } from './components/BootScreen'
import { useAuth } from './contexts/AuthContext'
import { useData } from './contexts/DataContext'
import { useI18n } from './contexts/I18nContext'
const ActionsPage = lazy(() => import('./pages/ActionsPage').then(m => ({ default: m.ActionsPage })))
import { AuthPage } from './pages/AuthPage'
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })))
const RoutinesPage = lazy(() => import('./pages/RoutinesPage').then(m => ({ default: m.RoutinesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SuppliesPage = lazy(() => import('./pages/SuppliesPage').then(m => ({ default: m.SuppliesPage })))
import { SetupPage } from './pages/SetupPage'
import { OverviewPage } from './pages/OverviewPage'
const TimelinePage = lazy(() => import('./pages/TimelinePage').then(m => ({ default: m.TimelinePage })))
const TaskRouteResolver = lazy(() => import('./pages/TaskRouteResolver').then(m => ({ default: m.TaskRouteResolver })))
import { applyTheme } from './lib/theme'
import { startupMark } from './lib/startupTelemetry'

export default function App() {
  const { user, loading: authLoading, appearancePalette } = useAuth()
  const { data, workspaces, loading: dataLoading, error } = useData()
  const { t } = useI18n()
  const busy = authLoading || Boolean(user && dataLoading)
  const [bootVisible, setBootVisible] = useState(true)
  const [bootExiting, setBootExiting] = useState(false)

  useEffect(() => { applyTheme(appearancePalette) }, [appearancePalette])

  useEffect(() => {
    if (busy) {
      setBootVisible(true)
      setBootExiting(false)
      return
    }
    if (!bootVisible) return
    // No fixed hold after the first useful state is ready. Keep only a short
    // exit animation, suppressed when motion is reduced.
    const delay = 0
    let hideTimer: number | undefined
    const exitTimer = window.setTimeout(() => {
      setBootExiting(true)
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      hideTimer = window.setTimeout(() => { setBootVisible(false); startupMark('boot-exit') }, reduced ? 0 : 120)
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
      if (!data && (activeHomes.length > 0 || error)) {
        content = <main className="center-page"><section className="card auth-card stack" role={error ? 'alert' : undefined}>
          <div><div className="eyebrow">House Care</div><h1>{error ? 'Home unavailable' : 'Opening your home…'}</h1><p className="muted">{error ?? 'Loading the last home used by this account.'}</p></div>
          {error && <button className="button primary" onClick={() => location.reload()}>Reload</button>}
        </section></main>
      } else if (!data) content = <SetupPage />
      else content = <Suspense fallback={<main className="center-page" role="status" aria-live="polite">{t('loadingApp')}</main>}><Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="today" element={<LegacyRouteRedirect />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="task/:taskId" element={<TaskRouteResolver />} />
          <Route path="home" element={<HomePage />} />
          <Route path="analysis" element={<InsightsPage />} />
          <Route path="insights" element={<LegacyRouteRedirect />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="supplies" element={<SuppliesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes></Suspense>
    }
  }

  return <>
    {content}
    {bootVisible && <BootScreen exiting={bootExiting} />}
    <span className="sr-only" aria-live="polite">{busy ? t('loadingApp') : ''}</span>
  </>
}
