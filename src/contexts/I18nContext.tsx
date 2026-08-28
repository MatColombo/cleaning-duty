import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { translate, type TranslationKey } from '../lib/translations'
import type { Locale } from '../types/domain'

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem('house-care-locale') === 'it' ? 'it' : 'en'))
  const setLocale = (next: Locale) => {
    localStorage.setItem('house-care-locale', next)
    document.documentElement.lang = next
    setLocaleState(next)
  }
  const value = useMemo(() => ({ locale, setLocale, t: (key: TranslationKey) => translate(locale, key) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
