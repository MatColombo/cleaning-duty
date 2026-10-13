import { useLayoutEffect, type RefObject } from 'react'

/** Sizing follows the visible browser/PWA viewport AND the actual sticky header.
 * Never infer keyboard height from window.innerHeight or assume a fixed topbar. */
export function useOverviewViewport(ref: RefObject<HTMLDivElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const overview = ref.current
    if (!active || !overview) return
    const header = document.querySelector<HTMLElement>('.house-app-header')
    const vv = window.visualViewport
    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const viewportHeight = vv?.height ?? window.innerHeight
        // The header's bottom already includes any iOS safe-area padding.
        const headerBottom = header?.getBoundingClientRect().bottom ?? 58
        const available = Math.max(0, viewportHeight - headerBottom)
        const baseFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        const zoomed = (vv?.scale ?? 1) > 1.05
        const scrollFallback = available < 700 || baseFont > 18 || zoomed
        overview.style.setProperty('--hc-overview-available', `${available}px`)
        overview.classList.toggle('v2-overview-scroll-fallback', scrollFallback)
      })
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (header) observer?.observe(header)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    measure()
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      overview.classList.remove('v2-overview-scroll-fallback')
      overview.style.removeProperty('--hc-overview-available')
    }
  }, [active, ref])
}
