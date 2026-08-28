import type { AdvancedTargetSelector, TargetSelectorCondition, WorkspaceData } from '../types/domain'
import { useI18n } from '../contexts/I18nContext'

export function AdvancedTargetBuilder({ data, value, onChange }: { data: WorkspaceData; value?: AdvancedTargetSelector; onChange: (value?: AdvancedTargetSelector) => void }) {
  const { t, locale } = useI18n()
  const selector = value ?? { match: 'all' as const, conditions: [] }
  const activeEntities = data.entities.filter((item) => !item.archivedAt)
  const types = data.entityTypes.filter((item) => !item.archivedAt)
  const labels = [...new Set(activeEntities.flatMap((item) => item.labels))].sort((a, b) => a.localeCompare(b))

  function setConditions(conditions: TargetSelectorCondition[]) {
    onChange(conditions.length ? { ...selector, conditions } : undefined)
  }

  function add(kind: TargetSelectorCondition['kind']) {
    if (kind === 'type' && types[0]) setConditions([...selector.conditions, { kind, typeId: types[0].id }])
    else if (kind === 'label') setConditions([...selector.conditions, { kind, label: labels[0] ?? '' }])
    else if (kind === 'descendant_of' && activeEntities[0]) setConditions([...selector.conditions, { kind, entityId: activeEntities[0].id, includeRoot: false }])
  }

  function update(index: number, condition: TargetSelectorCondition) {
    setConditions(selector.conditions.map((item, itemIndex) => itemIndex === index ? condition : item))
  }

  return <div className="advanced-rule-box stack">
    <p className="muted compact-text">{locale === 'it' ? 'Aggiunge automaticamente gli oggetti che corrispondono. Nessun codice o formula.' : 'Automatically adds matching home items. No code or formulas.'}</p>
    {selector.conditions.length > 1 && <div className="segmented two"><button type="button" className={selector.match === 'all' ? 'selected' : ''} onClick={() => onChange({ ...selector, match: 'all' })}>{t('matchAll')}</button><button type="button" className={selector.match === 'any' ? 'selected' : ''} onClick={() => onChange({ ...selector, match: 'any' })}>{t('matchAny')}</button></div>}
    <div className="rule-list">{selector.conditions.map((condition, index) => <div className="rule-row" key={`${condition.kind}-${index}`}>
      <select value={condition.kind} onChange={(event) => {
        const kind = event.target.value as TargetSelectorCondition['kind']
        if (kind === 'type') update(index, { kind, typeId: types[0]?.id ?? '' })
        else if (kind === 'label') update(index, { kind, label: labels[0] ?? '' })
        else update(index, { kind, entityId: activeEntities[0]?.id ?? '', includeRoot: false })
      }}><option value="type">{t('targetType')}</option><option value="label">{t('targetLabel')}</option><option value="descendant_of">{t('insideArea')}</option></select>
      {condition.kind === 'type' && <select value={condition.typeId} onChange={(event) => update(index, { ...condition, typeId: event.target.value })}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>}
      {condition.kind === 'label' && <input list="house-labels" value={condition.label} placeholder={t('label')} onChange={(event) => update(index, { ...condition, label: event.target.value })} />}
      {condition.kind === 'descendant_of' && <><select value={condition.entityId} onChange={(event) => update(index, { ...condition, entityId: event.target.value })}>{activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select><label className="inline-check"><input type="checkbox" checked={condition.includeRoot} onChange={(event) => update(index, { ...condition, includeRoot: event.target.checked })} />{t('includeAreaItself')}</label></>}
      <button type="button" className="icon-button danger-text" onClick={() => setConditions(selector.conditions.filter((_, itemIndex) => itemIndex !== index))}>×</button>
    </div>)}</div>
    <datalist id="house-labels">{labels.map((label) => <option value={label} key={label} />)}</datalist>
    <div className="rule-add-row"><button type="button" className="button secondary small" disabled={!types.length} onClick={() => add('type')}>+ {t('targetType')}</button><button type="button" className="button secondary small" onClick={() => add('label')}>+ {t('targetLabel')}</button><button type="button" className="button secondary small" disabled={!activeEntities.length} onClick={() => add('descendant_of')}>+ {t('insideArea')}</button></div>
  </div>
}
