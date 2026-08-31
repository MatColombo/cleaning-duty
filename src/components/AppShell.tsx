import { useEffect, useState } from 'react'
import { ArrowsClockwise, CalendarCheck, ChartLineUp, GearSix, House } from '@phosphor-icons/react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { localDateInZone } from '../lib/date'
import { isRoutineActive } from '../lib/scheduler'
import { applyTheme } from '../lib/theme'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const nav = [
  { to: '/', key: 'overview', icon: CalendarCheck },
  { to: '/home', key: 'home', icon: House },
  { to: '/routines', key: 'routines', icon: ArrowsClockwise },
  { to: '/insights', key: 'insights', icon: ChartLineUp },
  { to: '/settings', key: 'settings', icon: GearSix },
] as const

export function AppShell() {
  const { t } = useI18n()
  const { appearancePalette } = useAuth()
  const { data, currentMember, saving, error, clearError, online, pendingSync, syncConflicts, dismissSyncConflicts } = useData()
  const navigate = useNavigate()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => { applyTheme(appearancePalette) }, [appearancePalette])

  useEffect(() => {
    const onReady = () => setUpdateReady(true)
    window.addEventListener('housecare:update-ready', onReady)
    return () => window.removeEventListener('housecare:update-ready', onReady)
  }, [])

  useEffect(() => {
    if (!data || !currentMember) return
    const badgeApi = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    const today = localDateInZone(data.workspace.timezone)
    const activeRoutineIds = new Set(data.routines.filter(isRoutineActive).map((routine) => routine.id))
    const count = data.tasks.filter((task) => task.state === 'scheduled' && activeRoutineIds.has(task.routineId) && task.assigneeMemberId === currentMember.id && localDateInZone(data.workspace.timezone, new Date(task.effectiveDueAt ?? task.dueAt)) <= today).length
    if (count && badgeApi.setAppBadge) void badgeApi.setAppBadge(count)
    else if (badgeApi.clearAppBadge) void badgeApi.clearAppBadge()
  }, [data, currentMember])

  function applyUpdate() {
    navigator.serviceWorker?.getRegistration().then((registration) => {
      if (!registration?.waiting) return location.reload()
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <WorkspaceSwitcher />
          {saving && <span className="sync-state">{t('saving')}</span>}
          {!saving && pendingSync > 0 && <span className="sync-state">{pendingSync} {t('waitingToSync')}</span>}
        </div>
      </header>
      {!online && <div className="runtime-banner offline-banner">{t('offlineMode')}</div>}
      {syncConflicts.length > 0 && <div className="runtime-banner conflict-banner"><span>{t('syncConflict')} · {syncConflicts.length}</span><button onClick={dismissSyncConflicts}>{t('dismiss')}</button></div>}
      {updateReady && <div className="runtime-banner update-banner"><span>{t('updateReady')}</span><button onClick={applyUpdate}>{t('updateNow')}</button></div>}
      {error && <div className="error-banner app-error-banner" role="alert"><span>{error}</span><div className="runtime-actions"><button onClick={() => navigate('/settings?errors=1')}>{t('details')}</button><button onClick={clearError}>{t('dismiss')}</button></div></div>}
      <main className="page"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Primary">
        {nav.map((item) => {
          const Icon = item.icon
          return <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            {({ isActive }) => <><Icon aria-hidden="true" size={22} weight={isActive ? 'fill' : 'regular'} /><small>{t(item.key)}</small></>}
          </NavLink>
        })}
      </nav>
    </div>
  )
}
