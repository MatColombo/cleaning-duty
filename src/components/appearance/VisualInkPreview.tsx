import { useMemo } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import type { ThemePalette } from '../../lib/theme'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { deriveVisualInkRoles } from '../../visual/VisualPaletteAdapter'
import { vectorPaletteFromTheme } from '../../visual/palette'

const inkKeys = ['paper', 'outline', 'primary', 'warning', 'overdue', 'soft'] as const

/** Purely informative live preview. Changes to art inks are never saved as theme settings. */
export function VisualInkPreview({ theme }: { theme: ThemePalette }) {
  const { t } = useI18n()
  const inks = useMemo(() => deriveVisualInkRoles(theme), [theme])
  const vector = useMemo(() => vectorPaletteFromTheme(theme), [theme])
  return <div className="v2-ink-preview" style={{ background: theme.surface, color: inks.outline }}>
    <div className="v2-ink-preview-head">
      <strong>{t('artPalettePreview')}</strong>
      <p>{t('artPalettePreviewHint')}</p>
    </div>
    <div className="v2-ink-preview-content">
      <div className="v2-ink-preview-art" aria-hidden="true" style={{ background: inks.paper }}>
        <SvgCharacter id="house" instanceKey="settings-art-palette-house" decorative expression="proud" pose="thumbs-up" palette={vector} misregistration={false} />
        <SvgCharacter id="spray-bottle" instanceKey="settings-art-palette-spray" decorative expression="smile" pose="wave" palette={vector} misregistration={false} />
      </div>
      <div className="v2-ink-preview-swatches">
        {inkKeys.map((key) => <div key={key} className="v2-ink-preview-swatch">
          <span className="v2-ink-chip" style={{ background: inks[key], borderColor: inks.outline }} aria-hidden="true" />
          <span>{t(({ paper:'artInkPaper',outline:'artInkOutline',primary:'artInkPrimary',warning:'artInkWarning',overdue:'artInkOverdue',soft:'artInkSoft' } as const)[key])}</span>
          <code>{inks[key]}</code>
        </div>)}
      </div>
    </div>
    {inks.adjustedRoles.length > 0 && <p className="v2-ink-preview-note">{t('artInkContrastNote')}</p>}
  </div>
}
