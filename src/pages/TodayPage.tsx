import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { dateTimeLocalValue, formatTaskDateTime, formatTaskTime, localDateInZone, localInputToUtc } from '../lib/date'
import type { StockStatus, TaskEvent, TaskOccurrence } from '../types/domain'
import type { TranslationKey } from '../lib/translations'

const stockStatuses: StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
type TodayView = 'todo' | 'completed' | 'all'
type TodayScope = 'mine' | 'household'

function taskRank(task: TaskOccurrence): number {
  if (task.state === 'completed') return 4
  if (task.state === 'skipped') return 3
  if (task.state === 'scheduled') return 2
  return 1
}

function dedupeVisibleTasks(tasks: TaskOccurrence[]): TaskOccurrence[] {
  const byId = new Map<string, TaskOccurrence>()
  for (const task of tasks) {
    const previous = byId.get(task.id)
    if (!previous || task.version > previous.version || (task.version === previous.version && taskRank(task) > taskRank(previous))) byId.set(task.id, task)
  }

  const byOccurrence = new Map<string, TaskOccurrence>()
  for (const task of byId.values()) {
    const key = `${task.routineId}:${task.routineRevision}:${task.originalDueAt}`
    const previous = byOccurrence.get(key)
    if (!previous || task.version > previous.version || (task.version === previous.version && taskRank(task) > taskRank(previous))) byOccurrence.set(key, task)
  }
  return [...byOccurrence.values()]
}

export function TodayPage() {
  const { data, currentMember, completeTask, completeTaskTarget, skipTask, postponeTask, reassignTask, setSupplyStatus } = useData()
  const { t, locale } = useI18n()
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(taskId ?? null)
  const [view, setView] = useState<TodayView>('todo')
  const [scope, setScope] = useState<TodayScope>('mine')
  useEffect(() => { if (taskId) setSelectedId(taskId) }, [taskId])
  if (!data) return null

  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone)
  const now = Date.now()
  const selected = data.tasks.find((task) => task.id === selectedId)
  const activePeople = data.members.filter((member) => member.status === 'active')

  const terminalByTask = useMemo(() => {
    const result = new Map<string, { at: string; type: 'COMPLETED' | 'SKIPPED' }>()
    for (const event of data.taskEvents) {
      if (event.type !== 'COMPLETED' && event.type !== 'SKIPPED') continue
      const previous = result.get(event.taskId)
      if (!previous || new Date(event.at).getTime() > new Date(previous.at).getTime()) result.set(event.taskId, { at: event.at, type: event.type })
    }
    return result
  }, [data.taskEvents])

  const scopedTasks = useMemo(() => {
    const canonical = dedupeVisibleTasks(data.tasks)
      .map((task) => {
        if (task.state !== 'scheduled') return task
        const terminal = terminalByTask.get(task.id)
        if (terminal) return { ...task, state: terminal.type === 'COMPLETED' ? 'completed' as const : 'skipped' as const }
        if (task.targets.length > 0 && task.targets.every((target) => Boolean(target.completedAt))) return { ...task, state: 'completed' as const }
        return task
      })
      .filter((task) => task.state !== 'cancelled')
    if (scope === 'household' || !currentMember) return canonical
    return canonical.filter((task) => !task.assigneeMemberId || task.assigneeMemberId === currentMember.id)
  }, [data.tasks, currentMember, scope, terminalByTask])

  const dueNow = useMemo(() => scopedTasks
    .filter((task) => task.state === 'scheduled' && new Date(task.dueAt).getTime() <= now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()), [scopedTasks, now])

  const laterToday = useMemo(() => scopedTasks
    .filter((task) => task.state === 'scheduled' && new Date(task.dueAt).getTime() > now && localDateInZone(timezone, new Date(task.dueAt)) === today)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()), [scopedTasks, now, timezone, today])

  const completedToday = useMemo(() => scopedTasks
    .filter((task) => {
      if (task.state !== 'completed' && task.state !== 'skipped') return false
      const terminalAt = terminalByTask.get(task.id)?.at
      const reference = terminalAt ?? task.dueAt
      return localDateInZone(timezone, new Date(reference)) === today
    })
    .sort((a, b) => {
      const aAt = terminalByTask.get(a.id)?.at ?? a.dueAt
      const bAt = terminalByTask.get(b.id)?.at ?? b.dueAt
      return new Date(bAt).getTime() - new Date(aAt).getTime()
    }), [scopedTasks, terminalByTask, timezone, today])

  const todoCount = dueNow.length + laterToday.length
  const visibleCount = view === 'todo' ? todoCount : view === 'completed' ? completedToday.length : todoCount + completedToday.length
  const closeSelected = () => { setSelectedId(null); if (taskId) navigate('/', { replace: true }) }

  return <div className="stack page-stack">
    <header className="page-title-row">
      <div><div className="eyebrow">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(new Date())}</div><h1>{t('dueToday')}</h1></div>
      <span className="count-pill">{visibleCount}</span>
    </header>

    <div className="today-filters" aria-label={t('filters')}>
      <div className="segmented today-view-toggle">
        <button type="button" className={view === 'todo' ? 'selected' : ''} onClick={() => setView('todo')}>{t('toDo')} · {todoCount}</button>
        <button type="button" className={view === 'completed' ? 'selected' : ''} onClick={() => setView('completed')}>{t('completed')} · {completedToday.length}</button>
        <button type="button" className={view === 'all' ? 'selected' : ''} onClick={() => setView('all')}>{t('all')}</button>
      </div>
      {activePeople.length > 1 && <div className="segmented two today-scope-toggle">
        <button type="button" className={scope === 'mine' ? 'selected' : ''} onClick={() => setScope('mine')}>{t('myTasks')}</button>
        <button type="button" className={scope === 'household' ? 'selected' : ''} onClick={() => setScope('household')}>{t('householdTasks')}</button>
      </div>}
    </div>

    {(view === 'todo' || view === 'all') && <>
      {dueNow.length > 0 && <TaskSection title={t('dueNow')} tasks={dueNow} />}
      {laterToday.length > 0 && <TaskSection title={t('laterToday')} tasks={laterToday} />}
      {todoCount === 0 && view === 'todo' && <div className="empty-state">{t('noTasks')}</div>}
    </>}

    {(view === 'completed' || view === 'all') && <>
      {completedToday.length > 0 && <TaskSection title={t('completedToday')} tasks={completedToday} compact />}
      {completedToday.length === 0 && view === 'completed' && <div className="empty-state">{t('noCompletedToday')}</div>}
    </>}

    {view === 'all' && todoCount === 0 && completedToday.length === 0 && <div className="empty-state">{t('noTasks')}</div>}

    {selected && <TaskSheet
      task={selected}
      events={data.taskEvents.filter((event) => event.taskId === selected.id)}
      onClose={closeSelected}
      onComplete={async () => { await completeTask(selected.id); closeSelected() }}
      onSkip={async () => { await skipTask(selected.id); closeSelected() }}
      onPostpone={async (value) => {
        const collision = data.tasks.find((task) => task.id !== selected.id && task.routineId === selected.routineId && task.state === 'scheduled' && Math.abs(new Date(task.dueAt).getTime() - new Date(value).getTime()) < 60_000)
        if (collision && !confirm(locale === 'it' ? 'Esiste già un’attività della stessa routine a questo orario. Tenerle entrambe?' : 'Another task from this routine is already due at this time. Keep both?')) return
        await postponeTask(selected.id, value); closeSelected()
      }}
      onReassign={async (memberId) => { await reassignTask(selected.id, memberId); closeSelected() }}
      onCompleteTarget={async (entityId) => { await completeTaskTarget(selected.id, entityId) }}
    />}
  </div>

  function statusLabel(status: StockStatus) {
    if (status === 'available') return t('available')
    if (status === 'low') return t('low')
    if (status === 'reserve_only') return t('reserveOnly')
    return t('outOfStock')
  }

  function TaskSection({ title, tasks, compact = false }: { title: string; tasks: TaskOccurrence[]; compact?: boolean }) {
    return <section className="today-section">
      <div className="today-section-heading"><h2>{title}</h2><span>{tasks.length}</span></div>
      <div className={compact ? 'task-list compact' : 'task-list'}>
        {tasks.map((task) => <TaskCard
          key={task.id}
          task={task}
          onComplete={task.state === 'scheduled' ? () => void completeTask(task.id) : undefined}
          onMore={() => setSelectedId(task.id)}
        />)}
      </div>
    </section>
  }

  function TaskCard({ task, onComplete, onMore }: { task: TaskOccurrence; onComplete?: () => void; onMore: () => void }) {
    const assignee = data!.members.find((member) => member.id === task.assigneeMemberId)
    const overdue = task.state === 'scheduled' && new Date(task.dueAt).getTime() < Date.now()
    const completedTargets = task.targets.filter((target) => target.completedAt).length
    const supplyAttention = task.supplies.some((snapshot) => {
      const supply = data!.supplies.find((item) => item.id === snapshot.supplyId)
      return supply?.status === 'low' || supply?.status === 'reserve_only' || supply?.status === 'out_of_stock'
    })
    return <article className={`task-card ${task.state !== 'scheduled' ? 'task-done' : ''}`}>
      <div className="task-main">
        <div className="task-time">
          {formatTaskTime(task.dueAt, locale, timezone)}
          {overdue && <span className="status danger">{t('overdue')}</span>}
          {task.state === 'completed' && <span className="status">{t('completed')}</span>}
          {task.state === 'skipped' && <span className="status">{t('skipped')}</span>}
          {supplyAttention && <span className="status warn">{t('stock')}</span>}
        </div>
        <h2>{task.routineNameSnapshot}</h2>
        <div className="task-description"><strong>{task.actionNameSnapshot}</strong><span>· {task.targets.map((target) => target.entityName).join(', ')}</span></div>
        <div className="task-meta"><span className={`care-level-tag ${task.careLevel === 'deep' ? 'deep' : 'routine'}`}>{task.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span> · {assignee?.displayName ?? t('anyone')}{completedTargets > 0 && task.state === 'scheduled' ? ` · ${completedTargets}/${task.targets.length} ${t('targetsDone')}` : ''}</div>
      </div>
      <div className="task-actions">
        {onComplete && <button className="button primary complete-button" onClick={onComplete}>{t('complete')}</button>}
        <button className="button secondary square" aria-label={t('more')} onClick={onMore}>•••</button>
      </div>
    </article>
  }

  function TaskSheet({ task, events, onClose, onComplete, onSkip, onPostpone, onReassign, onCompleteTarget }: { task: TaskOccurrence; events: TaskEvent[]; onClose: () => void; onComplete: () => Promise<void>; onSkip: () => Promise<void>; onPostpone: (dueAt: string) => Promise<void>; onReassign: (memberId?: string) => Promise<void>; onCompleteTarget: (entityId: string) => Promise<void> }) {
    const [postponeValue, setPostponeValue] = useState(dateTimeLocalValue(task.dueAt, timezone))
    const [assignee, setAssignee] = useState(task.assigneeMemberId ?? '')
    return <Sheet title={t('taskDetails')} onClose={onClose}>
      <div className="stack">
        <div className="summary-block">
          <span className="eyebrow">{t('routine')}</span>
          <strong>{task.routineNameSnapshot}</strong>
          <span>{task.actionNameSnapshot}</span>
          <span className={`care-level-tag ${task.careLevel === 'deep' ? 'deep' : 'routine'}`}>{task.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span>
          <span>{task.targets.map((target) => `${target.entityName} · ${target.entityTypeName}`).join(', ')}</span>
          <span>{formatTaskDateTime(task.dueAt, locale, timezone)}</span>
          {task.state !== 'scheduled' && <span className="status">{task.state === 'completed' ? t('completed') : task.state === 'skipped' ? t('skipped') : task.state}</span>}
        </div>
        {task.state === 'scheduled' && <button className="button primary" onClick={() => void onComplete()}>{t('complete')}</button>}
        <section className="action-section"><div className="section-header"><h3>{t('taskTargets')}</h3><small>{task.targets.filter((target) => target.completedAt).length}/{task.targets.length}</small></div><div className="target-progress-list">{task.targets.map((target) => <div className={target.completedAt ? 'target-progress-row done' : 'target-progress-row'} key={target.entityId}><div><strong>{target.entityName}</strong><small>{target.entityTypeName}</small></div>{target.completedAt ? <span className="status">{t('completed')}</span> : task.state === 'scheduled' ? <button className="button secondary small" onClick={() => void onCompleteTarget(target.entityId)}>{t('markDone')}</button> : null}</div>)}</div></section>
        <details className="explain-box"><summary>{t('whyThisTask')}</summary><div className="stack compact-text"><div><strong>{t('schedule')}</strong><p>{task.explanation.schedule}</p></div><div><strong>{t('assignment')}</strong><p>{task.explanation.assignment}</p></div><div><strong>{t('targets')}</strong><p>{task.explanation.targetSummary}</p>{task.targets.map((target) => <p key={target.entityId}><strong>{target.entityName}:</strong> {target.matchReasons.join(' · ')}</p>)}</div></div></details>
        {task.supplies.length > 0 && <section className="action-section"><h3>{t('reportStock')}</h3><div className="task-supplies">{task.supplies.map((snapshot) => {
          const supply = data!.supplies.find((item) => item.id === snapshot.supplyId)
          if (!supply || supply.archivedAt) return null
          return <div className="task-supply-row" key={snapshot.supplyId}><div><strong>{snapshot.supplyName}</strong><small>{statusLabel(supply.status)}</small></div><div className="mini-stock-grid">{stockStatuses.map((status) => <button key={status} title={statusLabel(status)} aria-label={statusLabel(status)} className={supply.status === status ? 'selected' : ''} onClick={() => void setSupplyStatus(supply.id, status, task.id)}><span className={`stock-dot stock-${status}`} /></button>)}</div></div>
        })}</div></section>}
        {task.state === 'scheduled' && <>
          <section className="action-section"><h3>{t('postpone')}</h3><div className="inline-form"><input type="datetime-local" value={postponeValue} onChange={(e) => setPostponeValue(e.target.value)} /><button className="button secondary" onClick={() => void onPostpone(localInputToUtc(postponeValue, timezone))}>{t('postpone')}</button></div></section>
          <section className="action-section"><h3>{t('reassign')}</h3><div className="inline-form"><select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">{t('anyone')}</option>{data!.members.filter((member) => member.status === 'active').map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select><button className="button secondary" onClick={() => void onReassign(assignee || undefined)}>{t('reassign')}</button></div></section>
          <button className="button danger-outline" onClick={() => void onSkip()}>{t('skip')}</button>
        </>}
        <section className="action-section"><h3>{t('history')}</h3><div className="timeline">{[...events].reverse().map((event) => <div className="timeline-item" key={event.id}><span>{t(`event_${event.type}` as TranslationKey)}</span><small>{formatTaskDateTime(event.at, locale, timezone)}</small></div>)}</div></section>
      </div>
    </Sheet>
  }
}
