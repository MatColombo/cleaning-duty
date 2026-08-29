import { useEffect, useState } from 'react'
import { clearErrorLog, getErrorLog, subscribeErrorLog, type ErrorLogEntry } from '../lib/errorLog'
import { useI18n } from '../contexts/I18nContext'
import { Sheet } from './Sheet'

export function ErrorLogPanel({ autoOpen = false }: { autoOpen?: boolean }) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(autoOpen)
  const [entries, setEntries] = useState<ErrorLogEntry[]>(() => getErrorLog())

  useEffect(() => subscribeErrorLog(() => setEntries(getErrorLog())), [])
  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])

  function clear() {
    if (!confirm(t('clearErrorLogConfirm'))) return
    clearErrorLog()
    setEntries([])
  }

  return <>
    <section className="card section-card" id="diagnostics">
      <div className="section-header"><div><h2>{t('diagnostics')}</h2><p className="muted compact-text">{t('errorLogHint')}</p></div><span className="count-pill small-pill">{entries.length}</span></div>
      <div className="row-actions diagnostics-actions">
        <button className="button secondary" onClick={() => setOpen(true)}>{t('viewErrorLog')}</button>
        {entries.length > 0 && <button className="button ghost danger-text" onClick={clear}>{t('clearLog')}</button>}
      </div>
    </section>
    {open && <Sheet title={t('errorLog')} onClose={() => setOpen(false)}>
      <div className="stack error-log-sheet">
        <p className="muted compact-text">{t('errorLogLocalOnly')}</p>
        {!entries.length ? <div className="empty-state">{t('noLoggedErrors')}</div> : <div className="error-log-list">
          {entries.map((entry) => <details className="error-log-entry" key={entry.id}>
            <summary>
              <span><strong>{entry.message}</strong><small>{new Date(entry.lastAt).toLocaleString(locale)}{entry.count > 1 ? ` · ×${entry.count}` : ''}</small></span>
              {entry.code && <code>{entry.code}</code>}
            </summary>
            <div className="error-log-context">
              <ContextRow label={t('errorArea')} value={entry.area} />
              <ContextRow label={t('route')} value={entry.route} />
              <ContextRow label={t('home')} value={entry.workspaceName} />
              <ContextRow label={t('connection')} value={entry.online ? t('online') : t('offline')} />
              {entry.details && <ContextRow label={t('details')} value={entry.details} />}
              {entry.hint && <ContextRow label={t('hint')} value={entry.hint} />}
              {(entry.recentActions ?? []).length > 0 && <div className="error-context-row"><strong>{t('recentActions')}</strong><ol>{(entry.recentActions ?? []).map((action, index) => <li key={`${action.at}-${index}`}><span>{action.label}</span><small>{action.route}</small></li>)}</ol></div>}
              {entry.stack && <details className="technical-details"><summary>{t('technicalDetails')}</summary><pre>{entry.stack}</pre></details>}
            </div>
          </details>)}
        </div>}
      </div>
    </Sheet>}
  </>
}

function ContextRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <div className="error-context-row"><strong>{label}</strong><span>{value}</span></div>
}
