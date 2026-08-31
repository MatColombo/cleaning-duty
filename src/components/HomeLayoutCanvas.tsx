import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { careEstimateForEntity, scheduledTasksForEntity, supplyAlertsForEntity } from '../lib/home'
import type { LayoutElement, WorkspaceData } from '../types/domain'
import type { RoomStatus } from '../lib/room'

export type HomeOverlay = 'care' | 'tasks' | 'supplies' | 'objects'

interface Props {
  data: WorkspaceData
  sceneId: string
  overlay: HomeOverlay
  editMode?: boolean
  snapToGrid?: boolean
  selectedElementId?: string
  selectedEntityIds?: Set<string>
  onSelectElement?: (elementId: string) => void
  onSelectEntity?: (entityId: string) => void
  onGeometryCommit?: (elementId: string, patch: Partial<LayoutElement>) => void | Promise<void>
  onOpenScene?: (sceneId: string) => void
  compact?: boolean
  zoom?: number
  /** Increment to explicitly recalculate the content-fit camera. */
  fitRequest?: number
  /** Operational room status keyed by room entity id. */
  roomStatuses?: Map<string, RoomStatus>
}

type Interaction = {
  mode: 'move' | 'resize' | 'vertex'
  elementId: string
  pointerId: number
  startX: number
  startY: number
  original: LayoutElement
  vertexIndex?: number
}

const VIEW_W = 1000
const VIEW_H = 700
const VIEW_ASPECT = VIEW_W / VIEW_H
const GRID = 20

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function snap(value: number, enabled: boolean) {
  return enabled ? Math.round(value / GRID) * GRID : value
}

function polygonPoints(element: LayoutElement) {
  const points = element.points?.length && element.points.length >= 3
    ? element.points
    : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
  return points.map((point) => `${element.x + point.x * element.width},${element.y + point.y * element.height}`).join(' ')
}

function darkenHex(value: string, amount = 0.28) {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) return '#65736b'
  const hex = match[1]
  const channel = (offset: number) => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

function elementFill(element: LayoutElement) {
  return element.fillColor ?? (element.role === 'area' ? '#f1f4ef' : '#ffffff')
}

function fittedBaseViewBox(elements: LayoutElement[]) {
  if (!elements.length) return { x: 0, y: 0, width: VIEW_W, height: VIEW_H }
  const pad = 70
  const minX = clamp(Math.min(...elements.map((item) => item.x)) - pad, 0, VIEW_W)
  const minY = clamp(Math.min(...elements.map((item) => item.y)) - pad, 0, VIEW_H)
  const maxX = clamp(Math.max(...elements.map((item) => item.x + item.width)) + pad, 0, VIEW_W)
  const maxY = clamp(Math.max(...elements.map((item) => item.y + item.height)) + pad, 0, VIEW_H)
  let width = Math.max(260, maxX - minX)
  let height = Math.max(182, maxY - minY)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  if (width / height > VIEW_ASPECT) height = width / VIEW_ASPECT
  else width = height * VIEW_ASPECT
  width = Math.min(width, VIEW_W)
  height = Math.min(height, VIEW_H)
  return { x: clamp(centerX - width / 2, 0, VIEW_W - width), y: clamp(centerY - height / 2, 0, VIEW_H - height), width, height }
}

function zoomedViewBox(base: { x: number; y: number; width: number; height: number }, zoom: number) {
  const safeZoom = clamp(zoom, 0.75, 2.5)
  const centerX = base.x + base.width / 2
  const centerY = base.y + base.height / 2
  let width = Math.min(VIEW_W, base.width / safeZoom)
  let height = Math.min(VIEW_H, base.height / safeZoom)
  if (width / height > VIEW_ASPECT) height = width / VIEW_ASPECT
  else width = height * VIEW_ASPECT
  width = Math.min(width, VIEW_W)
  height = Math.min(height, VIEW_H)
  return { x: clamp(centerX - width / 2, 0, VIEW_W - width), y: clamp(centerY - height / 2, 0, VIEW_H - height), width, height }
}

function CareBars({ x, y, routine, deep }: { x: number; y: number; routine: number | null; deep?: number | null }) {
  const barWidth = 82
  const trackX = x + 16
  const rows = deep == null ? [{ key: 'R', score: routine, className: 'routine' }] : [
    { key: 'R', score: routine, className: 'routine' },
    { key: 'D', score: deep, className: 'deep' },
  ]
  return <g className="care-health-bars" pointerEvents="none">
    {rows.map((row, index) => {
      if (row.score == null) return null
      const rowY = y + index * 14
      return <g key={row.key} className={`care-health-row ${row.className}`}>
        <text x={x} y={rowY + 8}>{row.key}</text>
        <rect className="care-health-track" x={trackX} y={rowY} width={barWidth} height="9" rx="4.5" />
        <rect className="care-health-fill" x={trackX} y={rowY} width={barWidth * clamp(row.score / 100, 0, 1)} height="9" rx="4.5" />
      </g>
    })}
  </g>
}

export function HomeLayoutCanvas({
  data,
  sceneId,
  overlay,
  editMode = false,
  snapToGrid = true,
  selectedElementId,
  selectedEntityIds = new Set(),
  onSelectElement,
  onSelectEntity,
  onGeometryCommit,
  onOpenScene,
  compact = false,
  zoom = 1,
  fitRequest = 0,
  roomStatuses = new Map(),
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [draft, setDraft] = useState<LayoutElement | null>(null)

  const elements = useMemo(() => data.layoutElements
    .filter((item) => !item.archivedAt && item.sceneId === sceneId)
    .sort((a, b) => a.zIndex - b.zIndex), [data.layoutElements, sceneId])
  const elementIdentityKey = elements.map((item) => item.id).join('|')
  const [baseCamera, setBaseCamera] = useState({ x: 0, y: 0, width: VIEW_W, height: VIEW_H })
  const baseCameraRef = useRef(baseCamera)
  const fitAnimationRef = useRef<number | null>(null)
  useEffect(() => { baseCameraRef.current = baseCamera }, [baseCamera])
  useEffect(() => {
    if (fitAnimationRef.current != null) window.cancelAnimationFrame(fitAnimationRef.current)
    const target = fittedBaseViewBox(elements)
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (compact || reduceMotion) {
      setBaseCamera(target)
      return
    }
    const from = baseCameraRef.current
    const started = performance.now()
    const duration = 340
    const tick = (time: number) => {
      const progress = clamp((time - started) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = {
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        width: from.width + (target.width - from.width) * eased,
        height: from.height + (target.height - from.height) * eased,
      }
      setBaseCamera(next)
      if (progress < 1) fitAnimationRef.current = window.requestAnimationFrame(tick)
      else fitAnimationRef.current = null
    }
    fitAnimationRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (fitAnimationRef.current != null) window.cancelAnimationFrame(fitAnimationRef.current)
      fitAnimationRef.current = null
    }
  }, [sceneId, fitRequest, elementIdentityKey, compact])
  const entities = useMemo(() => new Map(data.entities.filter((item) => !item.archivedAt).map((item) => [item.id, item])), [data.entities])
  const types = useMemo(() => new Map(data.entityTypes.filter((item) => !item.archivedAt).map((item) => [item.id, item])), [data.entityTypes])
  const displayed = draft ? elements.map((item) => item.id === draft.id ? draft : item) : elements
  const byEntity = new Map(displayed.map((item) => [item.entityId, item]))
  const relations = data.entityRelations.filter((item) => !item.archivedAt && byEntity.has(item.fromEntityId))
  const scene = data.layoutScenes.find((item) => item.id === sceneId && !item.archivedAt)
  const sceneBackground = scene?.backgroundColor ?? '#f8f9f6'
  const camera = zoomedViewBox(baseCamera, zoom)

  function localPoint(event: ReactPointerEvent<SVGSVGElement | SVGElement>) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const local = point.matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }

  function beginInteraction(event: ReactPointerEvent<SVGElement>, element: LayoutElement, mode: Interaction['mode'], vertexIndex?: number) {
    if (!editMode) return
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    const point = localPoint(event)
    setInteraction({ mode, elementId: element.id, pointerId: event.pointerId, startX: point.x, startY: point.y, original: element, vertexIndex })
    setDraft(element)
    onSelectElement?.(element.id)
    onSelectEntity?.(element.entityId)
  }

  function moveInteraction(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interaction || event.pointerId !== interaction.pointerId) return
    event.preventDefault()
    const point = localPoint(event)
    const dx = point.x - interaction.startX
    const dy = point.y - interaction.startY
    const original = interaction.original
    if (interaction.mode === 'move') {
      setDraft({ ...original, x: clamp(original.x + dx, 0, VIEW_W - original.width), y: clamp(original.y + dy, 0, VIEW_H - original.height) })
      return
    }
    if (interaction.mode === 'resize') {
      setDraft({ ...original, width: clamp(original.width + dx, 60, VIEW_W - original.x), height: clamp(original.height + dy, 50, VIEW_H - original.y) })
      return
    }
    if (interaction.mode === 'vertex' && interaction.vertexIndex != null) {
      const points = [...(original.points?.length ? original.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])]
      points[interaction.vertexIndex] = {
        x: clamp((point.x - original.x) / original.width, 0, 1),
        y: clamp((point.y - original.y) / original.height, 0, 1),
      }
      setDraft({ ...original, points })
    }
  }

  async function endInteraction(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interaction || event.pointerId !== interaction.pointerId) return
    event.preventDefault()
    const changed = draft
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
    setInteraction(null)
    setDraft(null)
    if (!changed || !onGeometryCommit) return
    const finalGeometry = snapToGrid ? (() => {
      const x = clamp(snap(changed.x, true), 0, VIEW_W - changed.width)
      const y = clamp(snap(changed.y, true), 0, VIEW_H - changed.height)
      return { ...changed, x, y, width: clamp(snap(changed.width, true), 60, VIEW_W - x), height: clamp(snap(changed.height, true), 50, VIEW_H - y) }
    })() : changed
    await onGeometryCommit(finalGeometry.id, {
      x: finalGeometry.x, y: finalGeometry.y, width: finalGeometry.width, height: finalGeometry.height,
      points: finalGeometry.points, rotation: finalGeometry.rotation,
    })
  }

  function selectElement(element: LayoutElement) {
    onSelectElement?.(element.id)
    onSelectEntity?.(element.entityId)
  }

  function selectElementFromKeyboard(event: ReactKeyboardEvent<SVGGElement>, element: LayoutElement) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    selectElement(element)
  }

  return <div className={`layout-canvas-wrap${compact ? ' compact' : ''}`} style={{ background: sceneBackground }}>
    <div className="layout-scroll-frame" style={{ background: sceneBackground }}>
      <svg
        ref={svgRef}
        className={`home-layout-canvas ${editMode ? 'editing' : ''}${interaction ? ' interacting' : ''}`}
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Home layout"
        onPointerMove={moveInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onPointerDown={(event) => { if (event.target === event.currentTarget) { onSelectElement?.(''); onSelectEntity?.('') } }}
      >
        {editMode && <defs><pattern id={`grid-${sceneId}`} width={GRID} height={GRID} patternUnits="userSpaceOnUse"><path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} className="layout-grid-line" fill="none" /></pattern></defs>}
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={sceneBackground} />
        {editMode && <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#grid-${sceneId})`} pointerEvents="none" />}

        <g className="layout-relations">
          {relations.map((relation) => {
            const from = byEntity.get(relation.fromEntityId)
            const to = relation.toEntityId ? byEntity.get(relation.toEntityId) : undefined
            if (!from) return null
            const x1 = from.x + from.width / 2
            const y1 = from.y + from.height / 2
            if (to) {
              const x2 = to.x + to.width / 2
              const y2 = to.y + to.height / 2
              return <g key={relation.id} className={`layout-relation relation-${relation.kind}`}><line x1={x1} y1={y1} x2={x2} y2={y2} /><circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="10" /></g>
            }
            if (relation.targetSceneId) {
              const targetScene = data.layoutScenes.find((item) => item.id === relation.targetSceneId && !item.archivedAt)
              return <g key={relation.id} className="scene-link-marker" role="button" tabIndex={0} aria-label={relation.label || targetScene?.name || 'Scene'} onClick={(event) => { event.stopPropagation(); onOpenScene?.(relation.targetSceneId!) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpenScene?.(relation.targetSceneId!) } }}><circle cx={x1} cy={y1} r="18" /><text x={x1} y={y1 + 5} textAnchor="middle">↕</text>{!compact && <text className="scene-link-label" x={x1 + 24} y={y1 + 5}>{relation.label || targetScene?.name || ''}</text>}</g>
            }
            return null
          })}
        </g>

        {displayed.map((element) => {
          const entity = entities.get(element.entityId)
          if (!entity) return null
          const type = types.get(entity.typeId)
          const care = overlay === 'care' ? careEstimateForEntity(data, entity.id) : null
          const taskCount = overlay === 'tasks' ? scheduledTasksForEntity(data, entity.id).length : 0
          const supplyAlerts = overlay === 'supplies' ? supplyAlertsForEntity(data, entity.id).length : 0
          const selected = selectedElementId === element.id || selectedEntityIds.has(entity.id)
          const roomStatus = element.role === 'area' ? (roomStatuses.get(entity.id) ?? 'none') : 'none'
          const centerX = element.x + element.width / 2
          const centerY = element.y + element.height / 2
          const transform = element.rotation ? `rotate(${element.rotation} ${centerX} ${centerY})` : undefined
          const points = element.points?.length ? element.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
          const labelFontSize = clamp(element.labelFontSize ?? (compact ? 17 : 19), 10, 48)
          const labelWrap = element.labelWrap ?? false
          const labelWidth = clamp(element.labelWidth ?? Math.max(120, element.width), 40, VIEW_W)
          const labelBlockHeight = labelWrap ? Math.max(60, labelFontSize * 5) : Math.max(42, labelFontSize * 2.2)
          const labelCenterY = element.labelPosition === 'top'
            ? element.y + Math.max(24, labelFontSize)
            : element.labelPosition === 'bottom'
              ? element.y + element.height - Math.max(24, labelFontSize)
              : centerY + (element.role === 'object' ? 24 : 0)
          const labelRotation = clamp(element.labelRotation ?? 0, -180, 180)
          const labelStyle: CSSProperties = {
            fontSize: `${labelFontSize}px`, color: element.textColor ?? '#24332b', whiteSpace: labelWrap ? 'normal' : 'nowrap',
            overflowWrap: labelWrap ? 'anywhere' : undefined, wordBreak: labelWrap ? 'break-word' : undefined,
            textShadow: element.textBackgroundColor ? 'none' : '0 0 2px white, 0 0 2px white',
          }
          const fill = elementFill(element)
          const stroke = selected ? 'var(--primary)' : darkenHex(fill)
          const resizeOffsetX = element.x + element.width <= VIEW_W - 38 ? 28 : -28
          const resizeOffsetY = element.y + element.height <= VIEW_H - 38 ? 28 : -28
          const resizeX = element.x + element.width + resizeOffsetX
          const resizeY = element.y + element.height + resizeOffsetY

          return <g key={element.id} className={`layout-element role-${element.role} ${selected ? 'selected' : ''} room-status-${roomStatus}`} transform={transform} onClick={(event) => { event.stopPropagation(); selectElement(element) }} onPointerDown={(event) => beginInteraction(event, element, 'move')} role="button" tabIndex={0} aria-pressed={selected} aria-label={entity.name} onKeyDown={(event) => selectElementFromKeyboard(event, element)}>
            {element.shape === 'polygon'
              ? <polygon points={polygonPoints(element)} className="layout-shape" style={{ fill, stroke }} />
              : <rect x={element.x} y={element.y} width={element.width} height={element.height} rx={element.role === 'area' ? 8 : 16} className="layout-shape" style={{ fill, stroke }} />}

            {element.role === 'area' && (roomStatus === 'overdue' || roomStatus === 'both') && (element.shape === 'polygon'
              ? <polygon points={polygonPoints(element)} className="room-status-outline overdue-outline polygon-status" />
              : <rect x={element.x - 7} y={element.y - 7} width={element.width + 14} height={element.height + 14} rx="12" className="room-status-outline overdue-outline" />)}
            {element.role === 'area' && (roomStatus === 'due_today' || roomStatus === 'both') && (element.shape === 'polygon'
              ? <polygon points={polygonPoints(element)} className="room-status-outline due-outline polygon-status" />
              : <rect x={element.x + 5} y={element.y + 5} width={Math.max(0, element.width - 10)} height={Math.max(0, element.height - 10)} rx="6" className="room-status-outline due-outline" />)}

            {!editMode && selected && element.role === 'area' && (element.shape === 'polygon'
              ? <polygon points={polygonPoints(element)} className="room-selection-outline" />
              : <rect x={element.x} y={element.y} width={element.width} height={element.height} rx="8" className="room-selection-outline" />)}

            {element.role === 'object' && <circle cx={centerX} cy={centerY - 14} r="18" className="object-icon-bg" />}
            {element.role === 'object' && <text x={centerX} y={centerY - 8} textAnchor="middle" className="object-icon">{type?.icon || '·'}</text>}

            <foreignObject x={centerX - labelWidth / 2} y={labelCenterY - labelBlockHeight / 2} width={labelWidth} height={labelBlockHeight} className="layout-label-foreign" pointerEvents="none" transform={labelRotation ? `rotate(${labelRotation} ${centerX} ${labelCenterY})` : undefined}>
              <div className="layout-label-wrap" style={labelStyle}><span style={{ backgroundColor: element.textBackgroundColor ?? 'transparent' }}>{entity.name}</span></div>
            </foreignObject>

            {care && (care.routine.score != null || care.deep?.score != null) && <CareBars x={element.x + 9} y={element.y + 9} routine={care.routine.score} deep={care.deep?.score} />}
            {overlay === 'tasks' && taskCount > 0 && <g className="layout-badge task-badge"><circle cx={element.x + element.width - 18} cy={element.y + 18} r="15" /><text x={element.x + element.width - 18} y={element.y + 23} textAnchor="middle">{taskCount}</text></g>}
            {overlay === 'supplies' && supplyAlerts > 0 && <g className="layout-badge supply-badge"><circle cx={element.x + element.width - 18} cy={element.y + 18} r="15" /><text x={element.x + element.width - 18} y={element.y + 23} textAnchor="middle">{supplyAlerts}</text></g>}
            {overlay === 'objects' && !compact && element.labelPosition !== 'bottom' && <text x={centerX} y={element.y + element.height - 12} textAnchor="middle" className="layout-type-label">{type?.name || ''}</text>}

            {editMode && selected && <>
              <rect x={element.x - 4} y={element.y - 4} width={element.width + 8} height={element.height + 8} className="selection-outline" />
              <line x1={element.x + element.width} y1={element.y + element.height} x2={resizeX} y2={resizeY} className="resize-handle-link" pointerEvents="none" />
              <circle cx={resizeX} cy={resizeY} r={compact ? 28 : 54} className="handle-hit-area" onPointerDown={(event) => beginInteraction(event, element, 'resize')} />
              <circle cx={resizeX} cy={resizeY} r={compact ? 13 : 18} className="resize-handle handle-visual" pointerEvents="none" />
              {element.shape === 'polygon' && points.map((point, index) => <g key={index}>
                <circle cx={element.x + point.x * element.width} cy={element.y + point.y * element.height} r={compact ? 24 : 48} className="handle-hit-area" onPointerDown={(event) => beginInteraction(event, element, 'vertex', index)} />
                <circle cx={element.x + point.x * element.width} cy={element.y + point.y * element.height} r={compact ? 11 : 15} className="vertex-handle handle-visual" pointerEvents="none" />
              </g>)}
            </>}
          </g>
        })}
      </svg>
    </div>
  </div>
}
