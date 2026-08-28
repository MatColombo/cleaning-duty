import { useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { FormField } from '../components/FormField'
import { MetadataFields } from '../components/MetadataFields'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { formatTaskDateTime } from '../lib/date'
import type { MetadataValue, StockStatus, Supply } from '../types/domain'

const statuses: StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']

export function SuppliesPage() {
  const { data, addSupply, updateSupply, setSupplyStatus, archiveSupply } = useData()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supply | null>(null)
  const [historySupply, setHistorySupply] = useState<Supply | null>(null)
  if (!data) return null
  const supplies = data.supplies.filter((item) => !item.archivedAt)

  function statusLabel(status: StockStatus) {
    if (status === 'available') return t('available')
    if (status === 'low') return t('low')
    if (status === 'reserve_only') return t('reserveOnly')
    return t('outOfStock')
  }

  return <div className="stack page-stack">
    <header className="page-title-row"><div><div className="eyebrow">{t('stock')}</div><h1>{t('supplies')}</h1></div><button className="button primary small" onClick={() => { setEditing(null); setOpen(true) }}>+ {t('addSupply')}</button></header>
    {!supplies.length ? <EmptyState>{t('noSupplies')}</EmptyState> : <div className="card-list">{supplies.map((supply) => {
      const inUse = data.actions.some((action) => !action.archivedAt && action.defaultSupplyIds.includes(supply.id))
        || data.routines.some((routine) => !routine.archivedAt && routine.supplyIdsOverride?.includes(supply.id))
      return <article className="card supply-card" key={supply.id}>
        <div className="supply-top"><div className="list-icon">{supply.icon || '◫'}</div><div className="list-grow"><h2>{supply.name}</h2><button className={`stock-badge stock-${supply.status}`} onClick={() => setHistorySupply(supply)}>{statusLabel(supply.status)}</button>{supply.quantity != null && <small className="secondary-detail">{supply.quantity}{supply.unit ? ` ${supply.unit}` : ''}</small>}</div><div className="row-actions"><button className="icon-button" onClick={() => { setEditing(supply); setOpen(true) }}>{t('edit')}</button><button className="icon-button danger-text" disabled={inUse} onClick={() => void archiveSupply(supply.id)}>{t('archive')}</button></div></div>
        <div className="stock-quick" aria-label={t('reportStock')}>{statuses.map((status) => <button key={status} className={supply.status === status ? 'selected' : ''} title={statusLabel(status)} aria-label={statusLabel(status)} onClick={() => void setSupplyStatus(supply.id, status)}><span className={`stock-dot stock-${status}`} />{statusLabel(status)}</button>)}</div>
      </article>
    })}</div>}
    {open && <SupplySheet supply={editing} onClose={() => { setOpen(false); setEditing(null) }} />}
    {historySupply && <HistorySheet supply={historySupply} onClose={() => setHistorySupply(null)} />}
  </div>

  function SupplySheet({ supply, onClose }: { supply: Supply | null; onClose: () => void }) {
    const fields = data!.fieldDefinitions.filter((field) => !field.archivedAt && field.target === 'supply')
    const [name, setName] = useState(supply?.name ?? '')
    const [icon, setIcon] = useState(supply?.icon ?? '')
    const [status, setStatus] = useState<StockStatus>(supply?.status ?? 'available')
    const [quantity, setQuantity] = useState(supply?.quantity?.toString() ?? '')
    const [unit, setUnit] = useState(supply?.unit ?? '')
    const [metadata, setMetadata] = useState<Record<string, MetadataValue>>(supply?.metadata ?? {})
    async function submit(event: FormEvent) {
      event.preventDefault()
      const input = { name: name.trim(), icon: icon.trim() || undefined, status, quantity: quantity === '' ? undefined : Number(quantity), unit: unit.trim() || undefined, metadata }
      if (supply) await updateSupply(supply.id, input); else await addSupply(input)
      onClose()
    }
    return <Sheet title={supply ? t('edit') : t('addSupply')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label={t('icon')}><input maxLength={4} value={icon} onChange={(event) => setIcon(event.target.value)} /></FormField>
      <fieldset className="field-group"><legend>{t('currentStock')}</legend><div className="stock-choice-grid">{statuses.map((item) => <button type="button" key={item} className={status === item ? 'choice-card selected' : 'choice-card'} onClick={() => setStatus(item)}><span className={`stock-dot stock-${item}`} />{statusLabel(item)}</button>)}</div></fieldset>
      <details className="advanced-details"><summary>{t('advanced')}</summary><div className="stack detail-body"><FormField label={t('quantityOptional')}><input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></FormField><FormField label={t('unitOptional')}><input value={unit} onChange={(event) => setUnit(event.target.value)} /></FormField></div></details>
      <MetadataFields definitions={fields} values={metadata} onChange={setMetadata} />
      <button className="button primary">{t('save')}</button>
    </form></Sheet>
  }

  function HistorySheet({ supply, onClose }: { supply: Supply; onClose: () => void }) {
    const events = data!.supplyEvents.filter((event) => event.supplyId === supply.id).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return <Sheet title={`${supply.name} · ${t('stockHistory')}`} onClose={onClose}><div className="timeline">{events.map((event) => <div className="timeline-item" key={event.id}><span>{event.type === 'STOCK_CHANGED' ? `${String(event.metadata.from ?? '—')} → ${String(event.metadata.to ?? '—')}` : event.type.replaceAll('_', ' ').toLowerCase()}</span><small>{formatTaskDateTime(event.at, locale, data!.workspace.timezone)}</small></div>)}</div></Sheet>
  }
}
