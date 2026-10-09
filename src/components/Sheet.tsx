import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useI18n } from '../contexts/I18nContext'
import { nextWrappedFocus } from './dialogFocus'

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useI18n()
  const titleId = useId()
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      ;(first ?? sheetRef.current)?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab' || !sheetRef.current) return
    const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    const next = nextWrappedFocus(focusable, document.activeElement as HTMLElement | null, event.shiftKey)
    if (next) { event.preventDefault(); next.focus() }
  }

  const content = (
    <div className="sheet-backdrop hc-v2-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={sheetRef} className="sheet hc-v2-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown} onPointerDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header hc-v2-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button sheet-close" aria-label={t('close')} title={t('close')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
        </header>
        {children}
      </section>
    </div>
  )

  return createPortal(content, document.body)
}
