import type { ReactNode } from 'react'
import { ArrowCounterClockwise, CalendarDots, CheckCircle, House, MinusCircle, Sparkle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { useI18n } from '../../contexts/I18nContext'
import {
  type ActivityOutcomeSummary, type CleanlinessTrendPoint, type HistoryEntryV12, type TodayActivitySummary,
} from '../../lib/analytics'
import { addDays, formatTaskDateTime, localDateInZone } from '../../lib/date'
import { outcomeBarShares } from './analysisPresentation'

interface Props {
  days: number
  onDaysChange: (days: number) => void
  today: TodayActivitySummary
  outcomes: ActivityOutcomeSummary
  trend: CleanlinessTrendPoint[]
  historyGroups: [string, HistoryEntryV12[]][]
  timezone: string
  now: Date
}

/** V2 framing only. No scheduling, cleanliness or event semantics live here. */
export function AnalysisDashboard({ days, onDaysChange, today, outcomes, trend, historyGroups, timezone, now }: Props) {
  const { t, locale } = useI18n()
  const shares = outcomeBarShares([outcomes.completed, outcomes.rescheduled, outcomes.skipped])
  const outcomeValues = [
    { type: 'completed', label: t('completed'), value: outcomes.completed, icon: <CheckCircle weight="bold" /> },
    { type: 'rescheduled', label: t('rescheduled'), value: outcomes.rescheduled, icon: <CalendarDots weight="bold" /> },
    { type: 'skipped', label: t('skipped'), value: outcomes.skipped, icon: <MinusCircle weight="bold" /> },
  ] as const

  function dayLabel(date: string) {
    const todayDate = localDateInZone(timezone, now)
    if (date === todayDate) return t('today')
    if (date === addDays(todayDate, -1)) return t('yesterday')
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: timezone }).format(new Date(`${date}T12:00:00Z`))
  }

  return <div className="stack page-stack analysis-page v2-analysis-page">
    <header className="v2-analysis-hero">
      <div className="v2-analysis-hero-copy">
        <span className="eyebrow hc-ui-label">House Care</span>
        <h1 className="hc-display">{t('insights')}</h1>
        <p className="muted compact-text">{t('analysisHint')}</p>
      </div>
      <div className="v2-analysis-hero-art" aria-hidden="true"><SvgCharacter id="house" expression="proud" pose="thumbs-up" decorative misregistration={false} /></div>
      <div className="v2-analysis-period" role="group" aria-label={t('period')}>
        {[7, 30, 90].map((period) => <button type="button" key={period} aria-pressed={period === days} className={period === days ? 'selected' : ''} onClick={() => onDaysChange(period)}>{period} {t('days')}</button>)}
      </div>
    </header>

    <section className="analysis-section" aria-labelledby="v2-today-outcomes">
      <div className="analysis-heading"><div><h2 id="v2-today-outcomes" className="hc-card-title">{t('today')}</h2></div></div>
      <div className="v2-analysis-today-grid">
        <OutcomeTile variant="completed" icon={<CheckCircle weight="duotone" />} value={today.completed} label={t('completed')} />
        <OutcomeTile variant="skipped" icon={<MinusCircle weight="duotone" />} value={today.skipped} label={t('skipped')} />
        <OutcomeTile variant="rescheduled" icon={<CalendarDots weight="duotone" />} value={today.rescheduled} label={t('rescheduled')} />
        <OutcomeTile variant="rooms" icon={<House weight="duotone" />} value={today.roomsMaintained} label={t('roomsMaintained')} />
      </div>
      {today.everythingHandled && <p className="v2-analysis-note"><Sparkle aria-hidden="true" />{t('everythingHandledToday')}</p>}
      {!today.everythingHandled && today.plannedCount === 0 && <p className="v2-analysis-note">{t('nothingPlannedToday')}</p>}
    </section>

    <section className="analysis-section" aria-labelledby="v2-cleanliness-trend">
      <div className="analysis-heading"><div><h2 id="v2-cleanliness-trend" className="hc-card-title">{t('cleanlinessTrend')}</h2><p className="muted compact-text">{t('cleanlinessEstimateHint')}</p></div></div>
      <div className="cleanliness-chart-grid v2-analysis-charts">
        <CleanlinessChart label={t('regularCleanliness')} notTrackedLabel={t('notTracked')} points={trend} channel="regular" />
        <CleanlinessChart label={t('deepCleanliness')} notTrackedLabel={t('notTracked')} points={trend} channel="deep" />
      </div>
    </section>

    <section className="analysis-section" aria-labelledby="v2-activity-outcomes">
      <div className="analysis-heading"><div><h2 id="v2-activity-outcomes" className="hc-card-title">{t('activityOutcomes')}</h2><p className="muted compact-text">{days} {t('days')}</p></div></div>
      <div className="card v2-analysis-outcomes">
        <div className="v2-outcome-bar" aria-hidden="true">{outcomeValues.map((row, index) => <span key={row.type} className={`v2-outcome-segment ${row.type}`} style={{ width: `${shares[index]}%` }} />)}</div>
        <div className="v2-analysis-outcome-grid">{outcomeValues.map((row) => <OutcomeLegend key={row.type} {...row} />)}</div>
      </div>
    </section>

    <section className="analysis-section history-analysis-section" aria-labelledby="v2-analysis-history">
      <div className="analysis-heading"><div><h2 id="v2-analysis-history" className="hc-card-title">{t('history')}</h2><p className="muted compact-text">{t('historyTimelineHint')}</p></div></div>
      {historyGroups.length === 0 ? <div className="quiet-state">{t('noHistoryYet')}</div> : <div className="history-groups v2-analysis-history">
        {historyGroups.map(([date, entries]) => <section className="history-day" key={date}>
          <h3>{dayLabel(date)}</h3>
          <div className="history-timeline">{entries.map((entry) => <HistoryRow key={entry.id} entry={entry} locale={locale} timezone={timezone} />)}</div>
        </section>)}
      </div>}
    </section>
  </div>
}

function OutcomeTile({ variant, icon, value, label }: { variant: string; icon: ReactNode; value: number; label: string }) {
  return <div className={`card v2-analysis-outcome-tile ${variant}`}>
    <span className="v2-analysis-tile-icon" aria-hidden="true">{icon}</span>
    <strong className="hc-tabular-numerals">{value}</strong><span>{label}</span>
  </div>
}

function OutcomeLegend({ type, icon, label, value }: { type: string; icon: ReactNode; label: string; value: number }) {
  return <div className={`v2-analysis-legend ${type}`}>
    <span aria-hidden="true">{icon}</span><span className="v2-analysis-legend-label">{label}</span><strong className="hc-tabular-numerals">{value}</strong>
  </div>
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
  return <article className={`card cleanliness-chart v2-analysis-chart ${channel}`}>
    <div className="cleanliness-chart-heading">
      <div><span>{label}</span><strong className="hc-tabular-numerals">{current == null ? '—' : `${Math.round(current)}%`}</strong></div>
      <span className="v2-analysis-chart-mark" aria-hidden="true"><SvgCharacter id={channel === 'regular' ? 'house' : 'scrub-brush'} expression={channel === 'regular' ? 'proud' : 'focused'} decorative pose="thumbs-up" misregistration={false} /></span>
    </div>
    <small className="v2-analysis-scale">{tracked ? '0–100%' : notTrackedLabel}</small>
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

function HistoryRow({ entry, locale, timezone }: { entry: HistoryEntryV12; locale: string; timezone: string }) {
  const { t } = useI18n()
  const icon = entry.type === 'completed' ? <CheckCircle weight="fill" /> : entry.type === 'skipped' ? <MinusCircle /> : entry.type === 'rescheduled' ? <CalendarDots /> : <ArrowCounterClockwise />
  const actionLabel = entry.type === 'completed' ? t('completed') : entry.type === 'skipped' ? t('skipped') : entry.type === 'rescheduled' ? t('rescheduled') : t('reopened')
  return <details className={`history-event v2-analysis-history-event ${entry.type}`}>
    <summary>
      <span className="history-event-icon" aria-hidden="true">{icon}</span>
      <span className="history-event-main"><strong>{entry.activity}</strong><small>{entry.room ? `${entry.room} · ` : ''}{entry.routine}</small></span>
      <span className={`v2-analysis-event-type ${entry.type}`}>{actionLabel}</span>
      <time dateTime={entry.at}>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(entry.at))}</time>
    </summary>
    <div className="history-event-details">
      <Detail label={t('action')} value={actionLabel} />
      {entry.room && <Detail label={t('room')} value={entry.room} />}
      <Detail label={t('routine')} value={entry.routine} />
      {entry.actor && <Detail label={t('people')} value={entry.actor} />}
      {entry.previousDueAt && <Detail label={t('previousDue')} value={formatTaskDateTime(entry.previousDueAt, locale, timezone)} />}
      {entry.newDueAt && <Detail label={t('newDue')} value={formatTaskDateTime(entry.newDueAt, locale, timezone)} />}
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
