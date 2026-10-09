import { ArrowRight, ArrowsClockwise, CalendarBlank, CalendarCheck, ChartLineUp, CheckSquare, GearSix, House, Package } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { activeHouseDestination, HOUSE_DESTINATIONS } from '../navigation/houseNavigation'
import { Sheet } from './Sheet'

const icons = {
  overview: CalendarCheck,
  timeline: CalendarBlank,
  home: House,
  routines: ArrowsClockwise,
  actions: CheckSquare,
  supplies: Package,
  analysis: ChartLineUp,
  settings: GearSix,
}

/** Shares the existing Sheet's focus trap, Escape, backdrop close and focus return. */
export function HouseMenuSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const activeId = activeHouseDestination(pathname)
  return <Sheet title={t('houseMenu')} onClose={onClose}>
    <nav className="house-menu-list" aria-label={t('houseMenu')}>
      {HOUSE_DESTINATIONS.map(({ id, path, labelKey }) => {
        const Icon = icons[id]
        const isCurrent = id === activeId
        return <Link
          key={id}
          to={path}
          aria-current={isCurrent ? 'page' : undefined}
          onClick={onClose}
          className={`house-menu-link${isCurrent ? ' active' : ''}`}
        >
          <>
            <span className="house-menu-link-icon"><Icon size={23} weight={isCurrent ? 'fill' : 'regular'} aria-hidden="true" /></span>
            <span className="house-menu-link-text">{t(labelKey)}</span>
            {isCurrent ? <span className="house-menu-current">{t('currentSection')}</span> : <ArrowRight className="house-menu-link-arrow" size={18} aria-hidden="true" />}
          </>
        </Link>
      })}
    </nav>
  </Sheet>
}
