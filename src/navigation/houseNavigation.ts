import type { TranslationKey } from '../lib/translations'

/** V2's canonical destinations. This list is navigation-only: no task/domain state. */
export const HOUSE_DESTINATIONS = [
  { id: 'overview', path: '/', labelKey: 'overview' },
  { id: 'timeline', path: '/timeline', labelKey: 'timeline' },
  { id: 'home', path: '/home', labelKey: 'home' },
  { id: 'routines', path: '/routines', labelKey: 'routines' },
  { id: 'actions', path: '/actions', labelKey: 'actions' },
  { id: 'supplies', path: '/supplies', labelKey: 'supplies' },
  { id: 'analysis', path: '/analysis', labelKey: 'analysis' },
  { id: 'settings', path: '/settings', labelKey: 'settings' },
] as const satisfies ReadonlyArray<{ id: string; path: string; labelKey: TranslationKey }>

export type HouseDestinationId = typeof HOUSE_DESTINATIONS[number]['id']

export const LEGACY_ROUTES = {
  '/today': '/',
  '/insights': '/analysis',
} as const

/** Preserve query/fragment for bookmarked compatibility aliases. */
export function legacyRouteTarget(pathname: string, search = '', hash = ''): string | null {
  const to = LEGACY_ROUTES[pathname as keyof typeof LEGACY_ROUTES]
  return to ? `${to}${search}${hash}` : null
}

/** Deep links settle on Overview or Timeline via TaskRouteResolver; this transient route highlights Overview. */
export function activeHouseDestination(pathname: string): HouseDestinationId | null {
  if (pathname === '/task' || pathname.startsWith('/task/')) return 'overview'
  const canonical = LEGACY_ROUTES[pathname as keyof typeof LEGACY_ROUTES] ?? pathname
  return HOUSE_DESTINATIONS.find(({ path }) => path === canonical)?.id ?? null
}
