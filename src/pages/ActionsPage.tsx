import { useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { FormField } from '../components/FormField'
import { MetadataFields } from '../components/MetadataFields'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import type { ActionDefinition, MetadataValue } from '../types/domain'

export function ActionsPage() {
  const { data, addAction, updateAction, archiveAction } = useData()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ActionDefinition | null>(null)
  if (!data) return null
  const actions = data.actions.filter((item) => !item.archivedAt)
  const supplies = data.supplies.filter((item) => !item.archivedAt)

  return <div className="stack page-stack">
    <header className="page-title-row"><div><div className="eyebrow">{t('actions')}</div><h1>{t('actions')}</h1></div><button className="button primary small" onClick={() => { setEditing(null); setOpen(true) }}>+ {t('addAction')}</button></header>
    {!actions.length ? <EmptyState>{t('noActions')}</EmptyState> : <div className="card-list">{actions.map((action) => <article className="card list-card" key={action.id}><div className="list-icon">{action.icon || '↻'}</div><div className="list-grow"><h2>{action.name}</h2>{action.instructions && <p>{action.instructions}</p>}{action.defaultSupplyIds.length > 0 && <p>{t('defaultSupplies')}: {action.defaultSupplyIds.map((id) => supplies.find((supply) => supply.id === id)?.name).filter(Boolean).join(', ')}</p>}</div><div className="row-actions"><button className="icon-button" onClick={() => { setEditing(action); setOpen(true) }}>{t('edit')}</button><button className="icon-button danger-text" disabled={data!.routines.some((routine) => !routine.archivedAt && routine.actionId === action.id)} title={data!.routines.some((routine) => !routine.archivedAt && routine.actionId === action.id) ? 'In use by a routine' : t('archive')} onClick={() => void archiveAction(action.id)}>{t('archive')}</button></div></article>)}</div>}
    {open && <ActionSheet action={editing} onClose={() => { setOpen(false); setEditing(null) }} />}
  </div>

  function ActionSheet({ action, onClose }: { action: ActionDefinition | null; onClose: () => void }) {
    const fields = data!.fieldDefinitions.filter((field) => !field.archivedAt && field.target === 'action')
    const [name, setName] = useState(action?.name ?? '')
    const [icon, setIcon] = useState(action?.icon ?? '')
    const [instructions, setInstructions] = useState(action?.instructions ?? '')
    const [defaultSupplyIds, setDefaultSupplyIds] = useState<string[]>(action?.defaultSupplyIds ?? [])
    const [metadata, setMetadata] = useState<Record<string, MetadataValue>>(action?.metadata ?? {})
    async function submit(event: FormEvent) {
      event.preventDefault()
      const input = { name: name.trim(), icon: icon.trim() || undefined, instructions: instructions.trim() || undefined, defaultSupplyIds, metadata }
      if (action) await updateAction(action.id, input); else await addAction(input)
      onClose()
    }
    return <Sheet title={action ? t('edit') : t('addAction')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label={t('icon')}><input maxLength={4} value={icon} onChange={(e) => setIcon(e.target.value)} /></FormField>
      <FormField label={t('instructions')}><textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></FormField>
      {supplies.length > 0 && <fieldset className="field-group"><legend>{t('defaultSupplies')}</legend><div className="check-list">{supplies.map((supply) => <label className="check-row" key={supply.id}><input type="checkbox" checked={defaultSupplyIds.includes(supply.id)} onChange={(event) => setDefaultSupplyIds(event.target.checked ? [...defaultSupplyIds, supply.id] : defaultSupplyIds.filter((id) => id !== supply.id))} /><span>{supply.name}</span><small>{supply.status === 'reserve_only' ? t('reserveOnly') : supply.status === 'out_of_stock' ? t('outOfStock') : supply.status === 'low' ? t('low') : t('available')}</small></label>)}</div></fieldset>}
      <MetadataFields definitions={fields} values={metadata} onChange={setMetadata} />
      <button className="button primary">{t('save')}</button>
    </form></Sheet>
  }
}
