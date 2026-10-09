import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { AnalysisDashboard } from '../components/analysis/AnalysisDashboard'
import { activityOutcomeSummary, cleanlinessTrend, historyEntriesV12, todayActivitySummary, type HistoryEntryV12 } from '../lib/analytics'
import { localDateInZone } from '../lib/date'

/** Analytics stays in the existing canonical service; this page orchestrates data only. */
export function InsightsPage() {
  const { data } = useData()
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

  return <AnalysisDashboard
    days={days} onDaysChange={setDays} today={today} outcomes={outcomes} trend={trend}
    historyGroups={[...historyGroups.entries()]} timezone={data.workspace.timezone} now={now}
  />
}
