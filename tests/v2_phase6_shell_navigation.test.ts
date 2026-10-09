declare const require: (name: string) => any
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
import { HOUSE_DESTINATIONS, LEGACY_ROUTES, activeHouseDestination, legacyRouteTarget } from '../src/navigation/houseNavigation'
import { nextWrappedFocus } from '../src/components/dialogFocus'
import { translate } from '../src/lib/translations'

// The ordering and paths are the explicit Phase 1 compatibility contract.
assert.deepEqual(HOUSE_DESTINATIONS.map((item) => item.id), [
  'overview', 'timeline', 'home', 'routines', 'actions', 'supplies', 'analysis', 'settings',
])
assert.deepEqual(HOUSE_DESTINATIONS.map((item) => item.path), [
  '/', '/timeline', '/home', '/routines', '/actions', '/supplies', '/analysis', '/settings',
])
assert.equal(new Set(HOUSE_DESTINATIONS.map(({ path }) => path)).size, 8)
for (const destination of HOUSE_DESTINATIONS) {
  assert.equal(activeHouseDestination(destination.path), destination.id)
  assert.ok(translate('en', destination.labelKey).length)
  assert.ok(translate('it', destination.labelKey).length)
}
assert.deepEqual(LEGACY_ROUTES, { '/today': '/', '/insights': '/analysis' })
assert.equal(legacyRouteTarget('/today'), '/')
assert.equal(legacyRouteTarget('/today', '?scope=mine', '#current'), '/?scope=mine#current')
assert.equal(legacyRouteTarget('/insights', '?days=30', '#history'), '/analysis?days=30#history')
assert.equal(legacyRouteTarget('/settings', '?errors=1'), null)
assert.equal(activeHouseDestination('/task/occurrence-xyz'), 'overview')
assert.equal(activeHouseDestination('/today'), 'overview')
assert.equal(activeHouseDestination('/insights'), 'analysis')
assert.equal(activeHouseDestination('/completely-unknown'), null)
assert.equal(activeHouseDestination('/settings'), 'settings')

// Modal keyboard Tab-wrap including recovery if focus is outside the dialog.
const focused: string[] = []
const controls = ['close', 'overview', 'timeline', 'settings'].map((id) => ({
  id, focus: () => { focused.push(id) },
}))
assert.equal(nextWrappedFocus(controls, controls[0], true), controls.at(-1))
assert.equal(nextWrappedFocus(controls, controls.at(-1)!, false), controls[0])
assert.equal(nextWrappedFocus(controls, controls[1], false), null)
assert.equal(nextWrappedFocus(controls, controls[2], true), null)
assert.equal(nextWrappedFocus(controls, null, false), controls[0])
assert.equal(nextWrappedFocus(controls, null, true), controls.at(-1))
assert.equal(nextWrappedFocus([], null, false), null)
nextWrappedFocus(controls, controls[0], true)?.focus()
assert.deepEqual(focused, ['settings'])

// Wiring checks are useful while dependency-backed React browser tests are blocked.
const src = (path: string) => readFileSync(path, 'utf8')
const app = src('src/App.tsx')
const shell = src('src/components/AppShell.tsx')
const menu = src('src/components/HouseMenuSheet.tsx')
const trigger = src('src/components/HouseMenuButton.tsx')
const sheet = src('src/components/Sheet.tsx')
const header = src('src/components/AppHeader.tsx')
const banners = src('src/components/RuntimeBanners.tsx')
const css = src('src/styles/shell.css')
const oldCss = src('src/styles.css')

for (const route of ['timeline', 'analysis', 'today', 'insights', 'task/:taskId', 'home', 'routines', 'actions', 'supplies', 'settings']) {
  assert.ok(app.includes(`path="${route}"`), `missing route ${route}`)
}
assert.ok(app.includes('LegacyRouteRedirect'))
assert.ok(app.includes('<OverviewPage />'))
assert.ok(shell.includes('<AppHeader />') && shell.includes('<RuntimeBanners />'))
assert.ok(shell.includes('<HouseMenuButton') && shell.includes('<HouseMenuSheet'))
assert.ok(shell.includes('syncPushSubscription') && shell.includes('badgeApi.setAppBadge'))
assert.ok(menu.includes('<Sheet ') && menu.includes('<Link') && menu.includes('HOUSE_DESTINATIONS'))
assert.ok(trigger.includes('aria-haspopup="dialog"') && trigger.includes('aria-expanded={open}'))
assert.ok(sheet.includes('role="dialog"') && sheet.includes('aria-modal="true"'))
assert.ok(sheet.includes("event.key === 'Escape'") && sheet.includes('nextWrappedFocus'))
assert.ok(sheet.includes('previousFocus?.focus()'), 'focus must return when closing')
assert.ok(header.includes('<WorkspaceSwitcher />') && header.includes('pendingSync'))
for (const invariant of ['offlineMode', 'syncConflict', 'updateReady', 'housecare:update-ready', 'SKIP_WAITING', "'/settings?errors=1'"]) {
  assert.ok(banners.includes(invariant), `missing runtime banner behavior ${invariant}`)
}
assert.ok(css.includes('env(safe-area-inset-bottom)'))
assert.ok(css.includes('max-width: 370px'))
assert.ok(css.includes('prefers-reduced-motion: reduce'))
assert.ok(css.includes('min-height: 53px'))
assert.ok(!shell.includes('bottom-nav'))
assert.ok(!oldCss.includes('.bottom-nav') && !oldCss.includes('.nav-item'))
assert.ok(src('src/main.tsx').includes("import './styles/shell.css'"))

console.log('V2 Phase 6 shell/navigation contract and focus-cycle tests passed')
