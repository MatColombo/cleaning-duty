import { useState, type FormEvent } from 'react'
import { FormField } from '../FormField'
import { MetadataFields } from '../MetadataFields'
import { Sheet } from '../Sheet'
import { useI18n } from '../../contexts/I18nContext'
import type { ActionDefinition, MetadataValue, WorkspaceData } from '../../types/domain'

interface Props {
  action: ActionDefinition | null
  data: WorkspaceData
  onClose: () => void
  addAction: (input: { name: string; icon?: string; instructions?: string; defaultSupplyIds: string[]; metadata: Record<string, MetadataValue> }) => Promise<void>
  updateAction: (id: string, input: { name: string; icon?: string; instructions?: string; defaultSupplyIds: string[]; metadata: Record<string, MetadataValue> }) => Promise<void>
}

/** Original Action form/payload kept intact. Only the sheet presentation changes. */
export function ActionEditorSheet({ action, data, onClose, addAction, updateAction }: Props) {
  const { t, locale } = useI18n()
  const fields = data.fieldDefinitions.filter((field) => !field.archivedAt && field.target === 'action')
  const supplies = data.supplies.filter((item) => !item.archivedAt)
  const [name, setName] = useState(action?.name ?? '')
  const [icon, setIcon] = useState(action?.icon ?? '')
  const [instructions, setInstructions] = useState(action?.instructions ?? '')
  const [defaultSupplyIds, setDefaultSupplyIds] = useState<string[]>(action?.defaultSupplyIds ?? [])
  const [metadata, setMetadata] = useState<Record<string, MetadataValue>>(action?.metadata ?? {})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const input = { name: name.trim(), icon: icon.trim() || undefined, instructions: instructions.trim() || undefined, defaultSupplyIds, metadata }
    setSaving(true)
    setSaveError(false)
    try {
      if (action) await updateAction(action.id, input); else await addAction(input)
      onClose()
    } catch { setSaveError(true) } finally { setSaving(false) }
  }

  return <Sheet title={action ? t('edit') : t('addAction')} onClose={onClose}>
    <div className="v2-library-editor">
      <div className="v2-library-editor-intro"><span className="v2-print-eyebrow">HOUSE CARE · {locale === 'it' ? 'LIBRERIA AZIONI' : 'ACTION LIBRARY'}</span><p>{locale === 'it' ? 'Definisci il lavoro una volta. Le routine lo riutilizzano.' : 'Define work once. Routines can reuse it.'}</p></div>
      <form className="stack" onSubmit={(event) => { void submit(event) }}>
        <FormField label={t('name')}><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></FormField>
        <FormField label={t('icon')}><input maxLength={4} value={icon} onChange={(event) => setIcon(event.target.value)} /></FormField>
        <FormField label={t('instructions')}><textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></FormField>
        {supplies.length > 0 && <fieldset className="field-group"><legend>{t('defaultSupplies')}</legend><div className="check-list">{supplies.map((supply) => <label className="check-row" key={supply.id}><input type="checkbox" checked={defaultSupplyIds.includes(supply.id)} onChange={(event) => setDefaultSupplyIds(event.target.checked ? [...defaultSupplyIds, supply.id] : defaultSupplyIds.filter((id) => id !== supply.id))} /><span>{supply.name}</span><small>{supply.status === 'reserve_only' ? t('reserveOnly') : supply.status === 'out_of_stock' ? t('outOfStock') : supply.status === 'low' ? t('low') : t('available')}</small></label>)}</div></fieldset>}
        <MetadataFields definitions={fields} values={metadata} onChange={setMetadata} />
        {saveError && <p className="v2-library-save-error" role="alert">{locale === 'it' ? 'Salvataggio non riuscito. Riprova.' : 'Could not save. Please try again.'}</p>}
        <button type="submit" className="button primary" disabled={saving}>{t('save')}</button>
      </form>
    </div>
  </Sheet>
}
