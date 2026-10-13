import { CheckCircle, DotsThree } from '@phosphor-icons/react'
import type { TaskOccurrence, WorkspaceData } from '../../types/domain'
import type { CareCardContext, DeckPriority } from '../../lib/overviewDeck'
import { activitySubtitle, activityTitle } from '../../lib/presentation'
import { useI18n } from '../../contexts/I18nContext'
import { CardArtwork } from './CardArtwork'
import { CareCardMeta } from './CareCardMeta'
import { LinkedActivityAppendix } from './LinkedActivityAppendix'
import { CareCardSupplies } from './CareCardSupplies'

export function CareCard({ task, data, context, priority, now, pending, onComplete, onMore }: {
  task: TaskOccurrence; data: WorkspaceData; context: CareCardContext; priority: DeckPriority; now: Date
  pending: boolean; onComplete: (id: string) => void
  onMore: (id: string) => void
}) {
  const { t } = useI18n()
  return <article className={`v2-care-card v2-care-card-${priority}`} aria-label={activityTitle(task)} data-task-id={task.id}>
    <div className="v2-care-scroll-content" role="region" tabIndex={0} aria-label={t('cardDetails')}>
    <div className="v2-care-main">
      <div className="v2-care-heading"><span className={`v2-care-level ${task.cleanlinessChannel}`}>{task.cleanlinessChannel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span><h3 className="hc-card-title">{activityTitle(task)}</h3><p>{activitySubtitle(task)}</p></div>
      <CardArtwork task={task} data={data} animated />
    </div>
    <CareCardMeta task={task} context={context} priority={priority} now={now} timezone={data.workspace.timezone} />
    <CareCardSupplies supplies={context.supplies} />
    <LinkedActivityAppendix children={context.linkedChildren} />
    {task.parentOccurrenceId && <p className="v2-linked-parent">✦ {t('additionalActivity')}</p>}
    </div>
    <div className="v2-care-actions">
      <button type="button" className="v2-care-complete" disabled={pending} onClick={() => onComplete(task.id)}><CheckCircle weight="fill" aria-hidden="true" />{t('completeCard')}</button>
      <button type="button" className="v2-care-more" aria-label={t('more')} disabled={pending} onClick={() => onMore(task.id)}><DotsThree aria-hidden="true" weight="bold" /></button>
    </div>
  </article>
}
