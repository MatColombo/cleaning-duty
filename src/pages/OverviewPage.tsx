import { useEffect, useState } from 'react'
import { CalendarDots, CheckCircle, DotsThree, MinusCircle } from '@phosphor-icons/react'
import { useNavigate, useParams } from 'react-router-dom'
import { Illustration } from '../components/Illustration'
import { Sheet } from '../components/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { addDays, dateTimeLocalValue, formatTaskDateTime, formatTaskTime, localDateInZone, localInputToUtc } from '../lib/date'
import { buildOverviewGroups, type OverviewScope } from '../lib/overview'
import type { StockStatus, TaskEvent, TaskOccurrence } from '../types/domain'
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
  const selected = data.tasks.find((task) => task.id === selectedId)
  const upcomingDays = Array.from({ length: 7 }, (_, index) => addDays(today, index + 1))
  const selectedDay = selectedUpcomingDay ?? upcomingDays.find((day) => groups.upcoming.some((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === day)) ?? upcomingDays[0]
  const selectedDayTasks = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === selectedDay)
  const criticalByChannel = {
    regular: groups.criticalItems.filter((item) => item.channel === 'regular'),
    deep: groups.criticalItems.filter((item) => item.channel === 'deep'),
  }

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

    <section className="overview-section critical-section">
      <div className="overview-section-heading"><div><span className="eyebrow">{t('cleanliness')}</span><h2>{t('criticalCleanliness')}</h2></div><span className="count-pill">{groups.criticalItems.length}</span></div>
      {groups.criticalItems.length === 0 ? <div className="quiet-state">{t('noCriticalItems')}</div> : <div className="critical-channel-list">{(['regular', 'deep'] as const).map((channel) => criticalByChannel[channel].length > 0 && <div className="critical-channel-block" key={channel}>
        <div className="critical-channel-heading"><strong>{channel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</strong><span>{criticalByChannel[channel].length}</span></div>
        <div className="critical-grid">{criticalByChannel[channel].map((item) => <article className="critical-card" key={`${item.itemId}:${item.channel}`}>
          <div className="critical-card-top"><div><strong>{item.name}</strong><small>{item.roomName ?? t('home')}</small></div><strong>{Math.round(item.score)}%</strong></div>
          <div className="cleanliness-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.score)} aria-label={`${channel === 'deep' ? t('deepCleaning') : t('routineCleaning')} ${item.name} ${Math.round(item.score)}%`}><span style={{ width: `${item.score}%` }} /></div>
          <div className="critical-card-bottom"><span>{item.overdue ? t('overdue') : item.theoreticalDueAt ? formatTaskDateTime(item.theoreticalDueAt, locale, timezone) : t('needsAttention')}</span><button className="text-button" onClick={() => navigate(`/home?item=${item.itemId}`)}>{t('open')}</button></div>
        </article>)}</div>
      </div>)}</div>}
    </section>

    {groups.overdue.length > 0 && <TaskSection title={t('overdue')} tasks={groups.overdue} tone="overdue" />}
    {groups.dueNow.length > 0 && <TaskSection title={t('dueNow')} tasks={groups.dueNow} />}
    {groups.laterToday.length > 0 && <TaskSection title={t('laterToday')} tasks={groups.laterToday} />}
    {groups.overdue.length + groups.dueNow.length + groups.laterToday.length === 0 && <div className="quiet-state large overview-empty-state"><Illustration id="emptyOverview" className="overview-empty-illustration" /><span>{t('nothingElseToday')}</span></div>}

    <section className="overview-section finished-section">
      <button className="finished-toggle" onClick={() => setFinishedOpen((value) => !value)} aria-expanded={finishedOpen}><span><strong>{t('finished')}</strong><small>{groups.finished.length} {t('handledToday')}</small></span><span>{finishedOpen ? '−' : '+'}</span></button>
      {finishedOpen && (groups.finished.length ? <div className="task-list compact">{groups.finished.map((task) => <TaskCard task={task} key={task.id} />)}</div> : <div className="quiet-state">{t('nothingFinishedYet')}</div>)}
    </section>

    <section className="overview-section upcoming-section">
      <div className="overview-section-heading"><div><span className="eyebrow">{t('nextSevenDays')}</span><h2>{t('upcoming')}</h2></div></div>
      <div className="upcoming-strip" role="tablist" aria-label={t('upcoming')}>{upcomingDays.map((day) => {
        const count = groups.upcoming.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === day).length
        const labelDate = new Date(`${day}T12:00:00Z`)
        return <button role="tab" aria-selected={selectedDay === day} className={selectedDay === day ? 'upcoming-day selected' : 'upcoming-day'} key={day} onClick={() => setSelectedUpcomingDay(day)}><span>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(labelDate)}</span><strong>{count}</strong></button>
      })}</div>
      {selectedDayTasks.length ? <div className="upcoming-list">{selectedDayTasks.map((task) => <TaskCard key={task.id} task={task} compact />)}</div> : <div className="quiet-state">{t('nothingScheduled')}</div>}
    </section>

    {selected && <TaskSheet task={selected} events={data.taskEvents.filter((event) => event.taskId === selected.id)} onClose={closeSelected} />}
    {undo && <div className="undo-snackbar" role="status"><span>{undo.message}</span><button onClick={() => void undoLast()}>{t('undo')}</button></div>}
  </div>

  function TaskSection({ title, tasks, tone }: { title: string; tasks: TaskOccurrence[]; tone?: 'overdue' }) {
    return <section className={`overview-section task-section ${tone ?? ''}`}><div className="overview-section-heading"><h2>{title}</h2><span>{tasks.length}</span></div><div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div></section>
  }

  function TaskCard({ task, compact = false }: { task: TaskOccurrence; compact?: boolean }) {
    const assignee = data!.members.find((member) => member.id === task.assigneeMemberId)
    const terminal = task.state !== 'scheduled'
    const recentAction = data!.taskEvents
      .filter((event) => event.taskId === task.id && (event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED'))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    const recent = recentAction && Math.abs(now.getTime() - new Date(recentAction.at).getTime()) <= 2500 ? recentAction.type : null
    const motionClass = recent === 'COMPLETED' ? 'task-motion-complete' : recent === 'SKIPPED' ? 'task-motion-skip' : recent === 'POSTPONED' ? 'task-motion-reschedule' : ''
    return <article className={`task-card overview-task-card ${terminal ? 'task-done' : ''} ${motionClass} ${compact ? 'compact-card' : ''}`}>
      <div className="task-main">
        <div className="task-time">{formatTaskTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}{task.state === 'completed' && <span className="status">{t('completed')}</span>}{task.state === 'skipped' && <span className="status skipped-status">{t('skipped')}</span>}</div>
        <h2>{task.actionNameSnapshot}</h2>
        <div className="task-description"><span>{task.targets.map((target) => target.entityName).join(', ')} · {task.routineNameSnapshot}</span></div>
        {task.supplies.length > 0 && <div className="overview-supply-strip">{task.supplies.map((snapshot) => { const supply = data!.supplies.find((item) => item.id === snapshot.supplyId && !item.archivedAt); if (!supply) return null; return <span className="overview-supply" key={snapshot.supplyId}><span className={`stock-dot stock-${supply.status}`} />{snapshot.supplyName}: {statusLabel(supply.status)}</span> })}</div>}
        <div className="task-meta">{assignee?.displayName ?? t('anyone')} · <span className={`care-level-tag ${task.cleanlinessChannel === 'deep' ? 'deep' : 'routine'}`}>{task.cleanlinessChannel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span></div>
      </div>
      <div className="task-actions overview-actions">{task.state === 'scheduled' && (compact ? <button className="button secondary action-button" onClick={() => setSelectedId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button> : <><button className="button primary action-button" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`)) }}><CheckCircle weight="bold" aria-hidden="true" />{t('done')}</button><button className="button secondary action-button" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`)) }}><MinusCircle aria-hidden="true" />{t('skip')}</button><button className="button secondary action-button" onClick={() => setSelectedId(task.id)}><CalendarDots aria-hidden="true" />{t('reschedule')}</button></>)}<button className="button secondary square" aria-label={t('more')} onClick={() => setSelectedId(task.id)}><DotsThree size={22} weight="bold" aria-hidden="true" /></button></div>
    </article>
  }

  function statusLabel(status: StockStatus) { return status === 'available' ? t('available') : status === 'low' ? t('low') : status === 'reserve_only' ? t('reserveOnly') : t('outOfStock') }

  function TaskSheet({ task, events, onClose }: { task: TaskOccurrence; events: TaskEvent[]; onClose: () => void }) {
    const [postponeValue, setPostponeValue] = useState(dateTimeLocalValue(task.effectiveDueAt ?? task.dueAt, timezone))
    const [assignee, setAssignee] = useState(task.assigneeMemberId ?? '')
    const latestReversible = [...events].filter((event) => event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED').sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    const terminalFallbackAt = task.completedAt ?? task.effectiveDueAt ?? task.dueAt
    const terminalToday = (task.state === 'completed' || task.state === 'skipped') && localDateInZone(timezone, new Date(terminalFallbackAt)) === today
    const canRestoreToday = terminalToday || Boolean(latestReversible && localDateInZone(timezone, new Date(latestReversible.at)) === today)
    return <Sheet title={task.routineNameSnapshot} onClose={onClose}><div className="stack">
      <div className="summary-block"><span className="eyebrow">{task.actionNameSnapshot}</span><strong>{task.targets.map((target) => target.entityName).join(', ')}</strong><span>{formatTaskDateTime(task.effectiveDueAt ?? task.dueAt, locale, timezone)}</span></div>
      {task.state === 'scheduled' && <button className="button primary" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTask(task.id).then((eventId) => { void rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('completed').toLowerCase()}`); onClose() }) }}>{t('done')}</button>}
      {canRestoreToday && <button className="button secondary" onClick={() => { if (!window.confirm(t('confirmRestoreTask'))) return; void restoreTaskToToday(task.id, latestReversible?.id).then(onClose) }}>{t('restoreToDoToday')}</button>}
      <section className="action-section"><div className="section-header"><h3>{t('taskTargets')}</h3><small>{task.targets.filter((target) => target.completedAt).length}/{task.targets.length}</small></div><div className="target-progress-list">{task.targets.map((target) => <div className={target.completedAt ? 'target-progress-row done' : 'target-progress-row'} key={target.entityId}><div><strong>{target.entityName}</strong><small>{target.entityTypeName}</small></div>{target.completedAt ? <span className="status">{t('completed')}</span> : task.state === 'scheduled' ? <button className="button secondary small" onClick={() => { if (!window.confirm(t('confirmCompleteTask'))) return; void completeTaskTarget(task.id, target.entityId).then(onClose) }}>{t('markDone')}</button> : null}</div>)}</div></section>
      {task.supplies.length > 0 && <section className="action-section"><h3>{t('reportStock')}</h3><div className="task-supplies">{task.supplies.map((snapshot) => { const supply = data!.supplies.find((item) => item.id === snapshot.supplyId); if (!supply || supply.archivedAt) return null; return <div className="task-supply-row" key={snapshot.supplyId}><div><strong>{snapshot.supplyName}</strong><small>{statusLabel(supply.status)}</small></div><div className="mini-stock-grid">{stockStatuses.map((status) => <button key={status} aria-label={statusLabel(status)} className={supply.status === status ? 'selected' : ''} onClick={() => void setSupplyStatus(supply.id, status, task.id).then(onClose)}><span className={`stock-dot stock-${status}`} /></button>)}</div></div> })}</div></section>}
      {task.state === 'scheduled' && <><section className="action-section"><h3>{t('reschedule')}</h3><div className="inline-form"><input type="datetime-local" value={postponeValue} onChange={(event) => setPostponeValue(event.target.value)} /><button className="button secondary" onClick={() => { if (!window.confirm(t('confirmRescheduleTask'))) return; const value = localInputToUtc(postponeValue, timezone); void postponeTask(task.id, value).then((eventId) => { void rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('rescheduled').toLowerCase()}`); onClose() }) }}>{t('reschedule')}</button></div></section><section className="action-section"><h3>{t('reassign')}</h3><div className="inline-form"><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">{t('anyone')}</option>{data!.members.filter((member) => member.status === 'active').map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select><button className="button secondary" onClick={() => { if (!window.confirm(t('confirmReassignTask'))) return; void reassignTask(task.id, assignee || undefined).then((eventId) => { void rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('reassigned').toLowerCase()}`); onClose() }) }}>{t('reassign')}</button></div></section><button className="button danger-outline" onClick={() => { if (!window.confirm(t('confirmSkipTask'))) return; void skipTask(task.id).then((eventId) => { void rememberUndo(task.id, eventId, `${task.actionNameSnapshot} ${t('skipped').toLowerCase()}`); onClose() }) }}>{t('skip')}</button></>}
      <details className="explain-box"><summary>{t('whyThisTask')}</summary><div className="stack compact-text"><p>{task.explanation.schedule}</p><p>{task.explanation.assignment}</p><p>{task.explanation.targetSummary}</p></div></details>
      <section className="action-section"><h3>{t('history')}</h3><div className="timeline">{[...events].reverse().map((event) => <div className="timeline-item" key={event.id}><span>{t(`event_${event.type}` as TranslationKey)}</span><small>{formatTaskDateTime(event.at, locale, timezone)}</small></div>)}</div></section>
    </div></Sheet>
  }
}
