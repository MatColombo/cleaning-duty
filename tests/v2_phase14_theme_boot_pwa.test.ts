declare const require: (name: string) => any
import { applyTheme, themePreset, themePresets, defaultThemeId, sanitizePalette } from '../src/lib/theme'
import type { ThemePalette } from '../src/lib/theme'
import { translations } from '../src/lib/translations'
import { artContrastRatio, deriveVisualInkRoles } from '../src/visual/VisualPaletteAdapter'
import { vectorPaletteFromTheme } from '../src/visual/palette'
import { renderPrimitiveSvg } from '../src/visual/render'
import { cardPaletteForVariant } from '../src/visual/procedural/render-card'


const assert = require('node:assert/strict')
const { readFileSync, statSync } = require('node:fs')
const { validateSvgSource } = require(process.cwd() + '/tools/svg-validation.cjs')
declare const process: { cwd(): string }
const read = (path: string) => readFileSync(path, 'utf8')

const releaseVersion = JSON.parse(read('package.json')).version
const retro = themePreset('house-care-retro').palette
assert.equal(defaultThemeId, 'fresh-sage', 'existing theme preference must remain the default')
assert.ok(themePresets.some((p) => p.id === 'house-care-retro'))
const colorTest: ThemePalette[] = [
  ...themePresets.map((item) => item.palette),
  sanitizePalette(Object.fromEntries(Object.keys(retro).map((key) => [key, '#FFFFFF']))),
  sanitizePalette(Object.fromEntries(Object.keys(retro).map((key) => [key, '#000000']))),
  { ...retro, canvas: '#FFFFFF', surface: '#FFFFFF', ink: '#FFFFFF', inkMuted: '#FFFFFF', primary: '#FFFFFF', due: '#FFFFFF', overdue: '#FFFFFF', danger: '#FFFFFF' },
  { ...retro, canvas: '#050505', surface: '#050505', ink: '#050505', primary: '#050505', due: '#050505', overdue: '#050505' },
  { ...retro, canvas: '#FFFFFF', surface: '#000000', ink: '#000000', primary: '#000000', due: '#000000', overdue: '#000000' },
]
for (const palette of colorTest) {
  const before = JSON.stringify(palette)
  const roles = deriveVisualInkRoles(palette)
  const mapped = vectorPaletteFromTheme(palette)
  assert.equal(JSON.stringify(palette), before, 'Palette adaptation must not mutate saved values')
  assert.ok(artContrastRatio(roles.outline, palette.surface) >= 4.5 - .005, 'Outlines should contrast against artwork surface')
  for (const key of ['primary','warning','overdue'] as const) assert.ok(artContrastRatio(roles[key],palette.surface)>=2.99, `${key} must be visible`)
  assert.ok(roles.adjustedRoles.length <= 4 && new Set(roles.adjustedRoles).size === roles.adjustedRoles.length)
  assert.equal(mapped.ink, roles.outline)
  for (const variant of ['teal','coral','mustard','turquoise'] as const) {
    const cardInks = cardPaletteForVariant(mapped,{paletteVariant:variant})
    assert.ok(new Set(Object.values(cardInks)).size <= 5, `${variant}: procedural cards must use <=5 hard inks`)
  }
  const svg = renderPrimitiveSvg('house',{instanceKey:`theme-sample-${palette.canvas}-${palette.surface}`,palette:mapped})
  const result = validateSvgSource(svg,{allowFixedColors:true})
  assert.ok(result.valid, JSON.stringify(result.issues))
  assert.ok(!svg.includes('<image') && !svg.includes('feTurbulence'))
}
assert.ok(deriveVisualInkRoles({...retro,ink:retro.surface}).adjustedRoles.includes('outline'))
assert.equal(deriveVisualInkRoles(retro).outline, retro.ink, 'Retro outline remains the approved ink')
assert.equal(deriveVisualInkRoles(retro).primary, retro.primary, 'Retro primary remains the approved teal')

// Apply-to-DOM writes only derived *CSS* ink variables; no changed appearance payload.
const properties = new Map<string,string>()
let appliedMeta = ''
;(globalThis as any).document = {
  documentElement: { style: { setProperty(key:string,value:string) { properties.set(key,value) }, colorScheme: '' } },
  querySelector() { return { setAttribute(_key:string,value:string) { appliedMeta = value } } },
}
const deliberatelyBad = { ...retro, ink: retro.surface, primary: retro.surface }
applyTheme(deliberatelyBad)
assert.equal(properties.get('--color-ink'), deliberatelyBad.ink, 'Theme ink must not be overridden')
assert.equal(properties.get('--color-primary'), deliberatelyBad.primary, 'Theme primary must not be overridden')
assert.notEqual(properties.get('--hc-art-ink'), deliberatelyBad.ink, 'Art outline may be fixed without changing theme')
assert.ok(artContrastRatio(properties.get('--hc-art-ink')!, deliberatelyBad.surface) >= 4.5)
assert.equal(appliedMeta, deliberatelyBad.canvas, 'Browser toolbar is still theme-derived')

for (const locale of ['en','it'] as const) for (const key of ['artPalettePreview','artPalettePreviewHint','artInkPaper','artInkOutline','artInkPrimary','artInkWarning','artInkOverdue','artInkSoft','artInkContrastNote'] as const) {
  assert.ok(translations[locale][key].length>3,`${locale}.${key} missing`)
}
const settings = read('src/pages/SettingsPage.tsx')
assert.ok(settings.includes('<VisualInkPreview theme={palette} />'))
assert.ok(settings.includes('setAppearancePreferences(\'custom\', palette)'))
const preview = read('src/components/appearance/VisualInkPreview.tsx')
assert.ok(preview.includes('deriveVisualInkRoles(theme)') && preview.includes('vectorPaletteFromTheme(theme)'))
assert.ok(!preview.includes('setAppearancePreferences') && !preview.includes('Math.random'))

const boot = read('src/components/BootScreen.tsx')
const app = read('src/App.tsx')
for (const text of ['loadingPhrase01','loadingPhrase18','prefers-reduced-motion: reduce','brand/v2/house-care-app-mark.svg','SvgCharacter']) assert.ok(boot.includes(text),`Boot requirement missing: ${text}`)
for (const text of ['520 - (Date.now() - bootStartedAt.current)','setBootExiting(true)','setBootVisible(false)','const busy = authLoading || Boolean(user && dataLoading)']) assert.ok(app.includes(text),`Boot lifecycle changed: ${text}`)

const manifest = JSON.parse(read('public/manifest.webmanifest'))
assert.equal(manifest.background_color,'#F4E8D0')
assert.equal(manifest.theme_color,'#153D3A')
assert.equal(manifest.display,'standalone')
assert.equal(manifest.icons.length,4)
for (const entry of manifest.icons) {
  assert.ok(entry.src.startsWith('/brand/v2/app-icon'),`Legacy launcher still used: ${entry.src}`)
  assert.ok(entry.src.endsWith(`?v=${releaseVersion}`))
  const asset = 'public/'+entry.src.slice(1).split('?')[0]
  const buffer: any = readFileSync(asset)
  assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10], 'PNG signature')
  const size = Number.parseInt(entry.sizes.split('x')[0],10)
  assert.equal(buffer.readUInt32BE(16),size)
  assert.equal(buffer.readUInt32BE(20),size)
  assert.ok(statSync(asset).size > 800,`Incomplete icon asset: ${asset}`)
}
for (const [asset,size] of [['public/brand/v2/favicon-32.png',32],['public/brand/v2/apple-touch-icon.png',180]]) {
  const buffer: any = readFileSync(asset)
  assert.equal(buffer.readUInt32BE(16),size)
  assert.equal(buffer.readUInt32BE(20),size)
}
assert.ok(read('public/brand/v2/house-care-maskable-mark.svg').includes('scale(.76)'))
assert.ok(read('public/icon.svg').includes('viewBox="0 0 512 512"'))
const html = read('index.html')
assert.ok(html.includes('/brand/v2/house-care-app-mark.svg') && html.includes('/brand/v2/favicon-32.png'))
assert.ok(html.includes('<meta name="theme-color" content="#F4E8D0"'))
const sw = read('public/sw.js')
assert.ok(sw.includes('retro-assets-v2-rc1') && sw.includes('house-care-shell-${VERSION}-${BRAND_ASSET_REVISION}'))
for (const icon of manifest.icons) assert.ok(sw.includes(icon.src),`Missing precache: ${icon.src}`)
for (const contract of ["event.data?.type === 'SKIP_WAITING'",'self.registration.showNotification','notificationclick','caches.keys()','request.mode === \'navigate\'']) assert.ok(sw.includes(contract),`SW behavior missing: ${contract}`)
console.log(`Phase 14 passed: ${colorTest.length} palettes, accessible art roles, persistent-theme safety, EN/IT preview, boot lifecycle, PWA icon and cache assertions`)
