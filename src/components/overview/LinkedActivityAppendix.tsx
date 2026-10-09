import type { TaskOccurrence } from '../../types/domain'
import { useI18n } from '../../contexts/I18nContext'

export function LinkedActivityAppendix({ children, onOpen }: { children: TaskOccurrence[]; onOpen: (taskId: string) => void }) {
  const { t } = useI18n()
  if (!children.length) return null
  return <section className="v2-extra-care" aria-label={t('additionalActivities')}>
    <strong><span aria-hidden="true">✦</span> {t('extraCare')}</strong>
    <div className="v2-extra-care-children">{children.map((child) => <button type="button" key={child.id} onClick={() => onOpen(child.id)}>
      <span>{child.routineNameSnapshot || child.actionNameSnapshot}</span>
      <span className="v2-extra-care-status">{t(child.state === 'completed' ? 'completed' : child.state === 'skipped' ? 'skipped' : 'toDo')} ↗</span>
    </button>)}</div>
  </section>
}
