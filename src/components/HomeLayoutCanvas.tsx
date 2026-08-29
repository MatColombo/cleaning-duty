import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { careEstimateForEntity, scheduledTasksForEntity, supplyAlertsForEntity } from '../lib/home'
import type { LayoutElement, WorkspaceData } from '../types/domain'

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
const GRID = 20

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function snap(value: number, enabled: boolean) {
  return enabled ? Math.round(value / GRID) * GRID : value
}

function careClass(status: string) {
  return `care-${status.replace('_', '-')}`
}

function polygonPoints(element: LayoutElement) {
  const points = element.points?.length && element.points.length >= 3
    ? element.points
    : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
  return points.map((point) => `${element.x + point.x * element.width},${element.y + point.y * element.height}`).join(' ')
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
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [draft, setDraft] = useState<LayoutElement | null>(null)

  const elements = useMemo(() => data.layoutElements
    .filter((item) => !item.archivedAt && item.sceneId === sceneId)
    .sort((a, b) => a.zIndex - b.zIndex), [data.layoutElements, sceneId])
  const entities = useMemo(() => new Map(data.entities.filter((item) => !item.archivedAt).map((item) => [item.id, item])), [data.entities])
  const types = useMemo(() => new Map(data.entityTypes.filter((item) => !item.archivedAt).map((item) => [item.id, item])), [data.entityTypes])
  const displayed = draft ? elements.map((item) => item.id === draft.id ? draft : item) : elements
  const byEntity = new Map(displayed.map((item) => [item.entityId, item]))
  const relations = data.entityRelations.filter((item) => !item.archivedAt && byEntity.has(item.fromEntityId))

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
      setDraft({
        ...original,
        x: clamp(original.x + dx, 0, VIEW_W - original.width),
        y: clamp(original.y + dy, 0, VIEW_H - original.height),
      })
      return
    }
    if (interaction.mode === 'resize') {
      setDraft({
        ...original,
        width: clamp(original.width + dx, 60, VIEW_W - original.x),
        height: clamp(original.height + dy, 50, VIEW_H - original.y),
      })
      return
    }
    if (interaction.mode === 'vertex' && interaction.vertexIndex != null) {
      const points = [...(original.points?.length ? original.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])]
      const localX = clamp((point.x - original.x) / original.width, 0, 1)
      const localY = clamp((point.y - original.y) / original.height, 0, 1)
      points[interaction.vertexIndex] = { x: localX, y: localY }
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
      return {
        ...changed,
        x, y,
        width: clamp(snap(changed.width, true), 60, VIEW_W - x),
        height: clamp(snap(changed.height, true), 50, VIEW_H - y),
      }
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

  return <div className={`layout-canvas-wrap${compact ? ' compact' : ''}`}>
    <svg
      ref={svgRef}
      className={`home-layout-canvas ${editMode ? 'editing' : ''}${interaction ? ' interacting' : ''}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Home layout"
      onPointerMove={moveInteraction}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onPointerDown={(event) => { if (event.target === event.currentTarget) { onSelectElement?.(''); onSelectEntity?.('') } }}
    >
      {editMode && <defs><pattern id={`grid-${sceneId}`} width={GRID} height={GRID} patternUnits="userSpaceOnUse"><path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} className="layout-grid-line" fill="none" /></pattern></defs>}
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} className="layout-background" />
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
            return <g key={relation.id} className={`layout-relation relation-${relation.kind}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="10" />
            </g>
          }
          if (relation.targetSceneId) {
            const targetScene = data.layoutScenes.find((item) => item.id === relation.targetSceneId && !item.archivedAt)
            return <g key={relation.id} className="scene-link-marker" role="button" onClick={(event) => { event.stopPropagation(); onOpenScene?.(relation.targetSceneId!) }}>
              <circle cx={x1} cy={y1} r="18" />
              <text x={x1} y={y1 + 5} textAnchor="middle">↕</text>
              {!compact && <text className="scene-link-label" x={x1 + 24} y={y1 + 5}>{relation.label || targetScene?.name || ''}</text>}
            </g>
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
        const overlayClass = care ? careClass(care.status) : ''
        const centerX = element.x + element.width / 2
        const centerY = element.y + element.height / 2
        const transform = element.rotation ? `rotate(${element.rotation} ${centerX} ${centerY})` : undefined
        const points = element.points?.length ? element.points : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
        return <g
          key={element.id}
          className={`layout-element role-${element.role} ${overlayClass} ${selected ? 'selected' : ''}`}
          transform={transform}
          onClick={(event) => { event.stopPropagation(); selectElement(element) }}
          onPointerDown={(event) => beginInteraction(event, element, 'move')}
          role="button"
          aria-label={entity.name}
        >
          {element.shape === 'polygon'
            ? <polygon points={polygonPoints(element)} className="layout-shape" />
            : <rect x={element.x} y={element.y} width={element.width} height={element.height} rx={element.role === 'area' ? 8 : 16} className="layout-shape" />}

          {element.role === 'object' && <circle cx={centerX} cy={centerY - 14} r="18" className="object-icon-bg" />}
          {element.role === 'object' && <text x={centerX} y={centerY - 8} textAnchor="middle" className="object-icon">{type?.icon || '·'}</text>}
          <text x={centerX} y={element.labelPosition === 'top' ? element.y + 24 : centerY + (element.role === 'object' ? 22 : 5)} textAnchor="middle" className="layout-label">{entity.name}</text>

          {care && care.score != null && <g className="layout-badge care-badge">
            <rect x={element.x + 9} y={element.y + 9} width="48" height="24" rx="12" />
            <text x={element.x + 33} y={element.y + 26} textAnchor="middle">{care.score}</text>
          </g>}
          {overlay === 'tasks' && taskCount > 0 && <g className="layout-badge task-badge">
            <circle cx={element.x + element.width - 18} cy={element.y + 18} r="15" />
            <text x={element.x + element.width - 18} y={element.y + 23} textAnchor="middle">{taskCount}</text>
          </g>}
          {overlay === 'supplies' && supplyAlerts > 0 && <g className="layout-badge supply-badge">
            <circle cx={element.x + element.width - 18} cy={element.y + 18} r="15" />
            <text x={element.x + element.width - 18} y={element.y + 23} textAnchor="middle">{supplyAlerts}</text>
          </g>}
          {overlay === 'objects' && !compact && <text x={centerX} y={element.y + element.height - 12} textAnchor="middle" className="layout-type-label">{type?.name || ''}</text>}

          {editMode && selected && <>
            <rect x={element.x - 4} y={element.y - 4} width={element.width + 8} height={element.height + 8} className="selection-outline" />
            <circle
              cx={element.x + element.width}
              cy={element.y + element.height}
              r={compact ? 28 : 58}
              className="handle-hit-area"
              onPointerDown={(event) => beginInteraction(event, element, 'resize')}
            />
            <circle
              cx={element.x + element.width}
              cy={element.y + element.height}
              r={compact ? 13 : 18}
              className="resize-handle handle-visual"
              pointerEvents="none"
            />
            {element.shape === 'polygon' && points.map((point, index) => <g key={index}>
              <circle
                cx={element.x + point.x * element.width}
                cy={element.y + point.y * element.height}
                r={compact ? 24 : 48}
                className="handle-hit-area"
                onPointerDown={(event) => beginInteraction(event, element, 'vertex', index)}
              />
              <circle
                cx={element.x + point.x * element.width}
                cy={element.y + point.y * element.height}
                r={compact ? 11 : 15}
                className="vertex-handle handle-visual"
                pointerEvents="none"
              />
            </g>)}
          </>}
        </g>
      })}
    </svg>
  </div>
}
