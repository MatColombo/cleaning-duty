import { Sheet } from '../Sheet'
import { TaskProducts } from '../TaskProducts'
import { CardArtwork } from '../overview/CardArtwork'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { useI18n } from '../../contexts/I18nContext'
import { activitySubtitle, activityTitle } from '../../lib/presentation'
import { homeTaskWhen } from './homeTaskTime'
import type { Entity, TaskOccurrence, WorkspaceData } from '../../types/domain'

interface RoomModeSheetProps {
  room: Entity
  data: WorkspaceData
  current?: TaskOccurrence
  now: Date
  handled: number
  total: number
  isOverdue: boolean
  onComplete: () => void
  onSkip: () => void
  onLater: () => void
  onClose: () => void
}

/** Presentation only. Completion, skip, deferral and Undo stay in HomePage. */
export function RoomModeSheet({ room, data, current, now, handled, total, isOverdue, onComplete, onSkip, onLater, onClose }: RoomModeSheetProps) {
  const { t, locale } = useI18n()
  return <Sheet title={room.name} onClose={onClose}><div className="stack room-mode v2-room-mode">
    {current ? <>
      <div className="room-mode-progress v2-room-mode-progress"><span>{t('roomCleaning')}</span><strong className="hc-tabular-numerals">{handled + 1} {t('of')} {total}</strong></div>
      <section className="room-mode-card v2-room-mode-card">
        <div className="v2-room-mode-art" aria-hidden="true"><CardArtwork task={current} data={data} /></div>
        <div className="v2-room-mode-copy">
          <span className={`room-mode-state ${isOverdue ? 'overdue' : 'today'}`}>{isOverdue ? t('overdue') : t('dueTodayShort')}</span>
          <h2 className="hc-display">{activityTitle(current)}</h2>
          <p>{activitySubtitle(current)}</p>
          {current.parentOccurrenceId && <span className="v2-home-extra-label">{t('additionalActivity')}</span>}
          {current.parentOccurrenceId && current.supplies.length > 0
            ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={current} data={data} /></div>
            : <TaskProducts task={current} data={data} />}
          <small>{homeTaskWhen(current, locale, data.workspace.timezone, now)}</small>
        </div>
      </section>
      <button type="button" className="button primary room-done-button" onClick={onComplete}>{t('done')}</button>
      <div className="room-mode-secondary-actions">
        <button type="button" className="button secondary" onClick={onSkip}>{t('skip')}</button>
        <button type="button" className="button ghost" onClick={onLater}>{t('later')}</button>
      </div>
    </> : <div className="room-mode-complete v2-room-complete">
      <div className="v2-room-complete-art" aria-hidden="true"><SvgCharacter id="house" decorative expression="joyful" pose="celebrate" misregistration={false} /></div>
      <h2 className="hc-display">{t('roomHandled')}</h2>
      <p className="muted">{t('roomHandledHint')}</p>
      <button type="button" className="button primary" onClick={onClose}>{t('backToLayout')}</button>
    </div>}
  </div></Sheet>
}
