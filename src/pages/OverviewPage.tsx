import { OperationalTasksPage } from './OperationalTasksPage'

/** Phase 7: Overview retains V1 House State and today's actionable tasks only. */
export function OverviewPage() {
  return <OperationalTasksPage view="overview" />
}
