import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../contexts/I18nContext'

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useI18n()

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  const content = (
    <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="button ghost small" onClick={onClose}>{t('close')}</button>
        </header>
        {children}
      </section>
    </div>
  )

  return createPortal(content, document.body)
}
