import { useEffect } from 'react'
import { OperationalTasksPage } from './OperationalTasksPage'
import { startupMark } from '../lib/startupTelemetry'

/** Phase 7: Overview retains V1 House State and today's actionable tasks only. */
export function OverviewPage() {
  useEffect(() => {
    // First frame containing the real Overview, rather than boot artwork.
    const id = requestAnimationFrame(() => startupMark('overview-paint'))
    return () => cancelAnimationFrame(id)
  }, [])
  return <OperationalTasksPage view="overview" />
}
