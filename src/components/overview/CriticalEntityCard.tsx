import type { CriticalCleanlinessSummary } from '../../lib/overview'
import { resolveCardVisualSemantics } from '../../visual/procedural/resolver'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { useI18n } from '../../contexts/I18nContext'

interface Props { item: CriticalCleanlinessSummary; onOpen: (itemId: string) => void }

export function CriticalEntityCard({ item, onOpen }: Props) {
  const { t } = useI18n()
  const lowest = Math.min(...item.channels.map((channel) => channel.score))
  const object = resolveCardVisualSemantics({
    routineId: `critical-${item.itemId}`, occurrenceId: item.itemId, subjectName: item.name,
  }).subjectId
  const value = Math.round(lowest)
  const isOverdue = item.channels.some((channel) => channel.overdue)
  const channelCaption = item.channels.map((channel) => `${channel.channel === 'deep' ? 'D' : 'R'} ${Math.round(channel.score)}%`).join(' · ')
  return <button type="button" className="v2-critical-card" onClick={() => onOpen(item.itemId)}
    aria-label={`${item.name}, ${item.roomName ?? t('home')}, ${item.channels.map((channel) => `${t(channel.channel === 'deep' ? 'deepCleaning' : 'routineCleaning')} ${Math.round(channel.score)}%`).join(', ')}, ${t('open')}`}>
    <span className="v2-critical-icon"><SvgCharacter id={object} decorative expression={value < 20 ? 'angry' : 'worried'} misregistration={false} /></span>
    <span className="v2-critical-label" title={item.name}>{item.name}</span>
    <small className="v2-critical-room" title={item.roomName ?? t('home')}>{item.roomName ?? t('home')}</small>
    <strong className="hc-tabular-numerals">{value}%</strong>
    <span className={`v2-critical-both ${isOverdue ? 'overdue' : ''}`}>{isOverdue && <span aria-hidden="true">! </span>}{item.channels.length > 1 ? channelCaption : isOverdue ? t('overdue') : t('needsAttention')}</span>
    <span className="v2-critical-track"><span style={{ width: `${Math.max(0,Math.min(100,lowest))}%` }} /></span>
  </button>
}
