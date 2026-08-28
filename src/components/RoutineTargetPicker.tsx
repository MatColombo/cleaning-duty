import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../contexts/I18nContext'
import type { WorkspaceData } from '../types/domain'
import { HomeLayoutCanvas } from './HomeLayoutCanvas'

interface Props {
  data: WorkspaceData
  targets: string[]
  includeDescendantTargetIds: string[]
  onChange: (targets: string[], includeDescendantTargetIds: string[]) => void
}

export function RoutineTargetPicker({ data, targets, includeDescendantTargetIds, onChange }: Props) {
  const { t } = useI18n()
  const scenes = useMemo(() => data.layoutScenes.filter((item) => !item.archivedAt).sort((a, b) => a.order - b.order), [data.layoutScenes])
  const entities = data.entities.filter((item) => !item.archivedAt)
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? '')
  useEffect(() => {
    if (scenes.length && !scenes.some((scene) => scene.id === sceneId)) setSceneId(scenes[0].id)
  }, [scenes, sceneId])

  function toggle(entityId: string) {
    if (!entityId) return
    if (targets.includes(entityId)) {
      onChange(targets.filter((id) => id !== entityId), includeDescendantTargetIds.filter((id) => id !== entityId))
    } else {
      onChange([...targets, entityId], includeDescendantTargetIds)
    }
  }

  function setScope(entityId: string, include: boolean) {
    const next = include
      ? [...new Set([...includeDescendantTargetIds, entityId])]
      : includeDescendantTargetIds.filter((id) => id !== entityId)
    onChange(targets, next)
  }

  return <div className="visual-target-picker stack tight-stack">
    {scenes.length > 0 && <>
      <div className="scene-tabs compact-tabs">{scenes.map((scene) => <button type="button" key={scene.id} className={scene.id === sceneId ? 'scene-tab selected' : 'scene-tab'} onClick={() => setSceneId(scene.id)}>{scene.name}</button>)}</div>
      <HomeLayoutCanvas data={data} sceneId={sceneId} overlay="objects" compact selectedEntityIds={new Set(targets)} onSelectEntity={toggle} />
      <small className="muted">{t('tapTargetsHint')}</small>
    </>}

    {targets.length > 0 && <div className="target-scope-list">{targets.map((entityId) => {
      const entity = entities.find((item) => item.id === entityId)
      if (!entity) return null
      const hasChildren = entities.some((item) => item.parentId === entityId)
      const include = includeDescendantTargetIds.includes(entityId)
      return <div className="target-scope-row" key={entityId}>
        <div><strong>{entity.name}</strong><button type="button" className="remove-target" onClick={() => toggle(entityId)}>×</button></div>
        {hasChildren ? <div className="segmented two mini-segment"><button type="button" className={!include ? 'selected' : ''} onClick={() => setScope(entityId, false)}>{t('onlyThis')}</button><button type="button" className={include ? 'selected' : ''} onClick={() => setScope(entityId, true)}>{t('areaAndContents')}</button></div> : <small className="muted">{t('onlyThis')}</small>}
      </div>
    })}</div>}

    <details className="advanced-details target-list-fallback"><summary>{t('chooseFromList')}</summary><div className="check-list">{entities.map((entity) => <label className="check-row" key={entity.id}><input type="checkbox" checked={targets.includes(entity.id)} onChange={() => toggle(entity.id)} /><span>{entity.name}</span><small>{data.entityTypes.find((type) => type.id === entity.typeId)?.name}</small></label>)}</div></details>
  </div>
}
