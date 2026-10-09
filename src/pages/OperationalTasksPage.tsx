import { ProductStockList, TaskProducts } from '../components/TaskProducts'
import { activityTitle, activitySubtitle, additionalActivityAppendix, groupLinkedTaskOccurrences } from '../lib/presentation'
import { homeCleanlinessSummary } from '../lib/home'
import { useEffect, useState } from 'react'
import { CalendarDots, CheckCircle, DotsThree, MinusCircle, UserSwitch } from '@phosphor-icons/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { dateTimeLocalValue, formatTaskDateTime, formatTaskTime, localDateInZone, localInputToUtc } from '../lib/date'
import { timelineDays, resolveTimelineDay } from '../lib/timelineNavigation'
import { buildOverviewGroups, canonicalTaskState, mergeCriticalItemsByEntity, type OverviewScope } from '../lib/overview'
import { buildActiveDeck } from '../lib/overviewDeck'
import { HouseState } from '../components/overview/HouseState'
import { ActiveDeck } from '../components/overview/ActiveDeck'
import { logClientError } from '../lib/errorLog'
import type { StockStatus, TaskAssignmentScope, TaskEvent, TaskOccurrence } from '../types/domain'
import type { TranslationKey } from '../lib/translations'

const stockStatuses: StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
interface UndoState { taskId: string; eventId: string; message: string }

export function OperationalTasksPage({ view }: { view: 'overview' | 'timeline' }) {
  const { data, currentMember, completeTask, completeTaskTarget, skipTask, postponeTask, reassignTask, undoTaskAction, restoreTaskToToday, setSupplyStatus } = useData()
  const { overviewCriticalCount, overviewCriticalThreshold } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const requestedTaskId = params.get('task')
  const requestedDay = params.get('day')
  const [selectedId, setSelectedId] = useState<string | null>(requestedTaskId)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [reassignId, setReassignId] = useState<string | null>(null)
  const [scope, setScope] = useState<OverviewScope>('mine')
  const [finishedOpen, setFinishedOpen] = useState(true)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [completionStamp, setCompletionStamp] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  useEffect(() => { setSelectedId(requestedTaskId) }, [requestedTaskId])
  useEffect(() => { if (!undo) return; const id = window.setTimeout(() => setUndo(null), 7000); return () => window.clearTimeout(id) }, [undo])
  useEffect(() => { const id = window.setInterval(() => setClockNow(new Date()), 60_000); return () => window.clearInterval(id) }, [])
  useEffect(() => { if (!completionStamp) return; const id = window.setTimeout(() => setCompletionStamp(null), 1400); return () => window.clearTimeout(id) }, [completionStamp])
  if (!data) return null

  const timezone = data.workspace.timezone
  const now = clockNow
  const today = localDateInZone(timezone, now)
  const activePeople = data.members.filter((member) => member.status === 'active')
  const groups = buildOverviewGroups(data, {
    now,
    currentMemberId: currentMember?.id,
    scope,
    criticalCount: overviewCriticalCount,
    criticalThreshold: overviewCriticalThreshold,
  })
  const selectedRaw = data.tasks.find((task) => task.id === selectedId)
  const selected = selectedRaw ? canonicalTaskState(data, selectedRaw) : undefined
  const rescheduleRaw = data.tasks.find((task) => task.id === rescheduleId)
  const rescheduleTask = rescheduleRaw ? canonicalTaskState(data, rescheduleRaw) : undefined
  const reassignRaw = data.tasks.find((task) => task.id === reassignId)
  const reassignTaskItem = reassignRaw ? canonicalTaskState(data, reassignRaw) : undefined
  const upcomingDays = timelineDays(timezone, now)
  const selectedDay = resolveTimelineDay(upcomingDays, requestedDay, groups.upcoming.map((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt))))
  const selectedDayTasks = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === selectedDay)
  const homeScores = homeCleanlinessSummary(data, now)
  const deckEntries = view === 'overview' ? buildActiveDeck(groups) : []
  const criticalSummaries = view === 'overview' ? mergeCriticalItemsByEntity(groups.criticalItems) : []

  async function rememberUndo(taskIdValue: string, eventId: string | null, message: string) {
    if (eventId) setUndo({ taskId: taskIdValue, eventId, message })
  }
  async function undoLast() {
    if (!undo || !window.confirm(t('confirmRestoreTask'))) return
    const value = undo; setUndo(null)
    await undoTaskAction(value.taskId, value.eventId)
  }
  function closeSelected() {
    setSelectedId(null)
    if (requestedTaskId) {
      const nextParams = new URLSearchParams(search)
      nextParams.delete('task')
      navigate({ pathname, search: nextParams.toString() ? `?${nextParams}` : '' }, { replace: true })
    }
  }
  async function completeDeckTask(id: string) {
    if (pendingTaskId || !window.confirm(t('confirmCompleteTask'))) return
    setPendingTaskId(id)
    setActionError(null)
    try {
      const eventId = await completeTask(id)
      if (eventId) {
        await rememberUndo(id, eventId, `${data!.tasks.find((task) => task.id === id)?.actionNameSnapshot ?? t('completed')} ${t('completed').toLowerCase()}`)
        setCompletionStamp(data!.tasks.find((task) => task.id === id)?.routineNameSnapshot ?? t('completed'))
      }
    } catch (error) {
      logClientError(error, { area: 'v2 overview card complete' })
      setActionError(t('careActionFailed'))
    } finally {
      setPendingTaskId(null)
    }
  }

  function chooseUpcomingDay(day: string) {
    const nextParams = new URLSearchParams(search)
    nextParams.set('day', day)
    navigate({ pathname, search: `?${nextParams}` }, { replace: true })
  }

  return <div className={view === 'overview' ? 'v2-overview hc-v2-paper' : 'stack page-stack overview-page timeline-page'}>
    {view === 'timeline' && <header className="page-title-row overview-hero"><div><div className="eyebrow">{t('today')}</div><h1>{t('timeline')}</h1><p className="muted">{t('timelineHint')}</p></div>
      {activePeople.length > 1 && <div className="segmented two overview-scope"><button className={scope === 'mine' ? 'selected' : ''} onClick={() => setScope('mine')}>{t('myTasks')}</button><button className={scope === 'household' ? 'selected' : ''} onClick={() => setScope('household')}>{t('householdTasks')}</button></div>}
    </header>}
    {view === 'overview' && <>
      <HouseState regular={homeScores.regular} deep={homeScores.deep} criticalItems={criticalSummaries} onOpenEntity={(itemId) => navigate(`/home?item=${encodeURIComponent(itemId)}`)}
        scope={scope} showScopeSwitch={activePeople.length > 1} onScopeChange={setScope} />
      <ActiveDeck entries={deckEntries} data={data} now={now} pendingTaskId={pendingTaskId} completionStamp={completionStamp} emptyLabel={groups.finished.length ? t('allHandledToday') : t('nothingElseToday')}
        onComplete={(id) => { void completeDeckTask(id) }} onReschedule={setRescheduleId} onMore={setSelectedId} />
    </>}

    {view === 'timeline' && <>
    <section className="overview-section finished-section">
      <button className="finished-toggle" onClick={() => setFinishedOpen((value) => !value)} aria-expanded={finishedOpen}><span><strong>{t('finished')}</strong><small>{groups.finished.length} {t('handledToday')}</small></span><span>{finishedOpen ? '−' : '+'}</span></button>
      {finishedOpen && (groups.finished.length ? <div className="task-list compact">{groupLinkedTaskOccurrences(groups.finished).map(({ task, linkedActivities }) => <TaskCard task={task} linkedActivities={linkedActivities} key={task.id} handledPostponed={task.state === 'scheduled'} />)}</div> : <div className="quiet-state">{t('nothingFinishedYet')}</div>)}
    </section>

    <section className="overview-section upcoming-section" aria-labelledby="upcoming-heading">
      <div className="overview-section-heading"><div><span className="eyebrow">{t('nextSevenDays')}</span><h2 id="upcoming-heading">{t('upcoming')}</h2></div></div>
      <p className="muted upcoming-hint">{t('upcomingPlanningHint')}</p>
      <div className="upcoming-strip" role="group" aria-label={t('upcoming')}>{upcomingDays.map((day) => {
        const count = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === day).length
        const labelDate = new Date(`${day}T12:00:00Z`)
        return <button type="button" aria-pressed={selectedDay === day} className={selectedDay === day ? 'upcoming-day selected' : 'upcoming-day'} key={day} onClick={() => chooseUpcomingDay(day)}><span>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(labelDate)}</span><b>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(labelDate)}</b><small>{count} {t('scheduledActivities')}</small></button>
      })}</div>
      {selectedDayTasks.length ? <div className="upcoming-list">{groupLinkedTaskOccurrences(selectedDayTasks).map(({ task, linkedActivities }) => <TaskCard key={task.id} task={task} linkedActivities={linkedActivities} compact />)}</div> : <div className="quiet-state">{t('nothingScheduled')}</div>}
    </section>

    </>}

    {selected && <TaskSheet task={selected} events={data.taskEvents.filter((event) => event.taskId === selected.id)} onClose={closeSelected} onReassignRequest={() => { closeSelected(); setReassignId(selected.id) }} />}
    {rescheduleTask && <RescheduleSheet task={rescheduleTask} timezone={timezone} locale={locale} t={t} onClose={() => setRescheduleId(null)} onReschedule={async (dueAt) => { const eventId = await postponeTask(rescheduleTask.id, dueAt); await rememberUndo(rescheduleTask.id, eventId, `${rescheduleTask.actionNameSnapshot} ${t('rescheduled').toLowerCase()}`) }} />}
    {reassignTaskItem && <ReassignSheet task={reassignTaskItem} members={data.members} t={t} onClose={() => setReassignId(null)} onReassign={async (scopeValue, memberId) => { const eventId = await reassignTask(reassignTaskItem.id, memberId, scopeValue); await rememberUndo(reassignTaskItem.id, eventId, `${reassignTaskItem.actionNameSnapshot} ${t('reassigned').toLowerCase()}`) }} />}
    {actionError && <div className="undo-snackbar v2-care-error" role="alert"><span>{actionError}</span><button onClick={() => setActionError(null)}>{t('close')}</button></div>}
    {undo && <div className="undo-snackbar" role="status"><span>{undo.message}</span><button onClick={() => void undoLast()}>{t('undo')}</button></div>}
  </div>

  function TaskCard({ task, compact = false, linkedActivities = [], handledPostponed = false }: { task: TaskOccurrence; compact?: boolean; linkedActivities?: TaskOccurrence[]; handledPostponed?: boolean }) {
    const assignee = data!.members.find((member) => member.id === task.assigneeMemberId)
    const assignmentLabel = task.assignmentScope === 'everyone' ? t('everyone') : assignee?.displayName ?? t('anyone')
    const terminal = task.state !== 'scheduled'
    const recentAction = data!.taskEvents
      .filter((event) => event.taskId === task.id && (event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED'))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    const recent = recentAction && Math.abs(now.getTime() - new Date(recentAction.at).getTime()) <= 2500 ? recentAction.type : null
    const motionClass = recent === 'COMPLETED' ? 'task-motion-complete' : recent === 'SKIPPED' ? 'task-motion-skip' : recent === 'POSTPONED' ? 'task-motion-reschedule' : ''
    const appendix = additionalActivityAppendix(data!, task)
    return <article className={`task-card overview-task-card ${terminal ? 'task-done' : ''} ${motionClass} ${compact ? 'compact-card' : ''}`}>
      <div className="task-main">
        <h2>{activityTitle(task)}</h2>
        <div className="task-description"><span>{activitySubtitle(task)}</span></div>
        <div className="task-time">{localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === today ? formatTaskTime(task.effectiveDueAt ?? task.dueAt, locale, timezone) : formatTaskDateTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}{task.state === 'completed' && <span className="status">{t('completed')}</span>}{task.state === 'skipped' && <span className="status skipped-status">{t('skipped')}</span>}{handledPostponed && <span className="status">{t('rescheduled')}</span>}</div>
        {task.parentOccurrenceId && task.supplies.length > 0 ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data!} /></div> : <TaskProducts task={task} data={data!} />}
        {appendix.length > 0 && <section className="linked-activities-section configured-appendix" aria-label={t('additionalActivities')}>
          <div className="linked-section-heading"><strong>{t('additionalActivities')}</strong><span>{appendix.length}</span></div>
          <div className="linked-activity-list">{appendix.map((entry) => <ConfiguredAdditionalActivityRow entry={entry} compact={compact} key={entry.routine.id} />)}</div>
        </section>}
        {task.parentOccurrenceId && <small className="linked-task-label">{t('linkedTo')} {data!.tasks.find((parent) => parent.id === task.parentOccurrenceId)?.routineNameSnapshot ?? t('routine')}</small>}
        {data!.routines.find((routine) => routine.id === task.routineId)?.affectsCleanliness === false && <small className="muted">{t('cleanlinessExcluded')}</small>}
        <div className="task-meta">{assignmentLabel} · <span className={`care-level-tag ${task.cleanlinessChannel === 'deep' ? 'deep' : 'routine'}`}>{task.cleanlinessChannel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span></div>
      </div>
      <div className="task-actions overview-actions">{task.state === 'scheduled' && (compact ? <button className="button secondary action-button" onClick={() => setRescheduleId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button> : <><button className="button primary action-button" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`)) }}><CheckCircle weight="bold" aria-hidden="true" />{t('done')}</button><button className="button secondary action-button" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`)) }}><MinusCircle aria-hidden="true" />{t('skip')}</button><button className="button secondary action-button" onClick={() => setRescheduleId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button></>)}<button className="button secondary square" aria-label={t('more')} onClick={() => setSelectedId(task.id)}><DotsThree size={22} weight="bold" aria-hidden="true" /></button></div>
    </article>
  }

  function statusLabel(status: StockStatus) { return status === 'available' ? t('available') : status === 'low' ? t('low') : status === 'reserve_only' ? t('reserveOnly') : t('outOfStock') }

  function ConfiguredAdditionalActivityRow({ entry, compact }: { entry: ReturnType<typeof additionalActivityAppendix>[number]; compact: boolean }) {
    const task = entry.occurrence
    const subtitle = [entry.targetNames.join(', '), entry.actionName].filter(Boolean).join(' - ')
    const frequency = t('everyParentTriggers').replace('N', String(entry.routine.triggerEvery ?? 1))
    const assignee = task ? data!.members.find((member) => member.id === task.assigneeMemberId) : undefined
    const assignmentLabel = task ? (task.assignmentScope === 'everyone' ? t('everyone') : assignee?.displayName ?? t('anyone')) : ''
    return <article className={`linked-activity-row configured ${task && task.state !== 'scheduled' ? 'terminal' : ''}`}>
      <div className="linked-activity-copy">
        <strong>{entry.routine.name}</strong>
        <span>{subtitle}</span>
        <small>{task ? `${formatTaskTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)} · ${assignmentLabel}` : frequency}</small>
        <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><ProductStockList supplies={entry.supplies} data={data!} /></div>
      </div>
      <div className="linked-activity-actions">
        {task?.state === 'completed' && <span className="status">{t('completed')}</span>}
        {task?.state === 'skipped' && <span className="status skipped-status">{t('skipped')}</span>}
        {task?.state === 'scheduled' && <>
          {!compact && <button className="button primary small" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`)) }}>{t('done')}</button>}
          {!compact && <button className="button secondary small" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`)) }}>{t('skip')}</button>}
          <button className="button secondary small" onClick={() => setRescheduleId(task.id)}>{t('reschedule')}</button>
          <button className="button secondary square small-square" aria-label={t('more')} onClick={() => setSelectedId(task.id)}><DotsThree size={18} weight="bold" aria-hidden="true" /></button>
        </>}
      </div>
    </article>
  }

  function LinkedActivityRow({ task, compact }: { task: TaskOccurrence; compact: boolean }) {
    const assignee = data!.members.find((member) => member.id === task.assigneeMemberId)
    const assignmentLabel = task.assignmentScope === 'everyone' ? t('everyone') : assignee?.displayName ?? t('anyone')
    return <article className={`linked-activity-row ${task.state !== 'scheduled' ? 'terminal' : ''}`}>
      <div className="linked-activity-copy">
        <strong>{activityTitle(task)}</strong>
        <span>{activitySubtitle(task)}</span>
        <small>{formatTaskTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)} · {assignmentLabel}</small>
        {task.supplies.length > 0 && <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data!} /></div>}
      </div>
      <div className="linked-activity-actions">
        {task.state === 'completed' && <span className="status">{t('completed')}</span>}
        {task.state === 'skipped' && <span className="status skipped-status">{t('skipped')}</span>}
        {task.state === 'scheduled' && <>
          {!compact && <button className="button primary small" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`)) }}>{t('done')}</button>}
          {!compact && <button className="button secondary small" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`)) }}>{t('skip')}</button>}
          <button className="button secondary small" onClick={() => setRescheduleId(task.id)}>{t('reschedule')}</button>
        </>}
        <button className="button secondary square small-square" aria-label={t('more')} onClick={() => setSelectedId(task.id)}><DotsThree size={18} weight="bold" aria-hidden="true" /></button>
      </div>
    </article>
  }

  function TaskSheet({ task, events, onClose, onReassignRequest }: { task: TaskOccurrence; events: TaskEvent[]; onClose: () => void; onReassignRequest: () => void }) {
    const workflow = [...events].filter((event) => event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED' || event.type === 'REOPENED').sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))
    const latestWorkflow = workflow[0]
    const terminalFallbackAt = task.completedAt ?? task.effectiveDueAt ?? task.dueAt
    const terminalToday = (task.state === 'completed' || task.state === 'skipped') && localDateInZone(timezone, new Date(terminalFallbackAt)) === today
    const latestIsRestorable = latestWorkflow && latestWorkflow.type !== 'REOPENED' && localDateInZone(timezone, new Date(latestWorkflow.at)) === today
    const canRestoreToday = terminalToday || Boolean(latestIsRestorable)
    const restoreSourceId = latestWorkflow && latestWorkflow.type !== 'REOPENED' ? latestWorkflow.id : undefined
    const triggeredAdditional = additionalActivityAppendix(data!, task)
    return <Sheet title={t('taskDetails')} onClose={onClose}><div className="stack">
      <div className="summary-block"><strong>{activityTitle(task)}</strong><span>{activitySubtitle(task)}</span><span>{formatTaskDateTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}</span></div>
      {triggeredAdditional.length > 0 && <section className="action-section triggered-additional-menu"><div className="section-header"><div><h3>{t('additionalActivities')}</h3><small>{t('additionalActivity')}</small></div><span className="count-pill small-pill">{triggeredAdditional.length}</span></div><div className="linked-activity-list">{triggeredAdditional.map((entry) => {
        const child = entry.occurrence!
        const childEvents = data!.taskEvents.filter((event) => event.taskId === child.id)
        const childWorkflow = [...childEvents].filter((event) => event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED' || event.type === 'REOPENED').sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))
        const childLatest = childWorkflow[0]
        const childTerminalAt = child.completedAt ?? child.effectiveDueAt ?? child.dueAt
        const childTerminalToday = (child.state === 'completed' || child.state === 'skipped') && localDateInZone(timezone, new Date(childTerminalAt)) === today
        const childLatestRestorable = childLatest && childLatest.type !== 'REOPENED' && localDateInZone(timezone, new Date(childLatest.at)) === today
        const childCanRestore = childTerminalToday || Boolean(childLatestRestorable)
        const childRestoreSourceId = childLatest && childLatest.type !== 'REOPENED' ? childLatest.id : undefined
        return <article className={`linked-activity-row menu-linked-activity ${child.state !== 'scheduled' ? 'terminal' : ''}`} key={child.id}><div className="linked-activity-copy"><strong>{activityTitle(child)}</strong><span>{activitySubtitle(child)}</span><small>{formatTaskDateTime(child.effectiveDueAt ?? child.dueAt, locale, timezone)}</small>{entry.supplies.length > 0 && <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><ProductStockList supplies={entry.supplies} data={data!} /></div>}</div><div className="linked-activity-actions menu-actions">
          {child.state === 'scheduled' && <><button className="button primary small" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(child.id).then((eventId) => { void rememberUndo(child.id, eventId, `${child.actionNameSnapshot} ${t('completed').toLowerCase()}`); onClose() }) }}>{t('done')}</button><button className="button secondary small" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(child.id).then((eventId) => { void rememberUndo(child.id, eventId, `${child.actionNameSnapshot} ${t('skipped').toLowerCase()}`); onClose() }) }}>{t('skip')}</button><button className="button secondary small" onClick={() => { onClose(); setRescheduleId(child.id) }}>{t('reschedule')}</button><button className="button secondary small" onClick={() => { onClose(); setReassignId(child.id) }}>{t('reassign')}</button></>}
          {childCanRestore && <button className="button secondary small" onClick={() => { if (!window.confirm(t('confirmRestoreTask'))) return; void restoreTaskToToday(child.id, childRestoreSourceId).then(onClose) }}>{t('restoreToDoToday')}</button>}
        </div></article>
      })}</div></section>}
      {canRestoreToday && <button className="button secondary" onClick={() => { if (!window.confirm(t('confirmRestoreTask'))) return; void restoreTaskToToday(task.id, restoreSourceId).then(onClose) }}>{t('restoreToDoToday')}</button>}
      {task.targets.length > 1 && <section className="action-section"><div className="section-header"><div><h3>{t('taskTargets')}</h3><small>{t('targetCompletionHint')}</small></div><small>{task.targets.filter((target) => target.completedAt).length}/{task.targets.length}</small></div><div className="target-progress-list">{task.targets.map((target) => <div className={target.completedAt ? 'target-progress-row done' : 'target-progress-row'} key={target.entityId}><div><strong>{target.entityName}</strong><small>{target.entityTypeName}</small></div>{target.completedAt ? <span className="status">{t('completed')}</span> : task.state === 'scheduled' ? <button className="button secondary small" onClick={() => { if (!window.confirm(`${t('confirmCompleteTask')}\n${target.entityName}`)) return; void completeTaskTarget(task.id, target.entityId).then(onClose) }}>{t('completeTarget')}</button> : null}</div>)}</div></section>}
      {task.supplies.length > 0 && <section className="action-section"><h3>{t('reportStock')}</h3><div className="task-supplies">{task.supplies.map((snapshot) => { const supply = data!.supplies.find((item) => item.id === snapshot.supplyId); if (!supply || supply.archivedAt) return null; return <div className="task-supply-row" key={snapshot.supplyId}><div><strong>{snapshot.supplyName}</strong><small>{statusLabel(supply.status)}</small></div><div className="mini-stock-grid">{stockStatuses.map((status) => <button key={status} aria-label={statusLabel(status)} className={supply.status === status ? 'selected' : ''} onClick={() => void setSupplyStatus(supply.id, status, task.id).then(onClose)}><span className={`stock-dot stock-${status}`} /></button>)}</div></div> })}</div></section>}
      {task.state === 'scheduled' && <section className="action-section secondary-task-actions"><button className="button secondary" onClick={onReassignRequest}><UserSwitch aria-hidden="true" />{t('reassign')}</button><button className="button danger-outline" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => { void rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`); onClose() }) }}>{t('skip')}</button></section>}
      <details className="explain-box"><summary>{t('whyThisTask')}</summary><div className="stack compact-text"><p>{task.explanation.schedule}</p><p>{task.explanation.assignment}</p><p>{task.explanation.targetSummary}</p></div></details>
      <section className="action-section"><h3>{t('history')}</h3><div className="timeline">{[...events].reverse().map((event) => <div className="timeline-item" key={event.id}><span>{t(`event_${event.type}` as TranslationKey)}</span><small>{formatTaskDateTime(event.at, locale, timezone)}</small></div>)}</div></section>
    </div></Sheet>
  }

}

function RescheduleSheet({ task, timezone, locale, t, onClose, onReschedule }: {
  task: TaskOccurrence
  timezone: string
  locale: string
  t: (key: TranslationKey) => string
  onClose: () => void
  onReschedule: (dueAt: string) => Promise<void>
}) {
  const [value, setValue] = useState(dateTimeLocalValue(task.effectiveDueAt ?? task.dueAt, timezone))
  return <Sheet title={t('reschedule')} onClose={onClose}><div className="stack focused-action-sheet">
    <div className="summary-block"><strong>{activityTitle(task)}</strong><span>{activitySubtitle(task)}</span><span>{t('rescheduleOnceHint')}</span></div>
    <label className="field"><span>{t('newDateTime')}</span><input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} autoFocus /></label>
    <button className="button primary" onClick={() => {
      const dueAt = localInputToUtc(value, timezone)
      if (!window.confirm(`${t('confirmRescheduleTask')}\n${formatTaskDateTime(dueAt, locale, timezone)}`)) return
      void onReschedule(dueAt).then(onClose)
    }}><CalendarDots aria-hidden="true" />{t('reschedule')}</button>
  </div></Sheet>
}

function ReassignSheet({ task, members, t, onClose, onReassign }: {
  task: TaskOccurrence
  members: Array<{ id: string; displayName: string; status: string }>
  t: (key: TranslationKey) => string
  onClose: () => void
  onReassign: (scope: TaskAssignmentScope, memberId?: string) => Promise<void>
}) {
  const initialChoice = task.assignmentScope === 'everyone' ? '__everyone__' : task.assigneeMemberId ?? '__unassigned__'
  const [assignee, setAssignee] = useState(initialChoice)
  const scope: TaskAssignmentScope = assignee === '__everyone__' ? 'everyone' : assignee === '__unassigned__' ? 'unassigned' : 'member'
  const memberId = scope === 'member' ? assignee : undefined
  const assigneeName = scope === 'everyone' ? t('everyone') : scope === 'unassigned' ? t('anyone') : members.find((member) => member.id === memberId)?.displayName ?? t('anyone')
  return <Sheet title={t('reassign')} onClose={onClose}><div className="stack focused-action-sheet">
    <div className="summary-block"><strong>{activityTitle(task)}</strong><span>{activitySubtitle(task)}</span><span>{t('reassignOnceHint')}</span></div>
    <label className="field"><span>{t('selectMember')}</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)} autoFocus><option value="__unassigned__">{t('anyone')}</option><option value="__everyone__">{t('everyone')}</option>{members.filter((member) => member.status === 'active').map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select></label>
    {scope === 'unassigned' && <p className="muted compact-text">{t('unassignedHint')}</p>}
    {scope === 'everyone' && <p className="notice compact-text">{t('everyoneHint')}</p>}
    <button className="button primary" onClick={() => {
      if (!window.confirm(`${t('confirmReassignTask')}\n${assigneeName}`)) return
      void onReassign(scope, memberId).then(onClose)
    }}><UserSwitch aria-hidden="true" />{t('reassign')}</button>
  </div></Sheet>
}
