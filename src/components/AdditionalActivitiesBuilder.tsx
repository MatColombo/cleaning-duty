import { FormField } from './FormField'
import { RoutineTargetPicker } from './RoutineTargetPicker'
import { useI18n } from '../contexts/I18nContext'
import { newId } from '../lib/id'
import type { AdditionalActivityInput, WorkspaceData } from '../types/domain'

export function AdditionalActivitiesBuilder({ data, value, onChange, defaultTargets }: {
  data: WorkspaceData
  value: AdditionalActivityInput[]
  onChange: (value: AdditionalActivityInput[]) => void
  defaultTargets: string[]
}) {
  const { t } = useI18n()
  const actions = data.actions.filter((action) => !action.archivedAt)
  const supplies = data.supplies.filter((supply) => !supply.archivedAt)
  function patch(index: number, update: Partial<AdditionalActivityInput>) {
    onChange(value.map((item, i) => i === index ? { ...item, ...update } : item))
  }
  function add() {
    onChange([...value, {
      id: newId(), name: '', actionId: actions[0]?.id ?? '', targetEntityIds: [...defaultTargets],
      includeDescendantTargetIds: [], every: 3, careLevel: 'routine', affectsCleanliness: true, refreshLevelPct: 100,
    }])
  }
  return <div className="stack additional-activities-builder">
    <p className="muted compact-text">{t('additionalActivitiesHint')}</p>
    {value.map((item, index) => {
      const action = actions.find((candidate) => candidate.id === item.actionId)
      const inherited = item.supplyIdsOverride === undefined
      return <fieldset className="additional-activity" key={item.id ?? index}>
        <legend>{t('additionalActivity')} {index + 1}</legend>
        <div className="additional-top-row">
          <FormField label={t('everyParentTriggers')}><input required type="number" min={1} max={100} step={1} value={item.every} onChange={(event) => patch(index, { every: Number(event.target.value) })} /></FormField>
          <button className="button ghost small danger-text" type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>{t('removeAdditional')}</button>
        </div>
        <FormField label={t('activityTitle')}><input required value={item.name} placeholder={t('additionalExample')} onChange={(event) => patch(index, { name: event.target.value })} /></FormField>
        <FormField label={t('action')}><select value={item.actionId} required onChange={(event) => patch(index, { actionId: event.target.value })}>{actions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></FormField>
        <section aria-label={t('where')}><h3>{t('where')}</h3><RoutineTargetPicker data={data} targets={item.targetEntityIds} includeDescendantTargetIds={item.includeDescendantTargetIds} onChange={(targets, scope) => patch(index, { targetEntityIds: targets, includeDescendantTargetIds: scope })} /></section>
        <FormField label={t('cleaningLevel')}><select value={item.careLevel} onChange={(event) => patch(index, { careLevel: event.target.value === 'deep' ? 'deep' : 'routine' })}><option value="routine">{t('routineCleaning')}</option><option value="deep">{t('deepCleaning')}</option></select></FormField>
        <label className="check-row cleanliness-toggle"><input type="checkbox" checked={item.affectsCleanliness} onChange={(event) => patch(index, { affectsCleanliness: event.target.checked })} /><span><strong>{t('affectsCleanliness')}</strong><small>{t('affectsCleanlinessHint')}</small></span></label>
        {item.affectsCleanliness && <FormField label={t('refreshTo')}><input type="number" min={10} max={100} step={5} value={item.refreshLevelPct} onChange={(event) => patch(index, { refreshLevelPct: Number(event.target.value) })} /></FormField>}
        <FormField label={t('supplies')}><select value={inherited ? 'inherit' : 'custom'} onChange={(event) => patch(index, { supplyIdsOverride: event.target.value === 'inherit' ? undefined : [...(action?.defaultSupplyIds ?? [])] })}><option value="inherit">{t('inheritActionSupplies')}</option><option value="custom">{t('customSupplies')}</option></select></FormField>
        {inherited ? <p className="muted compact-text">{(action?.defaultSupplyIds ?? []).map((id) => supplies.find((supply) => supply.id === id)?.name).filter(Boolean).join(', ') || t('noRequiredProducts')}</p> : <div className="check-list">{supplies.map((supply) => <label className="check-row" key={supply.id}><input type="checkbox" checked={item.supplyIdsOverride?.includes(supply.id) ?? false} onChange={(event) => patch(index, { supplyIdsOverride: event.target.checked ? [...(item.supplyIdsOverride ?? []), supply.id] : item.supplyIdsOverride?.filter((id) => id !== supply.id) ?? [] })} /><span>{supply.name}</span><span className={`stock-dot stock-${supply.status}`} /></label>)}{!supplies.length && <p className="muted compact-text">{t('noRequiredProducts')}</p>}</div>}
        <p className="muted compact-text">{t('additionalInheritanceHint')}</p>
      </fieldset>
    })}
    <button className="button secondary align-start" type="button" disabled={!actions.length} onClick={add}>+ {t('addAdditionalActivity')}</button>
  </div>
}
