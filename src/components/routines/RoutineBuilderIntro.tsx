import { useI18n } from '../../contexts/I18nContext'
import type { Routine, WorkspaceData } from '../../types/domain'
import { RoutineIdentityArtwork } from './RoutineIdentityArtwork'

/** Decorative banner outside all form fields. No artwork controls, no persisted overrides. */
export function RoutineBuilderIntro({ routine, data, editing }: {
  routine: Pick<Routine, 'id' | 'actionId' | 'name' | 'targetEntityIds'>
  data: WorkspaceData
  editing: boolean
}) {
  const { t, locale } = useI18n()
  return <header className="v2-routine-builder-intro">
    <div>
      <span className="v2-print-eyebrow">HOUSE CARE · {t('routines')}</span>
      <p className="hc-display v2-routine-builder-intro-title">{editing ? t('edit') : t('addRoutine')}</p>
      <p className="v2-routine-builder-intro-desc">{locale === 'it'
        ? 'Definisci la cura della casa: che cosa, dove, quando e a chi assegnarla.'
        : 'Define the care: what, where, when and who will handle it.'}</p>
      <span className="v2-routine-builder-seal">{locale === 'it' ? 'ARTE AUTOMATICA · ANTEPRIMA' : 'AUTO ART · PREVIEW'}</span>
    </div>
    <RoutineIdentityArtwork routine={routine} data={data} compact />
  </header>
}
