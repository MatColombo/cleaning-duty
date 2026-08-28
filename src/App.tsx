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
  const { data, loading: dataLoading } = useData()
  if (authLoading || (user && dataLoading)) return <div className="boot-screen">House Care</div>
  if (!user) return <AuthPage />
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
