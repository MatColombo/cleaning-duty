import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Keeps workspace choice and sync telemetry independent of navigation presentation. */
export function AppHeader() {
  const { t } = useI18n()
  const { saving, pendingSync } = useData()
  return <header className="topbar house-app-header">
    <div className="house-header-inner">
      <Link to="/" className="house-header-brand" aria-label={`House Care — ${t('overview')}`}>
        <img src="/brand/v2/house-care-mark.svg" width="34" height="34" alt="" aria-hidden="true" />
        <span>House Care</span>
      </Link>
      <div className="house-header-workspace">
        <WorkspaceSwitcher />
        {(saving || pendingSync > 0) && <span className="sync-state" role="status" aria-live="polite">
          {saving ? t('saving') : `${pendingSync} ${t('waitingToSync')}`}
        </span>}
      </div>
    </div>
  </header>
}
