import { SvgCharacter } from '../../visual/SvgCharacter'

export function OverviewEmptyState({ label, kind = 'handled' }: { label: string; kind?: 'handled' | 'critical' }) {
  return <div className={`v2-overview-empty v2-overview-empty-${kind}`} role="status">
    <SvgCharacter id={kind === 'critical' ? 'sofa' : 'house'} expression="joyful" pose="thumbs-up" decorative misregistration={false} />
    <span>{label}</span>
  </div>
}
