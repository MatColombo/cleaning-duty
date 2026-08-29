import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { dateTimeLocalValue, formatTaskDateTime, formatTaskTime, localDateInZone, localInputToUtc } from '../lib/date'
import type { StockStatus, TaskEvent, TaskOccurrence } from '../types/domain'
import type { TranslationKey } from '../lib/translations'

const stockStatuses: StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']

export function TodayPage() {
  const { data, currentMember, completeTask, completeTaskTarget, skipTask, postponeTask, reassignTask, setSupplyStatus } = useData()
  const { t, locale } = useI18n()
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(taskId ?? null)
  useEffect(() => { if (taskId) setSelectedId(taskId) }, [taskId])
  if (!data) return null

  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone)
  const selected = data.tasks.find((task) => task.id === selectedId)
  const relevant = useMemo(() => data.tasks
    .filter((task) => {
      if (task.state === 'cancelled') return false
      const localDate = localDateInZone(timezone, new Date(task.dueAt))
      return localDate === today || (task.state === 'scheduled' && new Date(task.dueAt).getTime() < Date.now())
    })
    .sort((a, b) => {
      const aMine = a.assigneeMemberId === currentMember?.id ? 0 : 1
      const bMine = b.assigneeMemberId === currentMember?.id ? 0 : 1
      return aMine - bMine || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    }), [data.tasks, timezone, today, currentMember?.id])

  const pending = relevant.filter((task) => task.state === 'scheduled')
  const done = relevant.filter((task) => task.state === 'completed' || task.state === 'skipped')

  return <div className="stack page-stack">
    <header className="page-title-row">
      <div><div className="eyebrow">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(new Date())}</div><h1>{t('dueToday')}</h1></div>
      <span className="count-pill">{pending.length}</span>
    </header>

    {pending.length === 0 && <div className="empty-state">{t('noTasks')}</div>}
    <div className="task-list">
      {pending.map((task) => <TaskCard key={task.id} task={task} onComplete={() => void completeTask(task.id)} onMore={() => setSelectedId(task.id)} />)}
    </div>

    {done.length > 0 && <details className="done-section"><summary>{t('completed')} · {done.length}</summary><div className="task-list compact">{done.map((task) => <TaskCard key={task.id} task={task} onMore={() => setSelectedId(task.id)} />)}</div></details>}

    {selected && <TaskSheet task={selected} events={data.taskEvents.filter((event) => event.taskId === selected.id)} onClose={() => { setSelectedId(null); if (taskId) navigate('/', { replace: true }) }} onSkip={async () => { await skipTask(selected.id); setSelectedId(null) }} onPostpone={async (value) => {
      const collision = data.tasks.find((task) => task.id !== selected.id && task.routineId === selected.routineId && task.state === 'scheduled' && Math.abs(new Date(task.dueAt).getTime() - new Date(value).getTime()) < 60_000)
      if (collision && !confirm(locale === 'it' ? 'Esiste già un’attività della stessa routine a questo orario. Tenerle entrambe?' : 'Another task from this routine is already due at this time. Keep both?')) return
      await postponeTask(selected.id, value); setSelectedId(null)
    }} onReassign={async (memberId) => { await reassignTask(selected.id, memberId); setSelectedId(null) }} onCompleteTarget={async (entityId) => { await completeTaskTarget(selected.id, entityId) }} />}
  </div>

  function statusLabel(status: StockStatus) {
    if (status === 'available') return t('available')
    if (status === 'low') return t('low')
    if (status === 'reserve_only') return t('reserveOnly')
    return t('outOfStock')
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
        <div className="task-time">{formatTaskTime(task.dueAt, locale, timezone)}{overdue && <span className="status danger">{t('overdue')}</span>}{supplyAttention && <span className="status warn">{t('stock')}</span>}</div>
        <h2>{task.actionNameSnapshot} · {task.targets.map((target) => target.entityName).join(', ')}</h2>
        <div className="task-meta"><span className={`care-level-tag ${task.careLevel === 'deep' ? 'deep' : 'routine'}`}>{task.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span> · {assignee?.displayName ?? t('anyone')}{completedTargets > 0 && task.state === 'scheduled' ? ` · ${completedTargets}/${task.targets.length} ${t('targetsDone')}` : ''}</div>
      </div>
      <div className="task-actions">
        {onComplete && <button className="button primary complete-button" onClick={onComplete}>{t('complete')}</button>}
        <button className="button secondary square" aria-label={t('more')} onClick={onMore}>•••</button>
      </div>
    </article>
  }

  function TaskSheet({ task, events, onClose, onSkip, onPostpone, onReassign, onCompleteTarget }: { task: TaskOccurrence; events: TaskEvent[]; onClose: () => void; onSkip: () => Promise<void>; onPostpone: (dueAt: string) => Promise<void>; onReassign: (memberId?: string) => Promise<void>; onCompleteTarget: (entityId: string) => Promise<void> }) {
    const [postponeValue, setPostponeValue] = useState(dateTimeLocalValue(task.dueAt, timezone))
    const [assignee, setAssignee] = useState(task.assigneeMemberId ?? '')
    return <Sheet title={task.routineNameSnapshot} onClose={onClose}>
      <div className="stack">
        <div className="summary-block"><strong>{task.actionNameSnapshot}</strong><span className={`care-level-tag ${task.careLevel === 'deep' ? 'deep' : 'routine'}`}>{task.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span><span>{task.targets.map((target) => `${target.entityName} · ${target.entityTypeName}`).join(', ')}</span><span>{formatTaskDateTime(task.dueAt, locale, timezone)}</span></div>
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
