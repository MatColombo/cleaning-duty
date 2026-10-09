import { Link, Navigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { taskDeepLinkDestination } from '../lib/timelineNavigation'

/** Stable push/notification route, resolved using the exact occurrence ID. */
export function TaskRouteResolver() {
  const { taskId } = useParams<{ taskId: string }>()
  const { data } = useData()
  const { t } = useI18n()
  if (!data) return null
  const destination = taskDeepLinkDestination(data, taskId ?? '')
  if (destination) return <Navigate to={destination.path} replace />

  return <section className="card stack task-deeplink-unavailable" role="status">
    <h1>{t('taskUnavailable')}</h1>
    <p className="muted">{t('taskUnavailableHint')}</p>
    <div className="row wrap"><Link className="button primary" to="/">{t('overview')}</Link><Link className="button secondary" to="/timeline">{t('timeline')}</Link></div>
  </section>
}
