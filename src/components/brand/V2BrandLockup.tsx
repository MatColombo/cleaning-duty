import { HOUSE_CARE_BRAND_ASSETS } from '../../visual/brand'

/** Shared identity for entry and settings surfaces; words remain selectable HTML text. */
export function V2BrandLockup({ compact = false }: { compact?: boolean }) {
  return <div className={`v2-brand-lockup${compact ? ' compact' : ''}`}>
    <img src={HOUSE_CARE_BRAND_ASSETS.compactMark} alt="" aria-hidden="true" />
    <span className="hc-brand-wordmark">House Care</span>
  </div>
}
