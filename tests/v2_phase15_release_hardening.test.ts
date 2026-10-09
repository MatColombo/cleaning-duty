declare const require: (id: string) => any
declare const process: { cwd(): string }
import { APP_VERSION } from '../src/app/version'
import { createHouseholdBackup, parseHouseholdBackup, BACKUP_SCHEMA_VERSION } from '../src/lib/backup'
import { cardVisualInputFromDomain } from '../src/visual/procedural/resolver'
import { generateCardVisualRecipe } from '../src/visual/procedural/recipe'
import { renderCardVisualSvg } from '../src/visual/procedural/render-card'
import { getCardVisualRecipe } from '../src/visual/procedural/cache'
import { HOUSE_DESTINATIONS, legacyRouteTarget } from '../src/navigation/houseNavigation'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const read = (p: string): string => fs.readFileSync(p, 'utf8')
const fixture = parseHouseholdBackup(read('tests/fixtures/pre-v2-household-backup.json'))
assert.equal(APP_VERSION, '2.0.0-rc.1', 'Candidate must remain a release candidate until real build/device gates pass')
assert.equal(fixture.application_version, '1.2.1-r4', 'Do not rewrite historical backup exporter identity')
assert.equal(fixture.schema_version, BACKUP_SCHEMA_VERSION)
const exported = parseHouseholdBackup(JSON.stringify(createHouseholdBackup(fixture.data)))
assert.equal(exported.application_version, APP_VERSION, 'New backups must use current app version')
for (const collection of ['members','entities','layoutScenes','layoutElements','actions','routines','tasks','taskEvents','supplies','supplyEvents','healthTrajectories'] as const) {
  assert.deepEqual(exported.data[collection].map((item: any) => item.id ?? `${item.entityId}:${item.cleanlinessChannel}`), fixture.data[collection].map((item: any) => item.id ?? `${item.entityId}:${item.cleanlinessChannel}`), `Backup round trip lost identities: ${collection}`)
}
assert.equal(fixture.data.tasks.some(t => Boolean(t.parentOccurrenceId)), true)
assert.equal(fixture.data.tasks.some(t => t.state === 'completed'), true)
assert.equal(fixture.data.tasks.some(t => t.effectiveDueAt !== t.scheduledSlotAt), true)
assert.equal(fixture.data.routines.some(r => Boolean(r.parentRoutineId)), true)

assert.deepEqual(HOUSE_DESTINATIONS.map(d => d.path), ['/', '/timeline', '/home', '/routines', '/actions', '/supplies', '/analysis', '/settings'])
assert.equal(legacyRouteTarget('/today', '?task=x'), '/?task=x')
assert.equal(legacyRouteTarget('/insights'), '/analysis')
const routes = read('src/App.tsx')
assert.ok(routes.includes('path="task/:taskId"') && routes.includes('TaskRouteResolver'))
assert.ok(!routes.includes('<TodayPage') && !fs.existsSync('src/pages/TodayPage.tsx'))
assert.ok(!fs.existsSync('src/components/Illustration.tsx') && !fs.existsSync('src/lib/illustrations.ts'))
assert.ok(!read('src/components/AppShell.tsx').includes('bottom-nav'))

const generatorSource = ['src/visual/procedural/recipe.ts','src/visual/procedural/render-card.ts','src/visual/procedural/resolver.ts'].map(read).join('\n')
const generatorExecutable = generatorSource.replace(/\/\*[\s\S]*?\*\//g, '')
assert.ok(!generatorExecutable.includes('Math.random()') && !generatorExecutable.includes('fetch(') && !generatorExecutable.includes('<image'))
const samples = fixture.data.tasks.slice(0, 5)
for (const task of samples) {
  const input = cardVisualInputFromDomain(task, fixture.data)
  const recipe = getCardVisualRecipe(input)
  assert.deepEqual(recipe, generateCardVisualRecipe(input), 'Cache vs direct generation must be stable')
  const result = renderCardVisualSvg(recipe, { instanceKey: `v2-release-${task.id}`, decorative: true })
  assert.ok(result.startsWith('<svg') && !result.includes('<image') && !result.includes('feTurbulence'))
  assert.ok(result.length < 40_000, `Unexpected card SVG size ${task.id}`)
  assert.ok((result.match(/<path\b/g) ?? []).length < 160, `Unexpectedly complex card ${task.id}`)
}
for (const name of ['src/components/overview/CardArtwork.tsx','src/components/overview/ActiveDeck.tsx']) {
  const code = read(name)
  assert.ok(!code.includes('new Image(') && !code.includes('canvas.toDataURL'))
}
assert.ok(read('src/components/overview/CardArtwork.tsx').includes('aria-hidden="true"'))
assert.ok(read('src/components/overview/ActiveDeck.tsx').includes('v2-deck-back'))
assert.ok(read('src/styles/overview-v2.css').includes('overflow-wrap'))
assert.ok(read('src/styles/overview-v2.css').includes('data-v2-no-art'))
assert.ok(read('src/styles/overview-v2.css').includes('prefers-reduced-motion'))

// Exercise the real service-worker program against a small in-memory CacheStorage implementation.
async function simulateUpgrade() {
  const handlers: Record<string, (e: any) => void> = {}
  const stores = new Map<string, Map<string, any>>([['house-care-shell-v1.2.1-r4', new Map([['/', { old: true }]])]])
  const precached: string[] = []
  const fakeResponse = { ok: true, clone() { return this } }
  const fakeCaches = {
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map())
      const cache = stores.get(key)!
      return {
        addAll: async (urls: string[]) => { precached.push(...urls); urls.forEach(url => cache.set(url, fakeResponse)) },
        put: async (url: string, response: any) => { cache.set(url, response) },
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    match: async (urlOrRequest: any) => {
      const key = typeof urlOrRequest === 'string' ? urlOrRequest : new URL(urlOrRequest.url).pathname
      for (const cache of stores.values()) if (cache.has(key)) return cache.get(key)
      return undefined
    },
  }
  let claimed = false, skipped = false, openedUrl = '', notification: any = null
  const client = { navigate: async (url: string) => { openedUrl = url }, focus: async () => null }
  const mockedSelf = {
    location: { origin: 'https://house.example' },
    clients: { claim: async () => { claimed = true }, matchAll: async () => [client], openWindow: async (url: string) => { openedUrl = url } },
    registration: { showNotification: async (_title: string, options: any) => { notification = options } },
    skipWaiting: () => { skipped = true },
    addEventListener: (name: string, fn: (event: any) => void) => { handlers[name] = fn },
  }
  let fetchOnline = true
  const fetchMock = async (_r: any) => {
    if (!fetchOnline) throw new Error('offline')
    return fakeResponse
  }
  const worker = read('public/sw.js')
  vm.runInNewContext(worker, { self: mockedSelf, caches: fakeCaches, URL, fetch: fetchMock, Promise, console }, { filename: 'sw.js' })
  function dispatch(kind: string, extras: any = {}) {
    let waited: Promise<any> | undefined, responded: Promise<any> | undefined
    handlers[kind]({ ...extras, waitUntil: (p: Promise<any>) => { waited = p }, respondWith: (p: Promise<any>) => { responded = p } })
    return { waited, responded }
  }
  await dispatch('install').waited
  assert.ok(precached.includes('/') && precached.some(url => url.includes(`/app-icon-512.png?v=${APP_VERSION}`)))
  assert.ok(precached.every(url => !url.startsWith('/illustrations/')))
  await dispatch('activate').waited
  assert.ok(claimed && !stores.has('house-care-shell-v1.2.1-r4'), 'Upgrade must evict legacy caches and claim clients')
  assert.ok([...stores.keys()].some(k => k.includes(`v${APP_VERSION}`)), 'New version should own its cache')
  dispatch('message', { data: { type: 'SKIP_WAITING' } })
  assert.equal(skipped, true, 'Update banner message should activate waiting worker')
  fetchOnline = false
  const offlinePage = await dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: 'https://house.example/timeline' } }).responded
  assert.equal(offlinePage, fakeResponse, 'Offline deep navigation should fall back to cached shell')
  await dispatch('push', { data: { json: () => ({ title: 'Task', taskId: 'abc', url: '/task/abc' }) } }).waited
  assert.equal(notification.data.url, '/task/abc')
  await dispatch('notificationclick', { notification: { close: () => null, data: notification.data } }).waited
  assert.equal(openedUrl, 'https://house.example/task/abc', 'Push deep links should not be rewritten')
}

simulateUpgrade().then(() => console.log('Phase 15 release-candidate tests passed: upgrade cache simulation, backup migration, route + visual contracts')).catch((e: unknown) => { console.error(e); throw e })
