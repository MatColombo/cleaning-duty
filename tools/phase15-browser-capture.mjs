/** Optional live-browser capture / navigation smoke for a dependency-complete V2 dev server.
 * Install Playwright separately, start Vite in local mode, then:
 *   V2_BASE_URL=http://localhost:5173 node tools/phase15-browser-capture.mjs
 * This script is not a substitute for the signed manual interaction matrix.
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const baseUrl = process.env.V2_BASE_URL ?? 'http://localhost:5173'
const outDir = resolve(process.env.V2_CAPTURE_DIR ?? 'docs/qa/screenshots')
let chromium
try { ({ chromium } = await import('playwright')) }
catch { console.error('Playwright not installed. On a connected developer machine: npm install --no-save playwright && npx playwright install chromium'); process.exit(2) }
const raw = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8'))
const data = raw.data
const owner = data.members.find(m => m.role === 'owner') ?? data.members[0]
owner.userId = 'local-user'
data.workspace.ownerUserId = 'local-user'
const browser = await chromium.launch({ headless: true })
mkdirSync(outDir, { recursive: true })
async function startContext(locale='en', viewport={width:390,height:844}, motion='no-preference') {
  const context = await browser.newContext({ viewport, locale: locale === 'it' ? 'it-IT' : 'en-US', reducedMotion: motion })
  await context.addInitScript(({seed,locale}) => {
    if (!localStorage.getItem('house-care-workspace-v1')) localStorage.setItem('house-care-workspace-v1', JSON.stringify(seed))
    localStorage.setItem('house-care-locale', locale)
    localStorage.setItem(`house-care-locale-v2:local-user`, locale)
  }, {seed:data,locale})
  return context
}
async function openAndCapture(page, path, name) {
  await page.goto(new URL(path, baseUrl).href, { waitUntil:'domcontentloaded' })
  await page.locator('body').waitFor({state:'visible'})
  // Wait for app boot overlay to hand off to an actual page.
  await page.locator('.boot-screen').waitFor({state:'hidden', timeout:20000}).catch(() => {})
  await page.screenshot({ path:resolve(outDir, `${name}.png`), fullPage:true, animations:'disabled' })
  console.log(`CAPTURE ${name}`)
}
let failed = false
try {
  const context = await startContext('en')
  const page = await context.newPage()
  await openAndCapture(page, '/', 'overview-en')
  if (!(await page.locator('.v2-house-state').count())) throw Error('Overview House State not rendered')
  if (!(await page.locator('.v2-active-deck').count())) throw Error('Overview Active Deck not rendered')
  await page.locator('.house-menu-trigger').click()
  if (await page.locator('.house-menu-list a').count() !== 8) throw Error('House Menu destination count != 8')
  await page.keyboard.press('Escape')
  if (await page.locator('.house-menu-list').count()) throw Error('House Menu Escape did not dismiss')
  for (const [path,name] of [
    ['/timeline','timeline-en'],['/home','home-en'],['/routines','routines-en'],
    ['/actions','actions-en'],['/supplies','supplies-en'],['/analysis','analysis-en'],['/settings','settings-en'],
  ]) await openAndCapture(page,path,name)
  const edit = page.locator('.v2-home-edit-toggle').first()
  await page.goto(new URL('/home',baseUrl).href)
  if (await edit.isVisible().catch(()=>false)) {
    await edit.click()
    await page.screenshot({path:resolve(outDir,'home-edit-en.png'),fullPage:true,animations:'disabled'})
    console.log('CAPTURE home-edit-en')
  }
  await context.close()
  const it = await startContext('it',{width:375,height:760},'reduce')
  const itPage = await it.newPage()
  await openAndCapture(itPage,'/','overview-it-small-reduced-motion')
  await openAndCapture(itPage,'/timeline','timeline-it-small-reduced-motion')
  await itPage.goto(new URL('/',baseUrl).href)
  await itPage.locator('body').evaluate(body => body.dataset.v2NoArt = 'true')
  await itPage.screenshot({path:resolve(outDir,'overview-it-no-art.png'),fullPage:true,animations:'disabled'})
  console.log('CAPTURE overview-it-no-art')
  await it.close()
} catch (error) { failed = true; console.error(error) }
finally { await browser.close() }
if (failed) process.exitCode=1
else console.log('LIVE browser navigation/screenshot smoke complete. Review all images and finish the manual state/mutation checklist.')
