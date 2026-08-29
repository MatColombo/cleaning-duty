import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type TranslationKey } from '../lib/translations'
import type { Locale } from '../types/domain'
import { useAuth } from './AuthContext'
import { logClientError } from '../lib/errorLog'

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function browserLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('it')) return 'it'
  return 'en'
}

function storedLocale(key: string): Locale | null {
  try {
    const value = localStorage.getItem(key)
    return value === 'it' || value === 'en' ? value : null
  } catch { return null }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, isCloud, preferredLocale, setPreferredLocale } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => storedLocale('house-care-locale') ?? browserLocale())

  useEffect(() => {
    if (!user) return
    const accountKey = `house-care-locale-v2:${user.id}`
    const perUser = storedLocale(accountKey)
    const legacy = storedLocale('house-care-locale')
    const next = preferredLocale ?? perUser ?? legacy ?? browserLocale()
    setLocaleState(next)
    document.documentElement.lang = next
    try { localStorage.setItem(accountKey, next) } catch { /* ignore */ }
    if (isCloud && !preferredLocale) {
      void setPreferredLocale(next).catch((error) => logClientError(error, { area: 'save language preference' }))
    }
  }, [user?.id, isCloud, preferredLocale, setPreferredLocale])

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    document.documentElement.lang = next
    try {
      localStorage.setItem('house-care-locale', next)
      if (user) localStorage.setItem(`house-care-locale-v2:${user.id}`, next)
    } catch { /* ignore */ }
    if (isCloud) void setPreferredLocale(next).catch((error) => logClientError(error, { area: 'save language preference' }))
  }

  const value = useMemo(() => ({ locale, setLocale, t: (key: TranslationKey) => translate(locale, key) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
