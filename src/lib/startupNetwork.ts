/** Network failures alone permit offline recovery; 401/403/RLS failures do not. */
export function isTransientStartupFailure(error: unknown): boolean {
  const value = error as { code?: string; status?: number; message?: string }
  if (value?.status === 401 || value?.status === 403 || (value?.code === '42501' || value?.code === 'PGRST116')
    || /permission denied|unauthori[sz]ed|jwt|forbidden|not permitted|row.level.security/i.test(value?.message ?? '')) return false
  return value?.status === 0 || Boolean(value?.status && value.status >= 500)
    || /network|fetch|timeout|connection|offline|503|504/i.test(value?.message ?? String(error))
}
export function isDeniedStartupAccess(error: unknown): boolean {
  const value = error as { status?: number; code?: string; message?: string }
  return value?.status === 401 || value?.status === 403 || (value?.code === '42501' || value?.code === 'PGRST116')
    || /unauthori[sz]ed|jwt|forbidden|permission denied|row.level.security/i.test(value?.message ?? '')
}
