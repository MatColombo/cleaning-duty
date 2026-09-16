import { CleanlinessMood } from '../components/CleanlinessMood'
import { useState, type ReactNode } from 'react'
import { ArrowCounterClockwise, CalendarDots, CheckCircle, MinusCircle, Sparkle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Illustration } from '../components/Illustration'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { activityOutcomeSummary, cleanlinessTrend, historyEntriesV12, todayActivitySummary, type CleanlinessTrendPoint, type HistoryEntryV12 } from '../lib/analytics'
import { addDays, formatTaskDateTime, localDateInZone } from '../lib/date'

export function InsightsPage() {
  const { data } = useData()
  const { t, locale } = useI18n()
  const [days, setDays] = useState(30)
  if (!data) return null

  const now = new Date()
  const today = todayActivitySummary(data, now)
  const outcomes = activityOutcomeSummary(data, days, now)
  const trend = cleanlinessTrend(data, days, now)
  const history = historyEntriesV12(data, Math.max(days, 30), now)
  const historyGroups = new Map<string, HistoryEntryV12[]>()
  for (const entry of history) {
    const day = localDateInZone(data.workspace.timezone, new Date(entry.at))
    const rows = historyGroups.get(day) ?? []
    rows.push(entry)
    historyGroups.set(day, rows)
  }
  const groupedHistory = [...historyGroups.entries()]

  return <div className="stack page-stack analysis-page">
    <header className="page-title-row analysis-hero">
      <div><div className="eyebrow">v1.2</div><h1>{t('insights')}</h1><p className="muted compact-text">{t('analysisHint')}</p></div>
      <select className="compact-select" aria-label={t('period')} value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 {t('days')}</option><option value={30}>30 {t('days')}</option><option value={90}>90 {t('days')}</option></select>
    </header>

    <section className={`card section-card today-analysis-card${today.everythingHandled ? ' handled' : ''}`}>
      <div className="today-analysis-copy">
        <div className="eyebrow">{t('today')}</div>
        <h2>{today.completed} {t('completed').toLowerCase()} · {today.skipped} {t('skipped').toLowerCase()} · {today.rescheduled} {t('rescheduled').toLowerCase()}</h2>
        <p className="muted compact-text">{today.roomsMaintained} {t('roomsMaintained')}</p>
        {today.everythingHandled && <div className="handled-message"><Sparkle weight="duotone" aria-hidden="true" /><strong>{t('everythingHandledToday')}</strong></div>}
        {!today.everythingHandled && today.plannedCount === 0 && <p className="muted compact-text">{t('nothingPlannedToday')}</p>}
      </div>
      {today.everythingHandled && <Illustration id="allDone" className="today-analysis-illustration" />}
    </section>

    <section className="analysis-section">
      <div className="analysis-heading"><div><h2>{t('cleanlinessTrend')}</h2><p className="muted compact-text">{t('cleanlinessEstimateHint')}</p></div></div>
      <div className="cleanliness-chart-grid">
        <CleanlinessChart label={t('regularCleanliness')} notTrackedLabel={t('notTracked')} points={trend} channel="regular" />
        <CleanlinessChart label={t('deepCleanliness')} notTrackedLabel={t('notTracked')} points={trend} channel="deep" />
      </div>
    </section>

    <section className="analysis-section">
      <div className="analysis-heading"><div><h2>{t('activityOutcomes')}</h2><p className="muted compact-text">{days} {t('days')}</p></div></div>
      <div className="outcome-grid">
        <Outcome icon={<CheckCircle weight="duotone" />} label={t('completed')} value={outcomes.completed} />
        <Outcome icon={<MinusCircle weight="duotone" />} label={t('skipped')} value={outcomes.skipped} />
        <Outcome icon={<CalendarDots weight="duotone" />} label={t('rescheduled')} value={outcomes.rescheduled} />
      </div>
    </section>

    <section className="analysis-section history-analysis-section">
      <div className="analysis-heading"><div><h2>{t('history')}</h2><p className="muted compact-text">{t('historyTimelineHint')}</p></div></div>
      {groupedHistory.length === 0 ? <div className="quiet-state">{t('noHistoryYet')}</div> : <div className="history-groups">
        {groupedHistory.map(([date, entries]) => <section className="history-day" key={date}><h3>{dayLabel(date)}</h3><div className="history-timeline">{entries.map((entry) => <HistoryRow key={entry.id} entry={entry} />)}</div></section>)}
      </div>}
    </section>
  </div>

  function dayLabel(date: string) {
    const todayDate = localDateInZone(data!.workspace.timezone, now)
    if (date === todayDate) return t('today')
    if (date === addDays(todayDate, -1)) return t('yesterday')
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: data!.workspace.timezone }).format(new Date(`${date}T12:00:00Z`))
  }

  function HistoryRow({ entry }: { entry: HistoryEntryV12 }) {
    const icon = entry.type === 'completed' ? <CheckCircle weight="fill" /> : entry.type === 'skipped' ? <MinusCircle /> : entry.type === 'rescheduled' ? <CalendarDots /> : <ArrowCounterClockwise />
    const actionLabel = entry.type === 'completed' ? t('completed') : entry.type === 'skipped' ? t('skipped') : entry.type === 'rescheduled' ? t('rescheduled') : t('reopened')
    return <details className={`history-event ${entry.type}`}>
      <summary>
        <span className="history-event-icon" aria-hidden="true">{icon}</span>
        <span className="history-event-main"><strong>{entry.activity}</strong><small>{entry.room ? `${entry.room} · ` : ''}{entry.routine}</small></span>
        <time>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: data!.workspace.timezone }).format(new Date(entry.at))}</time>
      </summary>
      <div className="history-event-details">
        <Detail label={t('action')} value={actionLabel} />
        {entry.room && <Detail label={t('room')} value={entry.room} />}
        <Detail label={t('routine')} value={entry.routine} />
        {entry.actor && <Detail label={t('people')} value={entry.actor} />}
        {entry.previousDueAt && <Detail label={t('previousDue')} value={formatTaskDateTime(entry.previousDueAt, locale, data!.workspace.timezone)} />}
        {entry.newDueAt && <Detail label={t('newDue')} value={formatTaskDateTime(entry.newDueAt, locale, data!.workspace.timezone)} />}
        {entry.health.map((health, index) => <div className="history-health-detail" key={`${health.itemName}:${health.channel}:${index}`}>
          <div><strong>{health.itemName}</strong><small>{health.channel === 'regular' ? t('regularCleanliness') : t('deepCleanliness')}</small></div>
          <div className="history-health-values"><span>{t('refreshTo')} {Math.round(health.refreshLevelPctSnapshot)}%</span><span>{Math.round(health.cleanlinessBeforePct)}% → {Math.round(health.cleanlinessAfterPct)}%</span>{!health.healthRefreshApplied && <span>{t('refreshNoImpact')}</span>}</div>
        </div>)}
        <Link className="text-link" to={`/task/${entry.taskId}`}>{t('open')} →</Link>
      </div>
    </details>
  }

  function Detail({ label, value }: { label: string; value: string }) {
    return <div className="history-detail-row"><span>{label}</span><strong>{value}</strong></div>
  }

  function Outcome({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return <div className="outcome-card card"><span className="outcome-icon" aria-hidden="true">{icon}</span><strong>{value}</strong><small>{label}</small></div>
  }
}

function CleanlinessChart({ label, notTrackedLabel, points, channel }: { label: string; notTrackedLabel: string; points: CleanlinessTrendPoint[]; channel: 'regular' | 'deep' }) {
  const values = points.map((point) => point[channel])
  const tracked = values.some((value) => value != null)
  const width = 520
  const height = 150
  const padX = 8
  const padY = 12
  const coordinates = points.flatMap((point, index) => {
    const value = point[channel]
    if (value == null) return []
    const x = points.length <= 1 ? width / 2 : padX + (index / (points.length - 1)) * (width - padX * 2)
    const y = padY + ((100 - value) / 100) * (height - padY * 2)
    return [{ x, y, value, date: point.date }]
  })
  const path = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const current = [...values].reverse().find((value) => value != null)
  return <article className={`card cleanliness-chart ${channel}`}>
    <div className="cleanliness-chart-heading"><div><span>{label}</span><strong><CleanlinessMood score={current} /> {current == null ? '—' : `${Math.round(current)}%`}</strong></div><small>{tracked ? '0–100%' : notTrackedLabel}</small></div>
    {tracked ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${Math.round(current ?? 0)}%`} preserveAspectRatio="none">
      <line x1="0" x2={width} y1={padY} y2={padY} className="chart-grid-line" />
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="chart-grid-line" />
      <line x1="0" x2={width} y1={height - padY} y2={height - padY} className="chart-grid-line" />
      <polyline points={path} className="cleanliness-line" vectorEffect="non-scaling-stroke" />
      {coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.8" className="cleanliness-point"><title>{point.date}: {point.value.toFixed(1)}%</title></circle>)}
    </svg> : <div className="chart-empty">—</div>}
    {points.length > 1 && <div className="chart-axis"><span>{points[0].date.slice(5)}</span><span>{points[points.length - 1].date.slice(5)}</span></div>}
  </article>
}
