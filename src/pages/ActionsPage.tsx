import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ActionEditorSheet } from '../components/actions/ActionEditorSheet'
import { ActionLibraryCard } from '../components/actions/ActionLibraryCard'
import { actionLibraryVisual, filterActionLibrary } from '../components/actions/actionPresentation'
import { SvgCharacter } from '../visual/SvgCharacter'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import type { ActionDefinition } from '../types/domain'
import type { ActionFamily } from '../visual/procedural/taxonomy'

/** V2 Actions surface. Definition mutations stay exclusively in DataContext. */
export function ActionsPage() {
  const { data, addAction, updateAction, archiveAction } = useData()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ActionDefinition | null>(null)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<ActionFamily | 'all'>('all')
  if (!data) return null

  const actions = data.actions.filter((action) => !action.archivedAt)
  const supplies = data.supplies.filter((supply) => !supply.archivedAt)
  const families = [...new Set(actions.map((action) => actionLibraryVisual(action).family))].sort()
  const displayed = filterActionLibrary(actions, supplies, query, family)
  const labels = locale === 'it'
    ? { subtitle: 'Un atlante di gesti per prenderti cura della casa.', kicker: 'LA LIBRERIA DEI GESTI', search: 'Cerca azioni, istruzioni o prodotti', category: 'Famiglia', results: 'Azioni trovate', none: 'Nessuna azione corrisponde ai filtri.', clear: 'Ripristina filtri' }
    : { subtitle: 'Your illustrated toolbox for taking care of the home.', kicker: 'THE CARE TOOLBOX', search: 'Search actions, instructions or supplies', category: 'Family', results: 'Actions found', none: 'No actions match these filters.', clear: 'Clear filters' }
  function openEditor(action: ActionDefinition | null) { setEditing(action); setOpen(true) }
  function closeEditor() { setEditing(null); setOpen(false) }

  return <div className="stack page-stack v2-actions-page">
    <header className="v2-library-hero v2-action-hero">
      <div className="v2-library-hero-copy"><span className="v2-print-eyebrow">HOUSE CARE · {labels.kicker}</span><h1 className="hc-display">{t('actions')}</h1><p>{labels.subtitle}</p><Link to="/routines" className="text-link">{t('routines')} ↗</Link></div>
      <div className="v2-library-hero-art" aria-hidden="true"><SvgCharacter id="scrub-brush" decorative expression="proud" pose="thumbs-up" misregistration={false} /></div>
      <button type="button" className="button primary v2-library-add" onClick={() => openEditor(null)}>+ {t('addAction')}</button>
    </header>
    {actions.length > 0 && <section className="v2-library-controls" aria-label={t('actions')}>
      <label className="v2-library-search"><span className="v2-sr-only">{labels.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} aria-label={labels.search} /></label>
      <label className="v2-library-select">{labels.category}<select value={family} onChange={(event) => setFamily(event.target.value as ActionFamily | 'all')}><option value="all">{t('all')}</option>{families.map((value) => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select></label>
    </section>}
    {actions.length === 0 ? <EmptyState>{t('noActions')}</EmptyState> : displayed.length === 0
      ? <div className="v2-library-empty"><p>{labels.none}</p><button type="button" className="button secondary small" onClick={() => { setQuery(''); setFamily('all') }}>{labels.clear}</button></div>
      : <section className="v2-actions-library" aria-label={t('actions')}><div className="v2-library-section-head"><h2 className="hc-display">{t('actions')}</h2><span>{labels.results}: {displayed.length}</span></div>
        <div className="v2-action-grid">{displayed.map((action) => <ActionLibraryCard key={action.id} action={action} supplies={supplies} routines={data.routines} onEdit={openEditor} onArchive={(id) => { void archiveAction(id) }} />)}</div>
      </section>}
    {open && <ActionEditorSheet key={editing?.id ?? 'new'} action={editing} data={data} onClose={closeEditor} addAction={addAction} updateAction={updateAction} />}
  </div>
}
