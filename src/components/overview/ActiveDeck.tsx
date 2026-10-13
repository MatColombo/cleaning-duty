import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type MouseEvent } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { WorkspaceData } from '../../types/domain'
import type { ActiveDeckEntry } from '../../lib/overviewDeck'
import { nextDeckIndex, careCardContext } from '../../lib/overviewDeck'
import { boundedDrag, dragTransform, gestureAxis, releaseDirection, survivingDeckId, type GestureAxis } from '../../lib/deckGestures'
import { useI18n } from '../../contexts/I18nContext'
import { CareCard } from './CareCard'
import { OverviewEmptyState } from './OverviewEmptyState'

type PointerSample = { x: number; at: number }
type PointerSession = {
  pointerId: number; startX: number; startY: number; width: number; axis: GestureAxis; key: string
  samples: PointerSample[]; moved: boolean; dx: number; dy: number
}
type Selection = { householdId: string; id: string }
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="dialog"], [data-deck-no-drag]'
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ActiveDeck({ entries, data, now, pendingTaskId, completionStamp, emptyLabel, onComplete, onMore }: {
  entries: ActiveDeckEntry[]; data: WorkspaceData; now: Date; pendingTaskId: string | null; completionStamp: string | null; emptyLabel: string
  onComplete: (id: string) => void; onMore: (id: string) => void
}) {
  const { t } = useI18n()
  const householdId = data.workspace.id
  const [selection, setSelection] = useState<Selection | null>(null)
  const priorIds = useRef<string[]>([])
  const priorHousehold = useRef(householdId)
  const stageRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<PointerSession | null>(null)
  const animationRef = useRef<Animation | null>(null)
  const animationKind = useRef<'outgoing' | 'incoming' | 'return' | null>(null)
  const activeKeyRef = useRef<string>('')
  const incomingRef = useRef<{ key: string; direction: -1 | 1 } | null>(null)
  const suppressClickUntil = useRef(0)
  const workingRef = useRef(false)
  const entriesIds = entries.map(entry => entry.task.id)
  const sameHome = selection?.householdId === householdId
  const retainedId = sameHome ? survivingDeckId(priorHousehold.current === householdId ? priorIds.current : [], entriesIds, selection?.id ?? null) : (entriesIds[0] ?? null)
  const currentIndex = Math.max(0, entries.findIndex(entry => entry.task.id === retainedId))
  const current = entries[currentIndex]
  const currentKey = current ? `${householdId}:${current.task.id}` : `${householdId}:empty`

  // Keep a remembered identity even when the list is reordered or a completed card disappears.
  useLayoutEffect(() => {
    const homeChanged = priorHousehold.current !== householdId
    const prior = homeChanged ? [] : priorIds.current
    const preferred = selection?.householdId === householdId ? selection.id : null
    const id = survivingDeckId(prior, entriesIds, preferred)
    priorHousehold.current = householdId
    priorIds.current = entriesIds
    if (id && (selection?.householdId !== householdId || selection.id !== id)) setSelection({ householdId, id })
    if (!id && selection !== null) setSelection(null)
  }, [householdId, entriesIds.join('\u0000'), selection])

  function resetVisual() {
    const front = frontRef.current
    const stage = stageRef.current
    if (front) { front.style.transform = ''; front.style.opacity = ''; front.classList.remove('v2-deck-grabbing') }
    if (stage) { stage.style.removeProperty('--v2-deck-back-first'); stage.style.removeProperty('--v2-deck-back-second'); stage.classList.remove('v2-deck-dragging') }
  }
  function cancelAnimation() {
    animationRef.current?.cancel()
    animationRef.current = null
    animationKind.current = null
    workingRef.current = false
  }
  // A refresh that replaces/removes the focused occurrence cancels the old drag/animation.
  useLayoutEffect(() => {
    if (activeKeyRef.current === currentKey) return
    activeKeyRef.current = currentKey
    pointerRef.current = null
    cancelAnimation()
    resetVisual()
    const incoming = incomingRef.current
    if (!incoming || incoming.key !== currentKey) { incomingRef.current = null; return }
    incomingRef.current = null
    const front = frontRef.current
    if (!front || reducedMotion()) return
    const offset = incoming.direction === 1 ? 1 : -1
    const width = front.getBoundingClientRect().width
    const frames = [
      { transform: dragTransform(offset * Math.min(width * 0.60, 235), 5, offset * 6), opacity: 0.84 },
      { transform: dragTransform(-offset * 13, -1, -offset * 1.3), opacity: 1, offset: 0.75 },
      { transform: dragTransform(0, 0, 0), opacity: 1 },
    ]
    const animation = front.animate(frames, { duration: 330, easing: 'cubic-bezier(.2,.75,.26,1)', fill: 'none' })
    animationRef.current = animation
    animationKind.current = 'incoming'
    workingRef.current = true
    animation.onfinish = () => { if (animationRef.current === animation) { animationRef.current = null; animationKind.current = null; workingRef.current = false } }
    animation.oncancel = () => { if (animationRef.current === animation) { animationRef.current = null; animationKind.current = null; workingRef.current = false } }
  }, [currentKey])
  useEffect(() => () => { pointerRef.current = null; animationRef.current?.cancel() }, [])

  function navigate(direction: -1 | 1, fromDrag = false, releaseVelocity = 0) {
    if (entries.length < 2 || workingRef.current) { resetVisual(); return }
    const next = entries[nextDeckIndex(entries.length, currentIndex, direction)]
    if (!next || next.task.id === current?.task.id) { resetVisual(); return }
    const targetKey = `${householdId}:${next.task.id}`
    const front = frontRef.current
    if (!fromDrag || !front || reducedMotion()) {
      resetVisual()
      incomingRef.current = null
      setSelection({ householdId, id: next.task.id })
      return
    }
    workingRef.current = true
    const start = getComputedStyle(front).transform === 'none' ? 'none' : front.style.transform || 'none'
    const sign = direction === 1 ? -1 : 1
    const width = front.getBoundingClientRect().width
    const endX = sign * Math.min(width * 1.17, 520)
    const animation = front.animate([
      { transform: start === 'none' ? dragTransform(0, 0, 0) : start, opacity: 1 },
      { transform: dragTransform(endX * .65, -8, sign * 9), opacity: .95, offset: .72 },
      { transform: dragTransform(endX, -13, sign * 12), opacity: .45 },
    ], { duration: Math.max(140, 260 - Math.min(115, Math.abs(releaseVelocity) * 95)), easing: 'cubic-bezier(.25,.55,.4,1)', fill: 'forwards' })
    animationRef.current = animation
    animationKind.current = 'outgoing'
    animation.onfinish = () => {
      if (animationRef.current !== animation || activeKeyRef.current !== currentKey) return
      animationRef.current = null
      animationKind.current = null
      workingRef.current = false
      incomingRef.current = { key: targetKey, direction }
      resetVisual()
      // Keep the old card invisible until React commits the new card identity.
      if (front) front.style.opacity = '0'
      animation.cancel()
      setSelection({ householdId, id: next.task.id })
    }
    animation.oncancel = () => { if (animationRef.current === animation) { animationRef.current = null; animationKind.current = null; workingRef.current = false } }
  }
  function animateReturn(releaseVelocity = 0) {
    const front = frontRef.current
    const start = front?.style.transform || dragTransform(0, 0, 0)
    resetVisual()
    if (!front || reducedMotion()) return
    const animation = front.animate([
      { transform: start, offset: 0 },
      { transform: dragTransform(-parseFloat(start.match(/translate3d\(([-\d.]+)/)?.[1] ?? '0') * .065, 0, 0), offset: .74 },
      { transform: dragTransform(0, 0, 0), offset: 1 },
    ], { duration: Math.max(210, 310 - Math.min(90, Math.abs(releaseVelocity) * 55)), easing: 'cubic-bezier(.24,.8,.28,1)', fill: 'none' })
    animationRef.current = animation
    animationKind.current = 'return'
    workingRef.current = true
    animation.onfinish = () => { if (animationRef.current === animation) { animationRef.current = null; animationKind.current = null; workingRef.current = false } }
    animation.oncancel = () => { if (animationRef.current === animation) { animationRef.current = null; animationKind.current = null; workingRef.current = false } }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    // A separate intentional press must never inherit click suppression from a prior swipe.
    if (event.isPrimary) suppressClickUntil.current = 0
    if (entries.length < 2 || pointerRef.current || !event.isPrimary || event.button !== 0) return
    if (!frontRef.current?.contains(event.target as Node) || (event.target as Element).closest(INTERACTIVE)) return
    // Return/incoming animation can be interrupted by the next deliberate swipe;
    // never interrupt outgoing navigation before its selected identity is committed.
    if (workingRef.current) {
      if (animationKind.current === 'outgoing') return
      cancelAnimation(); resetVisual()
    }
    const stage = stageRef.current
    if (!stage || !frontRef.current) return
    pointerRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: frontRef.current.getBoundingClientRect().width,
      axis: 'undecided', key: currentKey, moved: false, dx: 0, dy: 0,
      samples: [{ x: event.clientX, at: event.timeStamp }],
    }
    stage.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = pointerRef.current
    if (!session || session.pointerId !== event.pointerId || session.key !== currentKey) return
    const dx = event.clientX - session.startX
    const dy = event.clientY - session.startY
    if (session.axis === 'undecided') session.axis = gestureAxis(dx, dy)
    if (session.axis === 'vertical') return // Let browser/scrollable card content handle vertical scrolling.
    if (session.axis !== 'horizontal') return
    session.moved = true
    session.dx = dx; session.dy = dy
    session.samples.push({ x: event.clientX, at: event.timeStamp })
    while (session.samples.length > 2 && (session.samples.length > 10 || event.timeStamp - session.samples[0].at > 85)) session.samples.shift()
    const front = frontRef.current
    if (!front) return
    const drag = boundedDrag(dx, dy, session.width)
    stageRef.current?.classList.add('v2-deck-dragging')
    front.classList.add('v2-deck-grabbing')
    if (!reducedMotion()) {
      front.style.transform = dragTransform(drag.x, drag.y, drag.angle)
      stageRef.current?.style.setProperty('--v2-deck-back-first', `${(drag.progress * 5.5).toFixed(2)}px`)
      stageRef.current?.style.setProperty('--v2-deck-back-second', `${(drag.progress * 2.3).toFixed(2)}px`)
    }
    if (event.cancelable) event.preventDefault()
  }
  function endPointer(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const session = pointerRef.current
    if (!session || session.pointerId !== event.pointerId) return
    pointerRef.current = null
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId)
    if (session.axis === 'horizontal' && session.moved) {
      // Captured touch/mouse pointers may synthesize a click after release; consume it.
      suppressClickUntil.current = performance.now() + 420
      if (cancelled || session.key !== activeKeyRef.current) { animateReturn(); return }
      const recent = session.samples[0]
      const last = session.samples[session.samples.length - 1]
      const velocityX = last && recent && last.at > recent.at ? (last.x - recent.x) / (last.at - recent.at) : 0
      const direction = releaseDirection(session.dx, velocityX, session.width, entries.length)
      if (direction) navigate(direction, true, velocityX)
      else animateReturn(velocityX)
    } else resetVisual()
  }
  function clickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.detail > 0 && performance.now() < suppressClickUntil.current) {
      event.preventDefault(); event.stopPropagation(); suppressClickUntil.current = 0
    }
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || entries.length < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1) }
  }
  return <section className="v2-active-deck" aria-labelledby="v2-deck-title">
    <div className="v2-deck-heading"><div><span className="v2-print-eyebrow">{t('today')}</span><h2 id="v2-deck-title" className="hc-display">{t('activeDeck')}</h2></div><span className="v2-deck-count">{entries.length} {t('deckTasks')}</span></div>
    {current ? <div ref={stageRef} className="v2-deck-stage" tabIndex={0} onKeyDown={keyDown} role="region" aria-roledescription={t('activeDeck')} aria-label={t('activeDeck')} aria-describedby="v2-deck-browse-help"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => endPointer(event, false)} onPointerCancel={event => endPointer(event, true)}
      onLostPointerCapture={event => endPointer(event, true)} onClickCapture={clickCapture}>
      <span id="v2-deck-browse-help" className="v2-deck-screenreader-help">{t('deckBrowseHint')}</span>
      {entries.length > 1 && <div className="v2-deck-back v2-deck-back-first" aria-hidden="true" />}
      {entries.length > 2 && <div className="v2-deck-back v2-deck-back-second" aria-hidden="true" />}
      <div ref={frontRef} className="v2-deck-front">
        <CareCard key={currentKey} task={current.task} data={data} priority={current.priority} now={now}
          context={careCardContext(data, current.task, now)} pending={pendingTaskId === current.task.id}
          onComplete={onComplete} onMore={onMore} />
      </div>
      {entries.length > 1 && <div className="v2-deck-controls" data-deck-no-drag="true"><button type="button" aria-label={t('previousCard')} onClick={() => navigate(-1)}><CaretLeft /></button><span aria-live="polite" className="hc-tabular-numerals">{currentIndex + 1} / {entries.length}</span><button type="button" aria-label={t('nextCard')} onClick={() => navigate(1)}><CaretRight /></button></div>}
    </div> : <OverviewEmptyState label={emptyLabel} />}
    {completionStamp && <div className="v2-completion-stamp" role="status"><span aria-hidden="true">✦</span> {t('careCardCollected')}: {completionStamp}</div>}
  </section>
}
