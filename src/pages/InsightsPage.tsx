import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { auditEntries, completionSummary, dailyCompletionTrend, memberWorkload, supplyForecasts } from '../lib/analytics'
import { formatTaskDateTime } from '../lib/date'
import type { TranslationKey } from '../lib/translations'

export function InsightsPage() {
  const { data } = useData()
  const { t, locale } = useI18n()
  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<'all' | 'task' | 'supply'>('all')
  const [actor, setActor] = useState('')
  if (!data) return null

  const summary = completionSummary(data, days)
  const workload = memberWorkload(data, days)
  const trend = dailyCompletionTrend(data, 14)
  const forecasts = supplyForecasts(data)
  const allAudit = auditEntries(data)
  const query = search.trim().toLowerCase()
  const cutoff = Date.now() - days * 86_400_000
  const audit = allAudit.filter((entry) => new Date(entry.at).getTime() >= cutoff)
    .filter((entry) => source === 'all' || entry.source === source)
    .filter((entry) => !actor || entry.actorMemberId === actor)
    .filter((entry) => !query || `${entry.title} ${entry.detail} ${entry.eventType}`.toLowerCase().includes(query))
    .slice(0, 120)
  const maxDaily = Math.max(1, ...trend.map((row) => row.completed + row.skipped))

  function eventLabel(eventType: string) {
    const key = `event_${eventType}` as TranslationKey
    return t(key)
  }

  return <div className="stack page-stack">
    <header className="page-title-row"><div><div className="eyebrow">v1</div><h1>{t('insights')}</h1></div><select className="compact-select" aria-label={t('period')} value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 {t('days')}</option><option value={30}>30 {t('days')}</option><option value={90}>90 {t('days')}</option></select></header>

    <section className="metric-grid" aria-label={t('completionTrends')}>
      <Metric label={t('completionRate')} value={`${summary.completionRate}%`} detail={`${summary.completed}/${summary.due}`} />
      <Metric label={t('onTime')} value={`${summary.onTimeRate}%`} detail={t('completed')} />
      <Metric label={t('stillOpen')} value={String(summary.stillOpen)} detail={t('overdue')} />
      <Metric label={t('skipped')} value={String(summary.skipped)} detail={`${days} ${t('days')}`} />
    </section>

    <section className="card section-card"><div className="section-header"><div><h2>{t('completionTrends')}</h2><p className="muted compact-text">{t('last14Days')}</p></div></div><div className="trend-bars" aria-label={t('completionTrends')}>{trend.map((row) => <div className="trend-day" key={row.date} title={`${row.date}: ${row.completed} ${t('completed')}, ${row.skipped} ${t('skipped')}`}><div className="trend-stack"><span className="trend-completed" style={{ height: `${Math.max(row.completed ? 8 : 0, row.completed / maxDaily * 100)}%` }} /><span className="trend-skipped" style={{ height: `${Math.max(row.skipped ? 5 : 0, row.skipped / maxDaily * 100)}%` }} /></div><small>{row.date.slice(8)}</small></div>)}</div></section>

    <section className="card section-card"><div className="section-header"><div><h2>{t('workload')}</h2><p className="muted compact-text">{t('workloadHint')}</p></div></div><div className="analytics-list">{workload.map((row) => <div className="analytics-row" key={row.memberId}><strong>{row.name}</strong><span>{row.completed} {t('completed')} · {row.assignedDue} {t('assigned')}</span></div>)}</div></section>

    <section className="card section-card"><div className="section-header"><div><h2>{t('supplyOutlook')}</h2><p className="muted compact-text">{t('supplyOutlookHint')}</p></div></div><div className="analytics-list">{forecasts.length === 0 ? <p className="muted compact-text">{t('noSupplies')}</p> : forecasts.map((row) => <div className="analytics-row" key={row.supplyId}><div><strong>{row.name}</strong><small>{t(row.status === 'reserve_only' ? 'reserveOnly' : row.status === 'out_of_stock' ? 'outOfStock' : row.status)}</small></div><span>{row.estimatedLowAt ? `${t('estimatedLow')} ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: data.workspace.timezone }).format(new Date(row.estimatedLowAt))}` : row.recentDrops ? `${row.recentDrops} ${t('recentDrops')}` : t('notEnoughHistory')}</span></div>)}</div></section>

    <section className="card section-card"><div className="section-header"><div><h2>{t('auditExplorer')}</h2><p className="muted compact-text">{t('auditHint')}</p></div></div><div className="audit-filters"><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label={t('source')} value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="all">{t('all')}</option><option value="task">{t('tasks')}</option><option value="supply">{t('supplies')}</option></select><select aria-label={t('people')} value={actor} onChange={(event) => setActor(event.target.value)}><option value="">{t('allPeople')}</option>{data.members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></div><div className="audit-list">{audit.length === 0 ? <p className="muted compact-text">{t('noAuditResults')}</p> : audit.map((entry) => { const member = data.members.find((item) => item.id === entry.actorMemberId); return <article className="audit-row" key={entry.id}><div><strong>{eventLabel(entry.eventType)}</strong><span>{entry.title}</span><small>{member?.displayName ?? '—'} · {formatTaskDateTime(entry.at, locale, data.workspace.timezone)}</small></div>{entry.taskId && <Link className="button secondary small" to={`/task/${entry.taskId}`}>{t('open')}</Link>}</article> })}</div></section>
  </div>

  function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
    return <div className="card metric-card"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
  }
}
