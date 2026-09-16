import { CleanlinessMood } from '../components/CleanlinessMood'
import { TaskProducts } from '../components/TaskProducts'
import { activityTitle, activitySubtitle, groupLinkedTaskOccurrences } from '../lib/presentation'
import { homeCleanlinessSummary } from '../lib/home'
import { useEffect, useRef, useState } from 'react'
import { CalendarDots, CheckCircle, DotsThree, MinusCircle, UserSwitch } from '@phosphor-icons/react'
import { useNavigate, useParams } from 'react-router-dom'
import { Illustration } from '../components/Illustration'
import { Sheet } from '../components/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { addDays, dateTimeLocalValue, formatTaskDateTime, formatTaskTime, localDateInZone, localInputToUtc } from '../lib/date'
import { buildOverviewGroups, canonicalTaskState, mergeCriticalItemsByEntity, type OverviewScope } from '../lib/overview'
import type { StockStatus, TaskAssignmentScope, TaskEvent, TaskOccurrence } from '../types/domain'
import type { TranslationKey } from '../lib/translations'

const stockStatuses: StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
interface UndoState { taskId: string; eventId: string; message: string }

export function OverviewPage() {
  const { data, currentMember, completeTask, completeTaskTarget, skipTask, postponeTask, reassignTask, undoTaskAction, restoreTaskToToday, setSupplyStatus } = useData()
  const { overviewCriticalCount, overviewCriticalThreshold } = useAuth()
  const { t, locale } = useI18n()
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(taskId ?? null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [reassignId, setReassignId] = useState<string | null>(null)
  const cleanlinessRail = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<OverviewScope>('mine')
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [selectedUpcomingDay, setSelectedUpcomingDay] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [clockNow, setClockNow] = useState(() => new Date())
  useEffect(() => { if (taskId) setSelectedId(taskId) }, [taskId])
  useEffect(() => { if (!undo) return; const id = window.setTimeout(() => setUndo(null), 7000); return () => window.clearTimeout(id) }, [undo])
  useEffect(() => { const id = window.setInterval(() => setClockNow(new Date()), 60_000); return () => window.clearInterval(id) }, [])
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
  const upcomingDays = Array.from({ length: 7 }, (_, index) => addDays(today, index + 1))
  const selectedDay = selectedUpcomingDay ?? upcomingDays.find((day) => groups.upcoming.some((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === day)) ?? upcomingDays[0]
  const selectedDayTasks = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === selectedDay)
  const homeScores = homeCleanlinessSummary(data, now)
  const urgentCount = groups.overdue.length + groups.dueNow.length
  const criticalSummaries = mergeCriticalItemsByEntity(groups.criticalItems)

  async function rememberUndo(taskIdValue: string, eventId: string | null, message: string) {
    if (eventId) setUndo({ taskId: taskIdValue, eventId, message })
  }
  async function undoLast() {
    if (!undo || !window.confirm(t('confirmRestoreTask'))) return
    const value = undo; setUndo(null)
    await undoTaskAction(value.taskId, value.eventId)
  }
  function closeSelected() { setSelectedId(null); if (taskId) navigate('/', { replace: true }) }

  return <div className="stack page-stack overview-page">
    <header className="page-title-row overview-hero">
      <div><div className="eyebrow">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(now)}</div><h1>{t('overview')}</h1><p className="muted">{t('overviewHint')}</p></div>
      {activePeople.length > 1 && <div className="segmented two overview-scope"><button className={scope === 'mine' ? 'selected' : ''} onClick={() => setScope('mine')}>{t('myTasks')}</button><button className={scope === 'household' ? 'selected' : ''} onClick={() => setScope('household')}>{t('householdTasks')}</button></div>}
    </header>

    <section className="overview-section critical-section" aria-labelledby="cleanliness-heading">
      <div className="overview-section-heading"><div><h2 id="cleanliness-heading">{t('cleanliness')}</h2><small className="muted">{t('homeCleanliness')}</small></div></div>
      <div className="overview-home-cleanliness" aria-label={t('homeCleanliness')}>
        {(['regular', 'deep'] as const).map((channel) => {
          const score = homeScores[channel]
          const label = channel === 'deep' ? t('deepCleanliness') : t('regularCleanliness')
          const fill = channel === 'deep' ? 'var(--color-ink-muted)' : 'var(--color-primary)'
          return <article className={`home-cleanliness-donut-card ${channel}`} key={channel}>
            <strong>{label}</strong>
            <div className="cleanliness-donut" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score == null ? undefined : Math.round(score)} aria-valuetext={score == null ? t('notTracked') : `${Math.round(score)}%`} style={{ background: score == null ? 'var(--color-surface-soft)' : `conic-gradient(${fill} ${Math.max(0, Math.min(100, score))}%, var(--color-line) 0)` }}>
              <div className="cleanliness-donut-center">{score == null ? <span className="donut-untracked">—</span> : <CleanlinessMood score={score} />}</div>
            </div>
            <span className="home-donut-score">{score == null ? t('notTracked') : `${Math.round(score)}%`}</span>
          </article>
        })}
      </div>

      <div className="critical-rail-heading"><div><h3>{t('criticalCleanliness')}</h3><small className="muted">{criticalSummaries.length} {t('criticalCountLabel')}</small></div>{criticalSummaries.length > 0 && <div className="rail-controls"><button className="button secondary square" aria-label={t('previousCleanliness')} onClick={() => cleanlinessRail.current?.scrollBy({ left: -300, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>&larr;</button><button className="button secondary square" aria-label={t('nextCleanliness')} onClick={() => cleanlinessRail.current?.scrollBy({ left: 300, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>&rarr;</button></div>}</div>
      {criticalSummaries.length > 0 && <><p className="muted rail-hint">{t('cleanlinessScrollHint')}</p><div className="cleanliness-rail" ref={cleanlinessRail} tabIndex={0} role="region" aria-label={t('criticalCleanliness')}>
        {criticalSummaries.map((item) => {
          const both = item.channels.length > 1
          const lowest = Math.min(...item.channels.map((channel) => channel.score))
          const earliestDue = [...item.channels].filter((channel) => channel.theoreticalDueAt).sort((a, b) => new Date(a.theoreticalDueAt!).getTime() - new Date(b.theoreticalDueAt!).getTime())[0]
          return <article className="critical-card" key={item.itemId}>
            <div className="critical-card-top"><div><strong>{item.name}</strong><small>{item.roomName ?? t('home')}</small></div><CleanlinessMood score={lowest} /></div>
            <div className="critical-type-line"><span className={`care-level-tag ${both ? 'both' : item.channels[0].channel === 'deep' ? 'deep' : 'routine'}`}>{both ? `${t('routineCleaning')} + ${t('deepCleaning')}` : item.channels[0].channel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span></div>
            <div className="critical-score-list">{item.channels.map((channel) => <div className={`critical-score-row ${channel.channel}`} key={channel.channel}>
              <div><span>{channel.channel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span><strong>{Math.round(channel.score)}%</strong></div>
              <div className="cleanliness-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(channel.score)} aria-label={`${channel.channel === 'deep' ? t('deepCleaning') : t('routineCleaning')} ${item.name}`}><span style={{ width: `${channel.score}%` }} /></div>
            </div>)}</div>
            <div className="critical-card-bottom"><span>{item.channels.some((channel) => channel.overdue) ? t('overdue') : earliestDue?.theoreticalDueAt ? formatTaskDateTime(earliestDue.theoreticalDueAt, locale, timezone) : t('needsAttention')}</span><button className="text-button" onClick={() => navigate(`/home?item=${item.itemId}`)}>{t('open')}</button></div>
          </article>
        })}
      </div></>}
      {!criticalSummaries.length && <div className="quiet-state">{t('noCriticalItems')}</div>}
    </section>

    <div className="overview-plan-heading"><div><span className="eyebrow">{t('today')}</span><h2>{t('workForToday')}</h2></div><div className="plan-counts"><span className={urgentCount ? 'plan-count urgent' : 'plan-count'}>{urgentCount} {t('urgentWork').toLowerCase()}</span><span className="plan-count">{groups.laterToday.length} {t('laterToday').toLowerCase()}</span></div></div>

    {groups.overdue.length > 0 && <TaskSection title={t('overdue')} tasks={groups.overdue} tone="overdue" />}
    {groups.dueNow.length > 0 && <TaskSection title={t('dueNow')} tasks={groups.dueNow} tone="due-now" />}
    {groups.laterToday.length > 0 && <TaskSection title={t('laterToday')} tasks={groups.laterToday} />}
    {groups.overdue.length + groups.dueNow.length + groups.laterToday.length === 0 && <div className="quiet-state large overview-empty-state"><Illustration id="emptyOverview" className="overview-empty-illustration" /><span>{t('nothingElseToday')}</span></div>}

    <section className="overview-section finished-section">
      <button className="finished-toggle" onClick={() => setFinishedOpen((value) => !value)} aria-expanded={finishedOpen}><span><strong>{t('finished')}</strong><small>{groups.finished.length} {t('handledToday')}</small></span><span>{finishedOpen ? '−' : '+'}</span></button>
      {finishedOpen && (groups.finished.length ? <div className="task-list compact">{groupLinkedTaskOccurrences(groups.finished).map(({ task, linkedActivities }) => <TaskCard task={task} linkedActivities={linkedActivities} key={task.id} />)}</div> : <div className="quiet-state">{t('nothingFinishedYet')}</div>)}
    </section>

    <section className="overview-section upcoming-section" aria-labelledby="upcoming-heading">
      <div className="overview-section-heading"><div><span className="eyebrow">{t('nextSevenDays')}</span><h2 id="upcoming-heading">{t('upcoming')}</h2></div></div>
      <p className="muted upcoming-hint">{t('upcomingPlanningHint')}</p>
      <div className="upcoming-strip" role="tablist" aria-label={t('upcoming')}>{upcomingDays.map((day) => {
        const count = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === day).length
        const labelDate = new Date(`${day}T12:00:00Z`)
        return <button role="tab" aria-selected={selectedDay === day} className={selectedDay === day ? 'upcoming-day selected' : 'upcoming-day'} key={day} onClick={() => setSelectedUpcomingDay(day)}><span>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(labelDate)}</span><b>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(labelDate)}</b><small>{count} {t('scheduledActivities')}</small></button>
      })}</div>
      {selectedDayTasks.length ? <div className="upcoming-list">{groupLinkedTaskOccurrences(selectedDayTasks).map(({ task, linkedActivities }) => <TaskCard key={task.id} task={task} linkedActivities={linkedActivities} compact />)}</div> : <div className="quiet-state">{t('nothingScheduled')}</div>}
    </section>

    {selected && <TaskSheet task={selected} events={data.taskEvents.filter((event) => event.taskId === selected.id)} onClose={closeSelected} onReassignRequest={() => { closeSelected(); setReassignId(selected.id) }} />}
    {rescheduleTask && <RescheduleSheet task={rescheduleTask} timezone={timezone} locale={locale} t={t} onClose={() => setRescheduleId(null)} onReschedule={async (dueAt) => { const eventId = await postponeTask(rescheduleTask.id, dueAt); await rememberUndo(rescheduleTask.id, eventId, `${rescheduleTask.actionNameSnapshot} ${t('rescheduled').toLowerCase()}`) }} />}
    {reassignTaskItem && <ReassignSheet task={reassignTaskItem} members={data.members} t={t} onClose={() => setReassignId(null)} onReassign={async (scopeValue, memberId) => { const eventId = await reassignTask(reassignTaskItem.id, memberId, scopeValue); await rememberUndo(reassignTaskItem.id, eventId, `${reassignTaskItem.actionNameSnapshot} ${t('reassigned').toLowerCase()}`) }} />}
    {undo && <div className="undo-snackbar" role="status"><span>{undo.message}</span><button onClick={() => void undoLast()}>{t('undo')}</button></div>}
  </div>

  function TaskSection({ title, tasks, tone }: { title: string; tasks: TaskOccurrence[]; tone?: 'overdue' | 'due-now' }) {
    return <section className={`overview-section task-section ${tone ?? ''}`}><div className="overview-section-heading"><h2>{title}</h2><span>{tasks.length}</span></div><div className="task-list">{groupLinkedTaskOccurrences(tasks).map(({ task, linkedActivities }) => <TaskCard key={task.id} task={task} linkedActivities={linkedActivities} />)}</div></section>
  }

  function TaskCard({ task, compact = false, linkedActivities = [] }: { task: TaskOccurrence; compact?: boolean; linkedActivities?: TaskOccurrence[] }) {
    const assignee = data!.members.find((member) => member.id === task.assigneeMemberId)
    const assignmentLabel = task.assignmentScope === 'everyone' ? t('everyone') : assignee?.displayName ?? t('anyone')
    const terminal = task.state !== 'scheduled'
    const recentAction = data!.taskEvents
      .filter((event) => event.taskId === task.id && (event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED'))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    const recent = recentAction && Math.abs(now.getTime() - new Date(recentAction.at).getTime()) <= 2500 ? recentAction.type : null
    const motionClass = recent === 'COMPLETED' ? 'task-motion-complete' : recent === 'SKIPPED' ? 'task-motion-skip' : recent === 'POSTPONED' ? 'task-motion-reschedule' : ''
    return <article className={`task-card overview-task-card ${terminal ? 'task-done' : ''} ${motionClass} ${compact ? 'compact-card' : ''}`}>
      <div className="task-main">
        <h2>{activityTitle(task)}</h2>
        <div className="task-description"><span>{activitySubtitle(task)}</span></div>
        <div className="task-time">{localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === today ? formatTaskTime(task.effectiveDueAt ?? task.dueAt, locale, timezone) : formatTaskDateTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}{task.state === 'completed' && <span className="status">{t('completed')}</span>}{task.state === 'skipped' && <span className="status skipped-status">{t('skipped')}</span>}</div>
        {task.parentOccurrenceId && task.supplies.length > 0 ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data!} /></div> : <TaskProducts task={task} data={data!} />}
        {linkedActivities.length > 0 && <section className="linked-activities-section" aria-label={t('additionalActivities')}>
          <div className="linked-section-heading"><strong>{t('additionalActivities')}</strong><span>{linkedActivities.length}</span></div>
          <div className="linked-activity-list">{linkedActivities.map((linked) => <LinkedActivityRow task={linked} compact={compact} key={linked.id} />)}</div>
        </section>}
        {task.parentOccurrenceId && <small className="linked-task-label">{t('linkedTo')} {data!.tasks.find((parent) => parent.id === task.parentOccurrenceId)?.routineNameSnapshot ?? t('routine')}</small>}
        {data!.routines.find((routine) => routine.id === task.routineId)?.affectsCleanliness === false && <small className="muted">{t('cleanlinessExcluded')}</small>}
        <div className="task-meta">{assignmentLabel} · <span className={`care-level-tag ${task.cleanlinessChannel === 'deep' ? 'deep' : 'routine'}`}>{task.cleanlinessChannel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span></div>
      </div>
      <div className="task-actions overview-actions">{task.state === 'scheduled' && (compact ? <button className="button secondary action-button" onClick={() => setRescheduleId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button> : <><button className="button primary action-button" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`)) }}><CheckCircle weight="bold" aria-hidden="true" />{t('done')}</button><button className="button secondary action-button" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`)) }}><MinusCircle aria-hidden="true" />{t('skip')}</button><button className="button secondary action-button" onClick={() => setRescheduleId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button></>)}<button className="button secondary square" aria-label={t('more')} onClick={() => setSelectedId(task.id)}><DotsThree size={22} weight="bold" aria-hidden="true" /></button></div>
    </article>
  }

  function statusLabel(status: StockStatus) { return status === 'available' ? t('available') : status === 'low' ? t('low') : status === 'reserve_only' ? t('reserveOnly') : t('outOfStock') }

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
    return <Sheet title={t('taskDetails')} onClose={onClose}><div className="stack">
      <div className="summary-block"><strong>{activityTitle(task)}</strong><span>{activitySubtitle(task)}</span><span>{formatTaskDateTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}</span></div>
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
