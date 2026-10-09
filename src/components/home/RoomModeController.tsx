import { useI18n } from '../../contexts/I18nContext'
import { buildRoomWorkflow } from '../../lib/room'
import type { Entity, TaskOccurrence, WorkspaceData } from '../../types/domain'
import { RoomModeSheet } from './RoomModeSheet'
import { deferRoomSessionTask, orderedRoomSessionQueue } from './roomPresentation'

interface RoomModeControllerProps {
  room: Entity
  data: WorkspaceData
  now: Date
  handled: number
  deferredIds: readonly string[]
  onDeferredIds: (updater: (ids: string[]) => string[]) => void
  onHandled: (updater: (count: number) => number) => void
  onRememberUndo: (task: TaskOccurrence, eventId: string | null, verb: string) => void
  completeTask: (id: string) => Promise<string | null>
  skipTask: (id: string) => Promise<string | null>
  onClose: () => void
}

/** Isolates existing room-session ordering/mutation callbacks from SVG presentation.
 * Both task mutations remain the original DataContext services. */
export function RoomModeController({ room, data, now, handled, deferredIds, onDeferredIds, onHandled, onRememberUndo, completeTask, skipTask, onClose }: RoomModeControllerProps) {
  const { t } = useI18n()
  const workflow = buildRoomWorkflow(data, room.id, now)
  const queue = orderedRoomSessionQueue(workflow.queue, deferredIds)
  const current = queue[0]
  const total = handled + queue.length

  function moveLater() {
    if (!current) return
    onDeferredIds((ids) => deferRoomSessionTask(ids, current.id))
  }
  async function completeCurrent() {
    if (!current || !window.confirm(t('confirmCompleteTask'))) return
    const eventId = await completeTask(current.id)
    onRememberUndo(current, eventId, t('completed').toLowerCase())
    if (eventId) {
      onHandled((count) => count + 1)
      onDeferredIds((ids) => ids.filter((id) => id !== current.id))
    }
  }
  async function skipCurrent() {
    if (!current || !window.confirm(t('confirmSkipTask'))) return
    const eventId = await skipTask(current.id)
    onRememberUndo(current, eventId, t('skipped').toLowerCase())
    if (eventId) {
      onHandled((count) => count + 1)
      onDeferredIds((ids) => ids.filter((id) => id !== current.id))
    }
  }
  return <RoomModeSheet room={room} data={data} current={current} now={now} handled={handled} total={total}
    isOverdue={workflow.overdue.some((task) => task.id === current?.id)}
    onComplete={() => void completeCurrent()} onSkip={() => void skipCurrent()} onLater={moveLater} onClose={onClose} />
}
