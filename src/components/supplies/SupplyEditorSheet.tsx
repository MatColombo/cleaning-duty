import { useState, type FormEvent } from 'react'
import { FormField } from '../FormField'
import { MetadataFields } from '../MetadataFields'
import { Sheet } from '../Sheet'
import { useI18n } from '../../contexts/I18nContext'
import type { MetadataValue, StockStatus, Supply, WorkspaceData } from '../../types/domain'

const statuses: readonly StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
interface SupplyInput {
  name: string; icon?: string; status: StockStatus; quantity?: number; unit?: string; metadata: Record<string, MetadataValue>
}
interface Props {
  supply: Supply | null
  data: WorkspaceData
  onClose: () => void
  addSupply: (input: SupplyInput) => Promise<void>
  updateSupply: (id: string, input: SupplyInput) => Promise<void>
}

/** Preserve the original Supply form fields and updateSupply semantics. */
export function SupplyEditorSheet({ supply, data, onClose, addSupply, updateSupply }: Props) {
  const { t, locale } = useI18n()
  const fields = data.fieldDefinitions.filter((field) => !field.archivedAt && field.target === 'supply')
  const [name, setName] = useState(supply?.name ?? '')
  const [icon, setIcon] = useState(supply?.icon ?? '')
  const [status, setStatus] = useState<StockStatus>(supply?.status ?? 'available')
  const [quantity, setQuantity] = useState(supply?.quantity?.toString() ?? '')
  const [unit, setUnit] = useState(supply?.unit ?? '')
  const [metadata, setMetadata] = useState<Record<string, MetadataValue>>(supply?.metadata ?? {})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  function statusLabel(value: StockStatus) {
    return value === 'available' ? t('available') : value === 'low' ? t('low') : value === 'reserve_only' ? t('reserveOnly') : t('outOfStock')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const input = { name: name.trim(), icon: icon.trim() || undefined, status,
      quantity: quantity === '' ? undefined : Number(quantity), unit: unit.trim() || undefined, metadata }
    setSaving(true)
    setSaveError(false)
    try {
      if (supply) await updateSupply(supply.id, input); else await addSupply(input)
      onClose()
    } catch { setSaveError(true) } finally { setSaving(false) }
  }
  return <Sheet title={supply ? t('edit') : t('addSupply')} onClose={onClose}><div className="v2-library-editor">
    <div className="v2-library-editor-intro"><span className="v2-print-eyebrow">HOUSE CARE · {locale === 'it' ? 'ARMADIETTO DELLE SCORTE' : 'SUPPLY CABINET'}</span><p>{locale === 'it' ? 'Lo stato qualitativo resta il segnale principale. La quantità è facoltativa.' : 'Qualitative stock status is primary. Quantity is optional.'}</p></div>
    <form className="stack" onSubmit={(event) => { void submit(event) }}>
      <FormField label={t('name')}><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label={t('icon')}><input maxLength={4} value={icon} onChange={(event) => setIcon(event.target.value)} /></FormField>
      <fieldset className="field-group"><legend>{t('currentStock')}</legend><div className="stock-choice-grid">{statuses.map((item) => <button type="button" key={item} className={status === item ? 'choice-card selected' : 'choice-card'} aria-pressed={status === item}
        onClick={() => setStatus(item)}><span className={`stock-dot stock-${item}`} />{statusLabel(item)}</button>)}</div></fieldset>
      <details className="advanced-details"><summary>{t('advanced')}</summary><div className="stack detail-body"><FormField label={t('quantityOptional')}><input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></FormField><FormField label={t('unitOptional')}><input value={unit} onChange={(event) => setUnit(event.target.value)} /></FormField></div></details>
      <MetadataFields definitions={fields} values={metadata} onChange={setMetadata} />
      {saveError && <p className="v2-library-save-error" role="alert">{locale === 'it' ? 'Salvataggio non riuscito. Riprova.' : 'Could not save. Please try again.'}</p>}
      <button type="submit" className="button primary" disabled={saving}>{t('save')}</button>
    </form>
  </div></Sheet>
}
