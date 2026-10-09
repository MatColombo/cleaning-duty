import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { RoutineBuilderSheet } from '../components/routines/RoutineBuilderSheet'
import { RoutineLibraryCard } from '../components/routines/RoutineLibraryCard'
import { filterRoutinesForLibrary, parentRoutines, routineLibraryCounts, type RoutineCareFilter, type RoutineStatusFilter } from '../components/routines/routinePresentation'
import { SvgCharacter } from '../visual/SvgCharacter'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import type { Routine } from '../types/domain'

/** V2 library owns filtering and configuration actions, not recurrence or occurrences. */
export function RoutinesPage() {
  const { data, archiveRoutine, setRoutineStatus } = useData()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Routine | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RoutineStatusFilter>('all')
  const [careFilter, setCareFilter] = useState<RoutineCareFilter>('all')
  if (!data) return null

  const parents = parentRoutines(data)
  const counts = routineLibraryCounts(parents)
  const displayed = filterRoutinesForLibrary(parents, data, search, statusFilter, careFilter)
  const hasPrerequisites = data.actions.some((action) => !action.archivedAt) && data.entities.some((item) => !item.archivedAt)
  const labels = locale === 'it'
    ? { kicker: 'LA TUA COLLEZIONE DI CURE', subtitle: 'Ogni casa ha il suo ritmo. Ecco le cure che lo mantengono.',
        regular: 'Ordinarie attive', deep: 'Profonde attive', paused: 'In pausa', search: 'Cerca routine, azioni o oggetti', results: 'Routine trovate',
        filteredEmpty: 'Nessuna routine corrisponde ai filtri.', clear: 'Ripristina filtri', status: 'Stato', channel: 'Tipo di pulizia' }
    : { kicker: 'YOUR CARE LIBRARY', subtitle: 'Every home has a rhythm. These routines keep it going.',
        regular: 'Regular active', deep: 'Deep active', paused: 'Paused', search: 'Search routines, actions or items', results: 'Routines found',
        filteredEmpty: 'No routines match those filters.', clear: 'Clear filters', status: 'Status', channel: 'Cleaning level' }

  function openEditor(routine: Routine | null) { setEditing(routine); setOpen(true) }
  function closeEditor() { setOpen(false); setEditing(null) }
  function resetFilters() { setSearch(''); setStatusFilter('all'); setCareFilter('all') }

  return <div className="stack page-stack v2-routines-page">
    <header className="v2-routines-hero">
      <div className="v2-routines-hero-copy">
        <span className="v2-print-eyebrow">HOUSE CARE · {labels.kicker}</span>
        <h1 className="hc-display">{t('routines')}</h1>
        <p>{labels.subtitle}</p>
        <div className="inline-links"><Link className="text-link" to="/actions">{t('actions')}</Link><Link className="text-link" to="/supplies">{t('supplies')}</Link></div>
      </div>
      <div className="v2-routines-hero-art" aria-hidden="true"><SvgCharacter id="sofa" decorative expression="joyful" pose="thumbs-up" misregistration={false} /></div>
      <button type="button" className="button primary v2-routines-add" disabled={!hasPrerequisites} onClick={() => openEditor(null)}>+ {t('addRoutine')}</button>
    </header>
    {!hasPrerequisites && <div className="notice">{locale === 'it' ? 'Crea almeno un’azione e un luogo/oggetto prima di creare una routine.' : 'Create at least one action and one place/item before creating a routine.'}</div>}
    <div className="v2-routines-summary" aria-label={t('routines')}>
      <div className="v2-routines-stat regular"><span>{labels.regular}</span><strong className="hc-tabular-numerals">{counts.regularActive}</strong><span className="v2-routines-stat-emote" aria-hidden="true">✦</span></div>
      <div className="v2-routines-stat deep"><span>{labels.deep}</span><strong className="hc-tabular-numerals">{counts.deepActive}</strong><span className="v2-routines-stat-emote" aria-hidden="true">✳</span></div>
      <div className="v2-routines-stat paused"><span>{labels.paused}</span><strong className="hc-tabular-numerals">{counts.paused}</strong><span className="v2-routines-stat-emote" aria-hidden="true">◌</span></div>
    </div>
    {parents.length > 0 && <section className="v2-routines-filters" aria-label={locale === 'it' ? 'Filtri routine' : 'Routine filters'}>
      <label className="v2-routines-search"><span className="v2-routine-visually-hidden">{labels.search}</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} aria-label={labels.search} />
      </label>
      <div className="v2-routines-filter-groups">
        <div className="v2-routines-filter-group" role="group" aria-label={labels.status}>
          {(['all', 'active', 'paused', 'ended'] as const).map((value) => <button key={value} type="button" aria-pressed={statusFilter === value} className={statusFilter === value ? 'selected' : ''} onClick={() => setStatusFilter(value)}>{value === 'all' ? t('all') : value === 'active' ? t('active') : value === 'paused' ? t('paused') : t('ended')}</button>)}
        </div>
        <div className="v2-routines-filter-group" role="group" aria-label={labels.channel}>
          {(['all', 'routine', 'deep'] as const).map((value) => <button key={value} type="button" aria-pressed={careFilter === value} className={careFilter === value ? 'selected' : ''} onClick={() => setCareFilter(value)}>{value === 'all' ? t('all') : value === 'deep' ? t('deepCleaning') : t('routineCleaning')}</button>)}
        </div>
      </div>
    </section>}
    {parents.length === 0 ? <EmptyState>{t('noRoutines')}</EmptyState> : displayed.length === 0
      ? <div className="v2-routines-filter-empty"><p>{labels.filteredEmpty}</p><button type="button" className="button secondary small" onClick={resetFilters}>{labels.clear}</button></div>
      : <section className="v2-routines-library" aria-label={t('routines')}>
          <div className="v2-routines-library-heading"><h2 className="hc-display">{t('routines')}</h2><span>{labels.results}: {displayed.length}</span></div>
          <div className="v2-routines-list">{displayed.map((routine) => <RoutineLibraryCard key={routine.id} routine={routine} data={data}
            onEdit={(value) => openEditor(value)} onStatusChange={(id, status) => { void setRoutineStatus(id, status) }}
            onArchive={(id) => { void archiveRoutine(id) }} />)}</div>
        </section>}
    {open && <RoutineBuilderSheet key={editing?.id ?? 'new'} routine={editing} data={data} onClose={closeEditor} />}
  </div>
}
