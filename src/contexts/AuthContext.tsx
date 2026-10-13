import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Locale, SessionUser } from '../types/domain'
import { localUser } from '../lib/localRepository'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { clearUserCloudCaches } from '../lib/offline'
import { startupMark } from '../lib/startupTelemetry'
import { clearSelectedWorkspaceId, clearWorkspaceCatalog } from '../lib/workspaces'
import { defaultThemeId, isThemePresetId, sanitizePalette, themePreset, type ThemeId, type ThemePalette } from '../lib/theme'

interface AuthValue {
  user: SessionUser | null
  cloudUser: User | null
  loading: boolean
  offlineSessionValid: boolean
  isCloud: boolean
  preferredWorkspaceId: string | null
  preferredLocale: Locale | null
  overviewCriticalCount: number
  overviewCriticalThreshold: number
  appearanceThemeId: ThemeId
  appearancePalette: ThemePalette
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  setPreferredWorkspaceId: (workspaceId: string | null) => Promise<void>
  setPreferredLocale: (locale: Locale) => Promise<void>
  setOverviewPreferences: (count: number, threshold: number) => Promise<void>
  setAppearancePreferences: (themeId: ThemeId, palette?: ThemePalette) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const LOCAL_APPEARANCE_KEY = 'housecare:appearance:v12'

function metadataString(user: User | null, key: string): string | null {
  const value = user?.user_metadata?.[key]
  return typeof value === 'string' && value ? value : null
}

function validThemeId(value: unknown): ThemeId {
  return value === 'custom' || isThemePresetId(value) ? value : defaultThemeId
}

function loadLocalAppearance(): { themeId: ThemeId; palette: ThemePalette } {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_APPEARANCE_KEY) ?? '{}') as { themeId?: unknown; palette?: unknown }
    const themeId = validThemeId(value.themeId)
    const fallback = themePreset(themeId).palette
    return { themeId, palette: sanitizePalette(value.palette, fallback) }
  } catch {
    return { themeId: defaultThemeId, palette: themePreset(defaultThemeId).palette }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cloudUser, setCloudUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseEnabled)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [localAppearance, setLocalAppearance] = useState(loadLocalAppearance)

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    let eventSeen = false
    supabase.auth.getSession().then(({ data }) => {
      if (!eventSeen) {
        setCloudUser(data.session?.user ?? null)
        setExpiresAt(data.session?.expires_at ?? null)
      }
    }).catch(() => { if (!eventSeen) setCloudUser(null) }).finally(() => setLoading(false))
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      eventSeen = true
      if (event === 'SIGNED_OUT') {
        // Remove private snapshots; preserve durable outboxes for a later
        // authenticated session with the same account.
        setCloudUser((previous) => { if (previous) {
          try { clearUserCloudCaches(previous.id); clearWorkspaceCatalog(previous.id); clearSelectedWorkspaceId(previous.id) }
          catch { /* best effort */ }
        } return null })
      } else setCloudUser(session?.user ?? null)
      setExpiresAt(session?.expires_at ?? null)
      setLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (!loading) startupMark('auth-ready') }, [loading])

  const updateMetadata = useCallback(async (patch: Record<string, unknown>) => {
    if (!supabase || !cloudUser) return
    const { data, error } = await supabase.auth.updateUser({
      data: { ...(cloudUser.user_metadata ?? {}), ...patch },
    })
    if (error) throw error
    if (data.user) setCloudUser(data.user)
  }, [cloudUser])

  const setPreferredWorkspaceId = useCallback(async (workspaceId: string | null) => {
    await updateMetadata({ housecare_preferred_workspace_id: workspaceId })
  }, [updateMetadata])

  const setPreferredLocale = useCallback(async (locale: Locale) => {
    await updateMetadata({ housecare_locale: locale })
  }, [updateMetadata])

  const setOverviewPreferences = useCallback(async (count: number, threshold: number) => {
    await updateMetadata({
      housecare_overview_critical_count: Math.max(1, Math.min(15, Math.round(count))),
      housecare_overview_critical_threshold: Math.max(1, Math.min(100, Math.round(threshold))),
    })
  }, [updateMetadata])

  const setAppearancePreferences = useCallback(async (themeId: ThemeId, palette?: ThemePalette) => {
    const fallback = themePreset(themeId).palette
    const nextPalette = sanitizePalette(palette, fallback)
    if (supabaseEnabled && cloudUser) {
      await updateMetadata({
        housecare_appearance_theme_id: themeId,
        housecare_appearance_custom_palette: themeId === 'custom' ? nextPalette : null,
      })
      return
    }
    const next = { themeId, palette: themeId === 'custom' ? nextPalette : fallback }
    localStorage.setItem(LOCAL_APPEARANCE_KEY, JSON.stringify(next))
    setLocalAppearance(next)
  }, [cloudUser, updateMetadata])

  const preferredLocaleValue = metadataString(cloudUser, 'housecare_locale')
  const preferredLocale: Locale | null = preferredLocaleValue === 'it' || preferredLocaleValue === 'en' ? preferredLocaleValue : null
  const criticalCountRaw = Number(cloudUser?.user_metadata?.housecare_overview_critical_count)
  const criticalThresholdRaw = Number(cloudUser?.user_metadata?.housecare_overview_critical_threshold)
  const overviewCriticalCount = Number.isFinite(criticalCountRaw) ? Math.max(1, Math.min(15, Math.round(criticalCountRaw))) : 3
  const overviewCriticalThreshold = Number.isFinite(criticalThresholdRaw) ? Math.max(1, Math.min(100, Math.round(criticalThresholdRaw))) : 20
  const cloudThemeId = validThemeId(cloudUser?.user_metadata?.housecare_appearance_theme_id)
  const cloudPalette = cloudThemeId === 'custom'
    ? sanitizePalette(cloudUser?.user_metadata?.housecare_appearance_custom_palette, themePreset(defaultThemeId).palette)
    : themePreset(cloudThemeId).palette
  const appearanceThemeId = supabaseEnabled ? cloudThemeId : localAppearance.themeId
  const appearancePalette = supabaseEnabled ? cloudPalette : localAppearance.palette

  const value = useMemo<AuthValue>(() => ({
    user: supabaseEnabled
      ? cloudUser ? { id: cloudUser.id, email: cloudUser.email, displayName: cloudUser.email?.split('@')[0] ?? 'User' } : null
      : localUser,
    cloudUser,
    loading,
    offlineSessionValid: !supabaseEnabled || Boolean(expiresAt && expiresAt * 1000 > Date.now() + 30_000),
    isCloud: supabaseEnabled,
    preferredWorkspaceId: metadataString(cloudUser, 'housecare_preferred_workspace_id'),
    preferredLocale,
    overviewCriticalCount,
    overviewCriticalThreshold,
    appearanceThemeId,
    appearancePalette,
    signIn: async (email, password) => {
      if (!supabase) return
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signUp: async (email, password) => {
      if (!supabase) return null
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      return data.session ? null : 'Check your email to confirm the account, then sign in.'
    },
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
    setPreferredWorkspaceId,
    setPreferredLocale,
    setOverviewPreferences,
    setAppearancePreferences,
  }), [cloudUser, loading, expiresAt, preferredLocale, overviewCriticalCount, overviewCriticalThreshold, appearanceThemeId, appearancePalette, setPreferredWorkspaceId, setPreferredLocale, setOverviewPreferences, setAppearancePreferences])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
