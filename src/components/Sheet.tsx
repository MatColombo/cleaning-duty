import type { ReactNode } from 'react'
import { useI18n } from '../contexts/I18nContext'

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="button ghost small" onClick={onClose}>{t('close')}</button>
        </header>
        {children}
      </section>
    </div>
  )
}
