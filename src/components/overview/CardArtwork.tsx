import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { WorkspaceData, TaskOccurrence } from '../../types/domain'
import { cardVisualInputFromDomain } from '../../visual/procedural/resolver'
import { getCardVisualRecipe } from '../../visual/procedural/cache'
import { renderCardVisualSvg } from '../../visual/procedural/render-card'
import type { VectorPalette } from '../../visual/types'
import { overlayStudioRecipe } from '../../visual/studio/draft'
import { effectiveVisualOverrides } from '../../lib/visualOverrides'

/** Five effective inks for printed Care Cards. All roles derive from the existing
 * semantic theme; no new persisted colors or generator-v2 changes are needed. */
const FIVE_INK_CARD_PALETTE: VectorPalette = Object.freeze({
  paper: 'var(--hc-art-surface)', surface: 'var(--hc-art-surface)',
  ink: 'var(--hc-art-ink)', inkMuted: 'var(--hc-art-ink)',
  primary: 'var(--hc-art-primary)', primarySoft: 'var(--hc-art-surface)',
  turquoise: 'var(--hc-art-primary)', mustard: 'var(--hc-art-mustard)',
  coral: 'var(--hc-art-coral)', danger: 'var(--hc-art-coral)',
})

type MotionPhase = 'idle' | 'tilt' | 'blink' | 'gesture'

/** Render the one visible card only. All SVG is generated locally from authored primitives. */
export function CardArtwork({ task, data, animated = false }: { task: TaskOccurrence; data: WorkspaceData; animated?: boolean }) {
  const instanceKey = useId()
  const containerRef = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState<MotionPhase>('idle')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [inView, setInView] = useState(!animated)
  const timers = useRef<number[]>([])
  const playedIntroForTask = useRef<string | null>(null)

  const artwork = useMemo(() => {
    const input = cardVisualInputFromDomain(task, data)
    const recipe = getCardVisualRecipe(input)
    const studio = effectiveVisualOverrides(data, input)
    return renderCardVisualSvg(studio ? overlayStudioRecipe(recipe, studio) : recipe, {
      instanceKey, decorative: true, palette: FIVE_INK_CARD_PALETTE, studio,
    })
  }, [instanceKey, task, data])

  useEffect(() => {
    if (!animated || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [animated])

  useEffect(() => {
    if (!animated || typeof IntersectionObserver === 'undefined') return
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      setInView(entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > .24))
    }, { threshold: [0, .24, .6] })
    observer.observe(node)
    return () => observer.disconnect()
  }, [animated])

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }, [])

  function clearMotionTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }

  function queueMotion(nextPhase: MotionPhase, delay: number) {
    timers.current.push(window.setTimeout(() => setPhase(nextPhase), delay))
  }

  function playSequence(mode: 'intro' | 'gesture') {
    if (!animated || reducedMotion || !inView || typeof window === 'undefined') return
    clearMotionTimers()
    setPhase(mode === 'intro' ? 'tilt' : 'gesture')
    if (mode === 'intro') {
      queueMotion('idle', 860)
      queueMotion('blink', 1780)
      queueMotion('idle', 1980)
      queueMotion('gesture', 2940)
      queueMotion('idle', 3780)
    } else {
      queueMotion('idle', 760)
    }
  }

  useEffect(() => {
    if (!animated || reducedMotion || !inView) { clearMotionTimers(); setPhase('idle'); return }
    if (playedIntroForTask.current === task.id) return
    playedIntroForTask.current = task.id
    playSequence('intro')
  }, [animated, reducedMotion, inView, task.id])

  return <span
    ref={containerRef}
    className={`v2-card-art${animated ? ' v2-card-art-hero' : ''}`}
    data-motion-phase={phase}
    data-motion-enabled={animated && !reducedMotion && inView ? 'true' : 'false'}
    aria-hidden="true"
    onPointerEnter={() => playSequence('gesture')}
    onFocusCapture={() => playSequence('gesture')}
    dangerouslySetInnerHTML={{ __html: artwork }}
  />
}
