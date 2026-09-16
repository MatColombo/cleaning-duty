import { useI18n } from '../contexts/I18nContext'
import { cleanlinessMood } from '../lib/presentation'

export function CleanlinessMood({ score }: { score: number | null | undefined }) {
  const { t } = useI18n()
  const mood = cleanlinessMood(score)
  if (!mood) return null
  return <span className="cleanliness-mood" role="img" aria-label={t(mood.label)} title={t(mood.label)}>{mood.emoji}</span>
}
