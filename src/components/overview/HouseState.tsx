import { useRef } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { CriticalCleanlinessSummary, OverviewScope } from '../../lib/overview'
import { useI18n } from '../../contexts/I18nContext'
import { CleanlinessPanel } from './CleanlinessPanel'
import { CriticalEntityCard } from './CriticalEntityCard'
import { OverviewEmptyState } from './OverviewEmptyState'

interface HouseStateProps {
  regular: number | null
  deep: number | null
  criticalItems: CriticalCleanlinessSummary[]
  onOpenEntity: (itemId: string) => void
  scope: OverviewScope
  showScopeSwitch: boolean
  onScopeChange: (scope: OverviewScope) => void
}

export function HouseState({ regular, deep, criticalItems, onOpenEntity, scope, showScopeSwitch, onScopeChange }: HouseStateProps) {
  const { t } = useI18n()
  const rail = useRef<HTMLDivElement>(null)
  const move = (direction: -1 | 1) => rail.current?.scrollBy({
    left: direction * 235,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
  return <section className="v2-house-state" aria-labelledby="v2-house-state-title">
    <div className="v2-house-state-head"><div><span className="v2-print-eyebrow">HOUSE CARE · V2</span><h1 id="v2-house-state-title" className="hc-display">{t('houseState')}</h1></div>{showScopeSwitch ? <div className="v2-scope-picker" role="group" aria-label={t('myTasks')}><button className={scope === 'mine' ? 'selected' : ''} aria-pressed={scope === 'mine'} onClick={() => onScopeChange('mine')}>{t('myTasks')}</button><button className={scope === 'household' ? 'selected' : ''} aria-pressed={scope === 'household'} onClick={() => onScopeChange('household')}>{t('householdTasks')}</button></div> : <span className="v2-state-star" aria-hidden="true">✦</span>}</div>
    <div className="v2-cleanliness-pair"><CleanlinessPanel channel="regular" score={regular} /><CleanlinessPanel channel="deep" score={deep} /></div>
    <div className="v2-critical-heading"><h2>{t('criticalCleanliness')}</h2>{criticalItems.length > 3 && <div className="v2-rail-buttons"><button type="button" aria-label={t('previousCleanliness')} onClick={() => move(-1)}><CaretLeft /></button><button type="button" aria-label={t('nextCleanliness')} onClick={() => move(1)}><CaretRight /></button></div>}</div>
    {criticalItems.length > 0 ? <div className="v2-critical-rail" ref={rail} role="region" tabIndex={0} aria-label={t('criticalCleanliness')}>
      {criticalItems.map((item) => <CriticalEntityCard key={item.itemId} item={item} onOpen={onOpenEntity} />)}
    </div> : <OverviewEmptyState kind="critical" label={t('noCriticalItems')} />}
  </section>
}
