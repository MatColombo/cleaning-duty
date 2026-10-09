import { ProductStockList, TaskProducts } from '../TaskProducts'
import { useI18n } from '../../contexts/I18nContext'
import { activitySubtitle, activityTitle, additionalActivityAppendix, groupLinkedTaskOccurrences } from '../../lib/presentation'
import type { CareDimensionEstimate, CareEstimate } from '../../lib/home'
import type { RoomWorkflow } from '../../lib/room'
import type { Entity, EntityType, TaskOccurrence, WorkspaceData } from '../../types/domain'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { homeEntityArtId, homeMoodExpression, homeRoomStatusLabel } from './homeArtwork'
import { homeTaskWhen } from './homeTaskTime'

type StockAlert = WorkspaceData['supplies'][number]

export interface HomeInspectorProps {
  data: WorkspaceData
  selectedEntity?: Entity
  selectedType?: EntityType
  selectedCare: CareEstimate | null
  selectedTasks: TaskOccurrence[]
  selectedSupplies: StockAlert[]
  isRoom: boolean
  roomWorkflow: RoomWorkflow | null
  now: Date
  onClose: () => void
  onStartRoom: (id: string) => void
}

function careLabel(status: string, t: ReturnType<typeof useI18n>['t']) {
  if (status === 'fresh') return t('fresh')
  if (status === 'good') return t('good')
  if (status === 'due_soon') return t('dueSoon')
  if (status === 'needs_attention') return t('needsAttention')
  if (status === 'overdue') return t('overdue')
  return t('notTracked')
}

function stockLabel(status: StockAlert['status'], t: ReturnType<typeof useI18n>['t']) {
  if (status === 'available') return t('available')
  if (status === 'low') return t('low')
  if (status === 'reserve_only') return t('reserveOnly')
  return t('outOfStock')
}

/** HTML text/meter state remains readable without the decorative SVG. */
function HomeCareDetails({ care }: { care: CareEstimate }) {
  const { t } = useI18n()
  const channels: { id: 'regular' | 'deep'; label: string; data?: CareDimensionEstimate }[] = [
    { id: 'regular', label: t('regularCleanliness'), data: care.routine },
    { id: 'deep', label: t('deepCleanliness'), data: care.deep },
  ]
  return <div className="dual-care-summary v2-home-care-details" aria-label={t('homeCleanliness')}>
    {channels.map(({ id, label, data }) => {
      const score = data?.score ?? null
      const rounded = score == null ? null : Math.round(Math.max(0, Math.min(100, score)))
      const valueText = rounded == null ? t('notTracked') : `${rounded}%`
      return <div key={id} className={`care-health-detail ${id === 'regular' ? 'routine' : 'deep'} v2-home-care-channel`}>
        <div className="care-health-heading"><span>{label}</span><strong>{data ? careLabel(data.status, t) : t('notTracked')}</strong></div>
        <div className="care-health-track-ui" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rounded ?? undefined} aria-valuetext={valueText}>
          <span style={{ width: `${rounded ?? 0}%` }} />
        </div>
        <b className="hc-tabular-numerals">{rounded == null ? '—' : `${rounded}%`}</b>
      </div>
    })}
  </div>
}

/** Existing grouping and configured additional-work appendix; presentation only. */
function HomeTaskRows({ tasks, data, now, upcoming = false, compact = false, limit }: { tasks: TaskOccurrence[]; data: WorkspaceData; now: Date; upcoming?: boolean; compact?: boolean; limit?: number }) {
  const { t, locale } = useI18n()
  if (!tasks.length) return <p className="muted compact-text">{t('nothingScheduled')}</p>
  const groups = groupLinkedTaskOccurrences(tasks)
  return <div className={compact ? 'mini-list v2-home-task-list' : 'room-task-list v2-home-task-list'}>
    {(limit == null ? groups : groups.slice(0, limit)).map(({ task }) => {
      const appendix = additionalActivityAppendix(data, task)
      const due = homeTaskWhen(task, locale, data.workspace.timezone, now, upcoming)
      return <div className={compact ? 'mini-list-group' : 'room-task-row-group'} key={task.id}>
        <div className={compact ? 'mini-list-row' : 'room-task-row'}>
          <div className="v2-home-task-copy">
            <strong>{activityTitle(task)}</strong><small>{activitySubtitle(task)}</small>
            {task.parentOccurrenceId && <small className="linked-task-label">{t('additionalActivity')}</small>}
            {task.parentOccurrenceId && task.supplies.length > 0
              ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data} /></div>
              : <TaskProducts task={task} data={data} />}
          </div>
          <small>{due}</small>
        </div>
        {appendix.length > 0 && <section className={`home-linked-activities configured-appendix ${compact ? 'compact' : ''}`} aria-label={t('additionalActivities')}>
          <div className="linked-section-heading"><strong>{t('additionalActivities')}</strong><span>{appendix.length}</span></div>
          {appendix.map((entry) => <div className="home-linked-activity configured" key={entry.routine.id}>
            <div><strong>{entry.routine.name}</strong>
              <small>{[entry.targetNames.join(', '), entry.actionName].filter(Boolean).join(' - ')}</small>
              <small>{entry.occurrence ? homeTaskWhen(entry.occurrence, locale, data.workspace.timezone, now, upcoming) : t('everyParentTriggers').replace('N', String(entry.routine.triggerEvery ?? 1))}</small>
              <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><ProductStockList supplies={entry.supplies} data={data} /></div>
            </div>
            {entry.occurrence && !compact && <small>{entry.occurrence.state === 'completed' ? t('completed') : entry.occurrence.state === 'skipped' ? t('skipped') : t('toDo')}</small>}
          </div>)}
        </section>}
      </div>
    })}
  </div>
}

function HomeStockAlerts({ supplies }: { supplies: StockAlert[] }) {
  const { t } = useI18n()
  return <section className="inspector-section v2-home-stock-section">
    <div className="section-header"><h3>{t('supplyAlerts')}</h3><span className="count-pill small-pill">{supplies.length}</span></div>
    {supplies.length === 0 ? <p className="muted compact-text">{t('noSupplyAlerts')}</p> : <div className="mini-list">
      {supplies.map((supply) => <div className="mini-list-row v2-home-stock-row" key={supply.id}>
        <strong>{supply.name}</strong><span className={`stock-badge stock-${supply.status}`}>{stockLabel(supply.status, t)}</span>
      </div>)}
    </div>}
  </section>
}

function HomeInspectorHeading({ entity, typeName, care, isRoom, status, onClose }: {
  entity: Entity; typeName?: string; care: CareEstimate; isRoom: boolean
  status: RoomWorkflow['status'] | null; onClose: () => void
}) {
  const { t } = useI18n()
  const statusText = status ? homeRoomStatusLabel(status, t('dueTodayShort'), t('overdue')) : null
  const artId = homeEntityArtId(entity, typeName ? { name: typeName } : undefined, isRoom)
  return <header className="v2-home-inspector-heading">
    <div className="v2-home-inspector-art" aria-hidden="true">
      <SvgCharacter id={artId} decorative expression={homeMoodExpression(care.score)} pose="thumbs-up" misregistration={false} />
    </div>
    <div className="v2-home-inspector-heading-copy">
      <span className="v2-print-eyebrow">{isRoom ? t('roomDetails') : typeName || t('item')}</span>
      <h2 className="hc-display">{entity.name}</h2>
      {statusText && <span className={`v2-home-status-stamp ${status === 'both' || status === 'overdue' ? 'overdue' : 'due'}`}>
        {statusText}
      </span>}
    </div>
    <button type="button" className="button ghost small room-detail-close" onClick={onClose}>{t('close')}</button>
  </header>
}

/** Stateless inspector. HomePage owns all data selection, clock and actual mutations. */
export function HomeInspector({ data, selectedEntity, selectedType, selectedCare, selectedTasks, selectedSupplies, isRoom, roomWorkflow, now, onClose, onStartRoom }: HomeInspectorProps) {
  const { t } = useI18n()
  if (!selectedEntity || !selectedCare) return <div className="inspector-empty v2-home-inspector-empty">
    <div className="v2-home-empty-art" aria-hidden="true"><SvgCharacter id="house" decorative expression="smile" pose="wave" misregistration={false} /></div>
    <p>{t('tapLayout')}</p>
  </div>

  return <div className={`stack inspector-content v2-home-inspector-content ${isRoom && roomWorkflow ? 'room-detail-panel' : ''}`}>
    <HomeInspectorHeading entity={selectedEntity} typeName={selectedType?.name} care={selectedCare} isRoom={isRoom} status={roomWorkflow?.status ?? null} onClose={onClose} />
    <HomeCareDetails care={selectedCare} />
    {isRoom && roomWorkflow ? <>
      <section className="inspector-section room-work-section overdue-room-work">
        <div className="section-header"><h3>{t('overdue')}</h3><span className="count-pill small-pill">{roomWorkflow.overdue.length}</span></div>
        <HomeTaskRows tasks={roomWorkflow.overdue} data={data} now={now} />
      </section>
      <section className="inspector-section room-work-section today-room-work">
        <div className="section-header"><h3>{t('dueTodayShort')}</h3><span className="count-pill small-pill">{roomWorkflow.dueToday.length}</span></div>
        <HomeTaskRows tasks={roomWorkflow.dueToday} data={data} now={now} />
      </section>
      <section className="inspector-section room-work-section">
        <div className="section-header"><h3>{t('upcoming')}</h3><small>{t('nextSevenDays')}</small></div>
        <HomeTaskRows tasks={roomWorkflow.upcoming} data={data} now={now} upcoming />
      </section>
      <HomeStockAlerts supplies={selectedSupplies} />
      <button type="button" className="button primary start-room-button" disabled={!roomWorkflow.queue.length} onClick={() => onStartRoom(selectedEntity.id)}>{t('startRoom')}</button>
      {!roomWorkflow.queue.length && <p className="muted compact-text room-start-hint">{t('nothingDueInRoom')}</p>}
    </> : <>
      <section className="inspector-section">
        <div className="section-header"><h3>{t('currentTasks')}</h3><span className="count-pill small-pill">{selectedTasks.length}</span></div>
        {selectedTasks.length ? <HomeTaskRows tasks={selectedTasks} data={data} now={now} compact limit={5} />
          : <p className="muted compact-text">{t('noCurrentTasks')}</p>}
      </section>
      <HomeStockAlerts supplies={selectedSupplies} />
      {selectedEntity.labels.length > 0 && <div className="chip-list">{selectedEntity.labels.map((label) => <span key={label} className="chip">{label}</span>)}</div>}
    </>}
  </div>
}
