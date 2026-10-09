import { SvgCharacter } from '../../visual/SvgCharacter'
import { useI18n } from '../../contexts/I18nContext'
import { CleanlinessPanel } from '../overview/CleanlinessPanel'

interface HomeStatusHeaderProps {
  editMode: boolean
  hasScenes: boolean
  regular: number | null
  deep: number | null
  onToggleEdit: () => void
}

/** V2 brand framing for Home. The edit canvas is never ornamented or textured. */
export function HomeStatusHeader({ editMode, hasScenes, regular, deep, onToggleEdit }: HomeStatusHeaderProps) {
  const { t } = useI18n()
  return <div className={`v2-home-status ${editMode ? 'editing' : 'viewing'}`}>
    <header className="v2-home-hero page-title-row">
      <div className="v2-home-hero-copy">
        <span className="v2-print-eyebrow">HOUSE CARE · V2</span>
        <h1 className="hc-display">{editMode ? t('editHome') : t('home')}</h1>
        {!editMode && <p className="v2-home-hero-subtitle">{t('homeCockpit')}</p>}
      </div>
      {!editMode && hasScenes && <div className="v2-home-hero-art" aria-hidden="true"><SvgCharacter id="house" decorative expression="joyful" pose="thumbs-up" misregistration={false} /></div>}
      {hasScenes && <button type="button" className={`button ${editMode ? 'primary' : 'secondary'} small v2-home-edit-toggle`} onClick={onToggleEdit}>
        {editMode ? t('doneEditing') : t('editHome')}
      </button>}
    </header>
    {hasScenes && <section className="v2-home-summary" aria-label={t('homeCleanliness')}>
      <CleanlinessPanel channel="regular" score={regular} />
      <CleanlinessPanel channel="deep" score={deep} />
    </section>}
  </div>
}
