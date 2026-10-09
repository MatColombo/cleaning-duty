import { useI18n } from '../../contexts/I18nContext'
import type { ActionDefinition, Routine, Supply } from '../../types/domain'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { actionLibraryVisual, activeActionReferences } from './actionPresentation'

interface Props {
  action: ActionDefinition
  supplies: readonly Supply[]
  routines: readonly Routine[]
  onEdit: (action: ActionDefinition) => void
  onArchive: (id: string) => void
}

export function ActionLibraryCard({ action, supplies, routines, onEdit, onArchive }: Props) {
  const { t, locale } = useI18n()
  const artwork = actionLibraryVisual(action)
  const used = activeActionReferences(action.id, routines)
  const supplyNames = action.defaultSupplyIds.map((id) => supplies.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const labels = locale === 'it'
    ? { noSupplies: 'Nessun prodotto predefinito', inUse: 'Utilizzata da una routine attiva o conservata',
        category: 'Famiglia visiva', revision: 'Revisione' }
    : { noSupplies: 'No default supplies', inUse: 'In use by a non-archived routine',
        category: 'Visual family', revision: 'Revision' }
  return <article className="card v2-action-card">
    <div className={`v2-action-art v2-ink-${artwork.ink}`} aria-hidden="true">
      <span className="v2-action-art-star">✦</span>
      <SvgCharacter id={artwork.subjectId} instanceKey={artwork.identityKey} decorative
        expression={artwork.expression} pose={artwork.pose} misregistration={false} />
    </div>
    <div className="v2-action-card-body">
      <div className="v2-action-card-kicker"><span className="v2-print-eyebrow">{labels.category} · {artwork.family.replaceAll('-', ' ')}</span>{action.icon && <span className="v2-action-original-icon" aria-label={t('icon')}>{action.icon}</span>}</div>
      <h2 className="hc-card-title">{action.name}</h2>
      {action.instructions && <p className="v2-action-instructions">{action.instructions}</p>}
      <div className="v2-action-supplies"><strong>{t('defaultSupplies')}</strong><p>{supplyNames.length ? supplyNames.join(' · ') : labels.noSupplies}</p></div>
      <div className="v2-action-card-actions">
        <small className="v2-action-revision">{labels.revision} {action.revision}</small>
        <button type="button" className="button primary small" onClick={() => onEdit(action)}>{t('edit')}</button>
        <button type="button" className="button ghost small danger-text" disabled={used} title={used ? labels.inUse : t('archive')}
          onClick={() => onArchive(action.id)}>{t('archive')}</button>
      </div>
    </div>
  </article>
}
