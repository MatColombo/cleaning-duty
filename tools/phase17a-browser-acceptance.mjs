/** Real Vite-app browser acceptance runner; requires dependencies + Playwright.
 * V2_BASE_URL=http://localhost:5173 node tools/phase17a-browser-acceptance.mjs
 * Local seeded household, never connects to production by itself.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
let chromium
try { ({ chromium } = await import('playwright')) }
catch { console.error('BLOCKED: install Playwright on a connected dev machine (npm install --no-save playwright && npx playwright install chromium).'); process.exit(2) }
const baseUrl = process.env.V2_BASE_URL ?? 'http://localhost:5173'
const outDir = resolve(process.env.V2_CAPTURE_DIR ?? 'docs/qa/phase17a-evidence/browser')
mkdirSync(outDir, {recursive:true})
const data = structuredClone(JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json','utf8')).data)
const owner = data.members.find(m=>m.role==='owner') ?? data.members[0]
owner.userId='local-user'
data.workspace.ownerUserId='local-user'
const stock = ['out_of_stock','reserve_only','low','available','reserve_only','low']
for(let i=0;i<6;i++) data.supplies.push({...data.supplies[0], id:`phase17a-stock-${i}`,name:`Test supply ${i+1}`,status:stock[i],quantity:i===0?0:(i+1)*2,unit:'pcs',archivedAt:undefined})
const task=data.tasks.find(t=>!t.parentOccurrenceId && t.state==='scheduled')
if(!task) throw new Error('Fixture has no scheduled primary task')
task.effectiveDueAt=new Date(Date.now()-3_600_000).toISOString()
task.dueAt=task.effectiveDueAt
task.supplies=stock.map((_,i)=>({supplyId:`phase17a-stock-${i}`,supplyName:`Test supply ${i+1}`}))
const sizes=[[390,844],[375,812],[360,740],[320,640],[430,932],[768,1024]]
const metrics=[]
const browser=await chromium.launch({headless:true})
let failure=false
try {
  for(const locale of ['en','it']) {
    for(const [width,height] of sizes) {
      const context=await browser.newContext({viewport:{width,height},locale:locale==='en'?'en-US':'it-IT',reducedMotion:'reduce'})
      await context.addInitScript(({seed,locale})=>{
        localStorage.setItem('house-care-workspace-v1',JSON.stringify(seed))
        localStorage.setItem('house-care-locale',locale)
        localStorage.setItem('house-care-locale-v2:local-user',locale)
      },{seed:data,locale})
      const page=await context.newPage()
      await page.goto(baseUrl,{waitUntil:'domcontentloaded'})
      await page.locator('.v2-active-deck .v2-care-card').first().waitFor({timeout:20000})
      const row=await page.evaluate(()=>{
        function rect(sel){const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
        const actions=rect('.v2-care-actions');const menu=rect('.house-menu-trigger')
        const overlaps=!!(actions&&menu&&actions.left<menu.right&&actions.right>menu.left&&actions.top<menu.bottom&&actions.bottom>menu.top)
        return {visualViewport:{height:window.visualViewport?.height??null,scale:window.visualViewport?.scale??null},header:rect('.house-app-header'),state:rect('.v2-house-state'),deck:rect('.v2-active-deck'),actions,menu,
          docScroll:document.documentElement.scrollHeight>window.innerHeight+2,
          horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2,menuActionOverlap:overlaps,
          fallback:document.querySelector('.v2-overview')?.classList.contains('v2-overview-scroll-fallback')}
      })
      metrics.push({locale,width,height,...row})
      await page.screenshot({path:resolve(outDir,`${locale}-${width}x${height}.png`),fullPage:true,animations:'disabled'})
      if(row.horizontalOverflow || row.menuActionOverlap || !row.actions || row.actions.bottom>height+1 || (height>=812&&width<600&&row.docScroll)) {
        failure=true;console.error('FAIL layout',locale,width,height,row)
      }
      const more=page.locator('.v2-care-supplies-more').first()
      if(await more.count()) {
        await more.click()
        const dialog=page.getByRole('dialog',{name:locale==='it'?'Tutti i prodotti necessari':'All required supplies'})
        await dialog.waitFor({state:'visible'})
        const focusInDialog=await page.evaluate(()=>Boolean(document.activeElement?.closest('[role="dialog"]')))
        if(!focusInDialog || await dialog.locator('.v2-care-supply-full-list li').count()!==6) {failure=true;console.error('FAIL sheet',locale,width,height)}
        await page.keyboard.press('Escape')
        if(await dialog.count()) {failure=true;console.error('FAIL Escape',locale,width,height)}
      } else {failure=true;console.error('FAIL +N not displayed',locale,width,height)}
      await context.close()
    }
  }
} catch(e){failure=true;console.error(e)} finally {await browser.close()}
writeFileSync(resolve(outDir,'metrics.json'),JSON.stringify({source:'real Vite app; Playwright local-mode seeded fixture',screens:metrics},null,2))
console.log('Saved real app screenshots and DOM metrics in',outDir)
if(failure)process.exitCode=1
