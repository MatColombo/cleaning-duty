import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { localDateInZone } from '../lib/date'
import { isRoutineActive } from '../lib/scheduler'
import { applyTheme } from '../lib/theme'
import { syncPushSubscription } from '../lib/push'
import { AppHeader } from './AppHeader'
import { HouseMenuButton } from './HouseMenuButton'
import { HouseMenuSheet } from './HouseMenuSheet'
import { RuntimeBanners } from './RuntimeBanners'

export function AppShell() {
  const { appearancePalette, isCloud } = useAuth()
  const { data, currentMember } = useData()
  const { pathname, search, hash } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { applyTheme(appearancePalette) }, [appearancePalette])

  useEffect(() => {
    if (!isCloud || !data?.workspace.id || !currentMember?.id) return
    void syncPushSubscription(data.workspace.id, currentMember.id).catch(() => undefined)
  }, [isCloud, data?.workspace.id, currentMember?.id])

  useEffect(() => {
    if (!data || !currentMember) return
    const badgeApi = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    const today = localDateInZone(data.workspace.timezone)
    const activeRoutineIds = new Set(data.routines.filter(isRoutineActive).map((routine) => routine.id))
    const count = data.tasks.filter((task) => task.state === 'scheduled' && activeRoutineIds.has(task.routineId) && (task.assigneeMemberId === currentMember.id || task.assignmentScope === 'everyone') && localDateInZone(data.workspace.timezone, new Date(task.effectiveDueAt ?? task.dueAt)) <= today).length
    if (count && badgeApi.setAppBadge) void badgeApi.setAppBadge(count)
    else if (badgeApi.clearAppBadge) void badgeApi.clearAppBadge()
  }, [data, currentMember])

  // Also handle browser back/forward, redirects and links outside the House Menu.
  useEffect(() => { setMenuOpen(false) }, [pathname, search, hash])

  return <div className={`app-shell house-v2-shell ${pathname === '/' ? 'house-v2-cockpit-shell' : ''}`}>
    <AppHeader />
    <RuntimeBanners />
    <main className="page" id="house-main"><Outlet /></main>
    <HouseMenuButton open={menuOpen} onClick={() => setMenuOpen(true)} />
    {menuOpen && <HouseMenuSheet onClose={() => setMenuOpen(false)} />}
  </div>
}
