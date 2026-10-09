import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'

/** Extracted without changing update, offline, conflict or error actions. */
export function RuntimeBanners() {
  const { t } = useI18n()
  const { error, clearError, online, syncConflicts, dismissSyncConflicts } = useData()
  const navigate = useNavigate()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const onReady = () => setUpdateReady(true)
    window.addEventListener('housecare:update-ready', onReady)
    return () => window.removeEventListener('housecare:update-ready', onReady)
  }, [])

  function applyUpdate() {
    navigator.serviceWorker?.getRegistration().then((registration) => {
      if (!registration?.waiting) return location.reload()
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    })
  }

  return <>
    {!online && <div className="runtime-banner offline-banner">{t('offlineMode')}</div>}
    {syncConflicts.length > 0 && <div className="runtime-banner conflict-banner"><span>{t('syncConflict')} · {syncConflicts.length}</span><button onClick={dismissSyncConflicts}>{t('dismiss')}</button></div>}
    {updateReady && <div className="runtime-banner update-banner"><span>{t('updateReady')}</span><button onClick={applyUpdate}>{t('updateNow')}</button></div>}
    {error && <div className="error-banner app-error-banner" role="alert"><span>{error}</span><div className="runtime-actions"><button onClick={() => navigate('/settings?errors=1')}>{t('details')}</button><button onClick={clearError}>{t('dismiss')}</button></div></div>}
  </>
}
