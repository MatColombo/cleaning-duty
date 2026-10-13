import type { AdditionalActivityAppendixEntry } from '../../lib/presentation'
import { useI18n } from '../../contexts/I18nContext'

/** Informational appendix only. Extras are never independent Care Cards. */
export function LinkedActivityAppendix({ children }: { children: AdditionalActivityAppendixEntry[] }) {
  const { t } = useI18n()
  if (!children.length) return null
  return <section className="v2-extra-care" aria-label={t('additionalActivities')}>
    <strong><span aria-hidden="true">✦</span> {t('extraCare')}</strong>
    <div className="v2-extra-care-children">{children.map(entry => <div className="v2-extra-care-detail" key={entry.routine.id}>
      <span>{entry.routine.name}</span>
      <span className="v2-extra-care-status">{t(entry.status === 'completed' || entry.occurrence?.state === 'completed' ? 'completed' : 'toDo')}</span>
    </div>)}</div>
  </section>
}
