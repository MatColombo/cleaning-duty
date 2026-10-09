import { useEffect, useState, type KeyboardEvent } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { WorkspaceData } from '../../types/domain'
import type { ActiveDeckEntry } from '../../lib/overviewDeck'
import { nextDeckIndex, careCardContext } from '../../lib/overviewDeck'
import { useI18n } from '../../contexts/I18nContext'
import { CareCard } from './CareCard'
import { OverviewEmptyState } from './OverviewEmptyState'

export function ActiveDeck({ entries, data, now, pendingTaskId, completionStamp, emptyLabel, onComplete, onReschedule, onMore }: {
  entries: ActiveDeckEntry[]; data: WorkspaceData; now: Date; pendingTaskId: string | null; completionStamp: string | null; emptyLabel: string
  onComplete: (id: string) => void; onReschedule: (id: string) => void; onMore: (id: string) => void
}) {
  const { t } = useI18n()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const currentIndex = Math.max(0, entries.findIndex((entry) => entry.task.id === focusedId))
  const current = entries[currentIndex]
  const choose = (direction: -1 | 1) => setFocusedId(entries[nextDeckIndex(entries.length, currentIndex, direction)]?.task.id ?? null)
  // Reset after a household switch; an ID from another home should never remain focused.
  useEffect(() => setFocusedId(null), [data.workspace.id])
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || entries.length < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); choose(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); choose(1) }
  }
  return <section className="v2-active-deck" aria-labelledby="v2-deck-title">
    <div className="v2-deck-heading"><div><span className="v2-print-eyebrow">{t('today')}</span><h2 id="v2-deck-title" className="hc-display">{t('activeDeck')}</h2></div><span className="v2-deck-count">{entries.length} {t('deckTasks')}</span></div>
    {current ? <div className="v2-deck-stage" tabIndex={0} onKeyDown={keyDown} role="region" aria-roledescription="card deck" aria-label={t('activeDeck')}>
      {entries.length > 1 && <div className="v2-deck-back v2-deck-back-first" aria-hidden="true" />}
      {entries.length > 2 && <div className="v2-deck-back v2-deck-back-second" aria-hidden="true" />}
      <CareCard key={current.task.id} task={current.task} data={data} priority={current.priority} now={now}
        context={careCardContext(data, current.task, now)} pending={pendingTaskId === current.task.id}
        onComplete={onComplete} onReschedule={onReschedule} onMore={onMore} onChildOpen={(id) => {
          if (entries.some(({task}) => task.id === id)) setFocusedId(id)
          else onMore(id)
        }} />
      {entries.length > 1 && <div className="v2-deck-controls"><button type="button" aria-label={t('previousCard')} onClick={() => choose(-1)}><CaretLeft /></button><span aria-live="polite" className="hc-tabular-numerals">{currentIndex+1} / {entries.length}</span><button type="button" aria-label={t('nextCard')} onClick={() => choose(1)}><CaretRight /></button></div>}
    </div> : <OverviewEmptyState label={emptyLabel} />}
    {completionStamp && <div className="v2-completion-stamp" role="status"><span aria-hidden="true">✦</span> {t('careCardCollected')}: {completionStamp}</div>}
  </section>
}
