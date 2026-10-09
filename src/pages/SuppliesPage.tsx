import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { SupplyEditorSheet } from '../components/supplies/SupplyEditorSheet'
import { SupplyHistorySheet } from '../components/supplies/SupplyHistorySheet'
import { SupplyLibraryCard } from '../components/supplies/SupplyLibraryCard'
import { activeSupplyReferences, filterSupplyLibrary, supplyStatusCounts } from '../components/supplies/supplyPresentation'
import { SvgCharacter } from '../visual/SvgCharacter'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import type { StockStatus, Supply } from '../types/domain'

const STOCK_ORDER: readonly StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
/** V2 Supplies surface; Stock domain events/mutations are unchanged. */
export function SuppliesPage() {
  const { data, addSupply, updateSupply, setSupplyStatus, archiveSupply } = useData()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supply | null>(null)
  const [historySupply, setHistorySupply] = useState<Supply | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all')
  if (!data) return null
  const supplies = data.supplies.filter((item) => !item.archivedAt)
  const counts = supplyStatusCounts(supplies)
  const displayed = filterSupplyLibrary(supplies, query, statusFilter)
  const statusLabels: Record<StockStatus, string> = {
    available: t('available'), low: t('low'), reserve_only: t('reserveOnly'), out_of_stock: t('outOfStock'),
  }
  const labels = locale === 'it'
    ? { kicker: 'L’ARMADIETTO DI CASA', subtitle: 'Tutti i prodotti per tenere la casa in ordine.',
        search: 'Cerca prodotti o unità', results: 'Prodotti trovati', none: 'Nessun prodotto corrisponde ai filtri.', clear: 'Ripristina filtri', filter: 'Disponibilità' }
    : { kicker: 'THE HOUSEHOLD CABINET', subtitle: 'Your supplies, beautifully organized and ready for work.',
        search: 'Search supplies or units', results: 'Supplies found', none: 'No supplies match these filters.', clear: 'Clear filters', filter: 'Availability' }
  function openEditor(supply: Supply | null) { setEditing(supply); setOpen(true) }
  function closeEditor() { setEditing(null); setOpen(false) }

  return <div className="stack page-stack v2-supplies-page">
    <header className="v2-library-hero v2-supply-hero">
      <div className="v2-library-hero-copy"><span className="v2-print-eyebrow">HOUSE CARE · {labels.kicker}</span><h1 className="hc-display">{t('supplies')}</h1><p>{labels.subtitle}</p><Link to="/actions" className="text-link">{t('actions')} ↗</Link></div>
      <div className="v2-library-hero-art" aria-hidden="true"><SvgCharacter id="spray-bottle" decorative expression="joyful" pose="fist-pump" misregistration={false} /></div>
      <button type="button" className="button primary v2-library-add" onClick={() => openEditor(null)}>+ {t('addSupply')}</button>
    </header>
    {supplies.length > 0 && <section className="v2-supply-overview" aria-label={t('currentStock')}>
      {STOCK_ORDER.map((status) => <button type="button" key={status} className={`v2-supply-count is-${status} ${statusFilter === status ? 'selected' : ''}`}
        aria-pressed={statusFilter === status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}>
        <span className={`stock-dot stock-${status}`} aria-hidden="true"/><strong className="hc-tabular-numerals">{counts[status]}</strong><span>{statusLabels[status]}</span>
      </button>)}
    </section>}
    {supplies.length > 0 && <section className="v2-library-controls" aria-label={t('supplies')}>
      <label className="v2-library-search"><span className="v2-sr-only">{labels.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} aria-label={labels.search}/></label>
      <label className="v2-library-select">{labels.filter}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StockStatus | 'all')}>
        <option value="all">{t('all')}</option>{STOCK_ORDER.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
      </select></label>
    </section>}
    {supplies.length === 0 ? <EmptyState>{t('noSupplies')}</EmptyState> : displayed.length === 0
      ? <div className="v2-library-empty"><p>{labels.none}</p><button type="button" className="button secondary small" onClick={() => { setQuery(''); setStatusFilter('all') }}>{labels.clear}</button></div>
      : <section className="v2-supplies-library" aria-label={t('supplies')}><div className="v2-library-section-head"><h2 className="hc-display">{t('supplies')}</h2><span>{labels.results}: {displayed.length}</span></div>
        <div className="v2-supply-grid">{displayed.map((supply) => <SupplyLibraryCard key={supply.id} supply={supply} inUse={activeSupplyReferences(supply.id, data.actions, data.routines)}
          onEdit={openEditor} onArchive={(id) => { void archiveSupply(id) }} onHistory={setHistorySupply} onStatusChange={setSupplyStatus} />)}</div>
      </section>}
    {open && <SupplyEditorSheet key={editing?.id ?? 'new'} supply={editing} data={data} onClose={closeEditor} addSupply={addSupply} updateSupply={updateSupply} />}
    {historySupply && <SupplyHistorySheet supply={historySupply} data={data} onClose={() => setHistorySupply(null)} />}
  </div>
}
