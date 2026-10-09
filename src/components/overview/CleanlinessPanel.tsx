import { SvgCharacter } from '../../visual/SvgCharacter'
import { useI18n } from '../../contexts/I18nContext'

interface CleanlinessPanelProps {
  channel: 'regular' | 'deep'
  score: number | null
}

export function CleanlinessPanel({ channel, score }: CleanlinessPanelProps) {
  const { t } = useI18n()
  const label = t(channel === 'deep' ? 'deepCleanliness' : 'regularCleanliness')
  const normalized = score == null ? null : Math.round(Math.max(0, Math.min(100, score)))
  const expression = normalized == null ? 'neutral' : normalized >= 70 ? 'joyful' : normalized >= 40 ? 'worried' : 'sweaty'
  return <article className={`v2-clean-panel ${channel}`} aria-label={label}>
    <div className="v2-clean-panel-copy">
      <h3>{label}</h3>
      <strong className="hc-tabular-numerals">{normalized == null ? '—' : `${normalized}%`}</strong>
      <div className="v2-clean-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={normalized ?? undefined} aria-valuetext={normalized == null ? t('notTracked') : `${normalized}%`}>
        <span style={{ width: `${normalized ?? 0}%` }} />
      </div>
    </div>
    <div className="v2-clean-mascot"><SvgCharacter id={channel === 'regular' ? 'house' : 'sponge'} decorative expression={expression} pose={normalized != null && normalized >= 70 ? 'thumbs-up' : 'shrug'} misregistration={false} /></div>
  </article>
}
