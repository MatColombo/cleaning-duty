import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Locale, SessionUser } from '../types/domain'
import { localUser } from '../lib/localRepository'
import { supabase, supabaseEnabled } from '../lib/supabase'

interface AuthValue {
  user: SessionUser | null
  cloudUser: User | null
  loading: boolean
  isCloud: boolean
  preferredWorkspaceId: string | null
  preferredLocale: Locale | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  setPreferredWorkspaceId: (workspaceId: string | null) => Promise<void>
  setPreferredLocale: (locale: Locale) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

function metadataString(user: User | null, key: string): string | null {
  const value = user?.user_metadata?.[key]
  return typeof value === 'string' && value ? value : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cloudUser, setCloudUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseEnabled)

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setCloudUser(data.session?.user ?? null)
    }).catch(() => setCloudUser(null)).finally(() => setLoading(false))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

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

  const preferredLocaleValue = metadataString(cloudUser, 'housecare_locale')
  const preferredLocale: Locale | null = preferredLocaleValue === 'it' || preferredLocaleValue === 'en' ? preferredLocaleValue : null

  const value = useMemo<AuthValue>(() => ({
    user: supabaseEnabled
      ? cloudUser ? { id: cloudUser.id, email: cloudUser.email, displayName: cloudUser.email?.split('@')[0] ?? 'User' } : null
      : localUser,
    cloudUser,
    loading,
    isCloud: supabaseEnabled,
    preferredWorkspaceId: metadataString(cloudUser, 'housecare_preferred_workspace_id'),
    preferredLocale,
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
  }), [cloudUser, loading, preferredLocale, setPreferredWorkspaceId, setPreferredLocale])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
