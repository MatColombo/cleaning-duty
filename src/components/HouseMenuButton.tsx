import { House } from '@phosphor-icons/react'
import { useI18n } from '../contexts/I18nContext'

export function HouseMenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return <button
    type="button"
    className="house-menu-trigger"
    onClick={onClick}
    aria-label={t('openHouseMenu')}
    aria-haspopup="dialog"
    aria-expanded={open}
    title={t('openHouseMenu')}
  >
    <House aria-hidden="true" size={28} weight="fill" />
  </button>
}
