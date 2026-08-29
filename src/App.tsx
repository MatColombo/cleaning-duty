import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useAuth } from './contexts/AuthContext'
import { useData } from './contexts/DataContext'
import { ActionsPage } from './pages/ActionsPage'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { InsightsPage } from './pages/InsightsPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { SettingsPage } from './pages/SettingsPage'
import { SuppliesPage } from './pages/SuppliesPage'
import { SetupPage } from './pages/SetupPage'
import { TodayPage } from './pages/TodayPage'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { data, workspaces, loading: dataLoading, error } = useData()
  if (authLoading || (user && dataLoading)) return <div className="boot-screen">House Care</div>
  if (!user) return <AuthPage />
  const activeHomes = workspaces.filter((workspace) => !workspace.archivedAt)
  if (!data && activeHomes.length > 0) {
    return <main className="center-page"><section className="card auth-card stack" role={error ? 'alert' : undefined}>
      <div><div className="eyebrow">House Care</div><h1>{error ? 'Home unavailable' : 'Opening your home…'}</h1><p className="muted">{error ?? 'Loading the last home used by this account.'}</p></div>
      {error && <button className="button primary" onClick={() => location.reload()}>Reload</button>}
    </section></main>
  }
  if (!data) return <SetupPage />
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<TodayPage />} />
      <Route path="task/:taskId" element={<TodayPage />} />
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
