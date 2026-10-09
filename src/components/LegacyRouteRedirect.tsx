import { Navigate, useLocation } from 'react-router-dom'
import { legacyRouteTarget } from '../navigation/houseNavigation'

/** Preserve query and hash when settling older bookmarks on canonical V2 paths. */
export function LegacyRouteRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={legacyRouteTarget(pathname, search, hash) ?? '/'} replace />
}
