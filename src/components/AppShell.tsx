import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useData } from '../contexts/DataContext'
import { localDateInZone } from '../lib/date'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const nav = [
  { to: '/', key: 'today', glyph: '✓' },
  { to: '/home', key: 'home', glyph: '⌂' },
  { to: '/actions', key: 'actions', glyph: '↻' },
  { to: '/routines', key: 'routines', glyph: '◷' },
  { to: '/supplies', key: 'supplies', glyph: '◫' },
  { to: '/insights', key: 'insights', glyph: '≡' },
  { to: '/settings', key: 'settings', glyph: '⚙' },
] as const

export function AppShell() {
  const { t } = useI18n()
  const { data, currentMember, saving, error, online, pendingSync, syncConflicts, dismissSyncConflicts } = useData()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const onReady = () => setUpdateReady(true)
    window.addEventListener('housecare:update-ready', onReady)
    return () => window.removeEventListener('housecare:update-ready', onReady)
  }, [])

  useEffect(() => {
    if (!data || !currentMember) return
    const nav = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    const today = localDateInZone(data.workspace.timezone)
    const count = data.tasks.filter((task) => task.state === 'scheduled' && task.assigneeMemberId === currentMember.id && localDateInZone(data.workspace.timezone, new Date(task.dueAt)) <= today).length
    if (count && nav.setAppBadge) void nav.setAppBadge(count)
    else if (nav.clearAppBadge) void nav.clearAppBadge()
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
      {error && <div className="error-banner" role="alert">{error}</div>}
      <main className="page"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Primary">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span aria-hidden="true">{item.glyph}</span>
            <small>{t(item.key)}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
