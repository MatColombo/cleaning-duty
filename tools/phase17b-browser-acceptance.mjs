/** Run against real locally served Vite app, never against production.
 * V2_BASE_URL=http://localhost:5173 node tools/phase17b-browser-acceptance.mjs
 * Requires dependency-backed app + Playwright Chromium installed; do not substitute mocks.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
let chromium
try { ({chromium} = await import('playwright')) }
catch { console.error('BLOCKED: Playwright package absent; install on a connected development machine.'); process.exit(2) }
const baseUrl=process.env.V2_BASE_URL ?? 'http://localhost:5173'
const outDir=resolve(process.env.V2_CAPTURE_DIR ?? 'docs/qa/phase17b-evidence/browser')
mkdirSync(outDir,{recursive:true})
const data=structuredClone(JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json','utf8')).data)
const owner=data.members.find(m=>m.role==='owner')??data.members[0]
owner.userId='local-user';data.workspace.ownerUserId='local-user'
const base=Date.now()-10*60_000
const candidates=data.tasks.filter(t=>!t.parentOccurrenceId && t.state==='scheduled').slice(0,3)
if(candidates.length<2)throw new Error('Need at least 2 scheduled primary fixture occurrences')
for(let i=0;i<candidates.length;i++){
  const due=new Date(base-i*60_000).toISOString()
  candidates[i].dueAt=due;candidates[i].effectiveDueAt=due
  candidates[i].assignmentScope='everyone';candidates[i].assigneeMemberId=null
}
const evidence={source:'Actual Vite app with seeded local household and Playwright browser (mobile settings are Chromium emulation, NOT physical phones)',scenarios:[],errors:[],screenshots:[]}
let browser
try { browser=await chromium.launch({headless:true}) }
catch(e){console.error('BLOCKED: Chromium could not launch:',e);process.exit(2)}
let failures=0
async function scenario(label,options,fn){
  const context=await browser.newContext(options)
  await context.addInitScript(seed=>{localStorage.setItem('house-care-workspace-v1',JSON.stringify(seed));localStorage.setItem('house-care-locale','en')},data)
  const page=await context.newPage()
  const dialogs=[];const writes=[]
  page.on('dialog',d=>{dialogs.push(d.message());void d.dismiss()})
  page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(`${r.method()} ${r.url()}`)})
  const result={label,viewport:options.viewport,device:options.isMobile?'emulated touch':'desktop mouse',reducedMotion:options.reducedMotion??'no-preference',passed:false}
  try{
    await page.goto(baseUrl,{waitUntil:'domcontentloaded'})
    await page.locator('.v2-deck-front .v2-care-card').first().waitFor({timeout:15000})
    if((await page.locator('.v2-deck-count').innerText()).match(/^\s*1\s/))throw Error('fixture exposes only 1 card; cannot test swipe')
    result.userAgent=await page.evaluate(()=>navigator.userAgent)
    await page.evaluate(() => {
      const probe={active:true,frames:[]}
      window.__v2DeckFrameProbe=probe
      const tick=timestamp=>{if(!probe.active)return;probe.frames.push(timestamp);requestAnimationFrame(tick)}
      requestAnimationFrame(tick)
    })
    await fn(page,result)
    await page.waitForTimeout(320)
    result.frameSamples=await page.evaluate(()=>{
      const probe=window.__v2DeckFrameProbe;probe.active=false
      const delays=probe.frames.slice(1).map((n,i)=>n-probe.frames[i]).sort((a,b)=>a-b)
      const pct=p=>delays[Math.min(delays.length-1,Math.floor(delays.length*p))]??null
      return {frames:delays.length,medianFrameMs:pct(.5),p95FrameMs:pct(.95),maxFrameMs:delays.at(-1)??null}
    })
    try {
      const cdp=await context.newCDPSession(page)
      await cdp.send('Performance.enable')
      const metrics=await cdp.send('Performance.getMetrics')
      result.chromiumJSHeapBytes=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value??null
      await cdp.detach()
    } catch { result.chromiumJSHeapBytes=null }
    if(dialogs.length)throw Error(`Swipe invoked a destructive confirmation: ${dialogs.join(', ')}`)
    if(writes.length)throw Error(`Swipe caused outgoing request(s): ${writes.join(', ')}`)
    const filename=`${label.replace(/[^a-z0-9-]/gi,'-')}.png`
    await page.screenshot({path:resolve(outDir,filename),animations:'disabled'})
    evidence.screenshots.push(filename)
    result.passed=true
  }catch(e){failures++; result.error=String(e); evidence.errors.push(`${label}: ${e}`)}
  finally{evidence.scenarios.push(result);await context.close()}
}
const visibleId=async page=>page.locator('.v2-deck-front .v2-care-card').getAttribute('data-task-id')
const waitChange=async(page,oldId)=>page.waitForFunction((id)=>document.querySelector('.v2-deck-front .v2-care-card')?.getAttribute('data-task-id')!==id,oldId,{timeout:3500})
const stageRect=async page=>page.locator('.v2-deck-front').boundingBox()
async function mouseDrag(page,from,to,steps=12){const r=await stageRect(page);const x=r.x+r.width/2;const y=r.y+Math.min(r.height*.35,90);await page.mouse.move(x+from,y);await page.mouse.down();await page.mouse.move(x+to,y,{steps});await page.mouse.up()}
async function touchDrag(page,dx){const r=await stageRect(page);const x=r.x+r.width/2;const y=r.y+Math.min(r.height*.35,90);const cdp=await page.context().newCDPSession(page)
  const event=(type,at)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x+at,y}]})
  await event('touchStart',0);for(let i=1;i<=12;i++){await event('touchMove',dx*i/12)}await event('touchEnd',dx);await cdp.detach()
}
try {
  await scenario('desktop-left-right',{viewport:{width:1024,height:768}},async(page,r)=>{
    const a=await visibleId(page);await mouseDrag(page,0,-170);await waitChange(page,a)
    const b=await visibleId(page);await mouseDrag(page,0,170);await waitChange(page,b)
    if(await visibleId(page)!==a)throw Error('previous swipe did not restore same card')
    r.navigation=[a,b,a]
  })
  await scenario('rapid-successive-swipes',{viewport:{width:390,height:844}},async(page,r)=>{
    const a=await visibleId(page)
    await mouseDrag(page,0,-170,7);await waitChange(page,a)
    const b=await visibleId(page)
    await mouseDrag(page,0,-170,7);await waitChange(page,b)
    r.navigation=[a,b,await visibleId(page)]
  })
  await scenario('slow-snap-back',{viewport:{width:390,height:844}},async(page,r)=>{
    const a=await visibleId(page);await mouseDrag(page,0,26,18);await page.waitForTimeout(380)
    if(await visibleId(page)!==a)throw Error('small slow drag unexpectedly navigated')
    r.snapBack=true
  })
  await scenario('touch-both-directions',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},async(page,r)=>{
    const a=await visibleId(page);await touchDrag(page,-155);await waitChange(page,a)
    const b=await visibleId(page);await touchDrag(page,155);await waitChange(page,b)
    if(await visibleId(page)!==a)throw Error('touch reverse did not restore card')
    r.navigation=[a,b,a]
  })
  await scenario('rapid-repeat-keyboard',{viewport:{width:390,height:844}},async(page,r)=>{
    const a=await visibleId(page)
    await page.locator('.v2-deck-stage').focus();await page.keyboard.press('ArrowRight');const b=await visibleId(page)
    if(a===b)throw Error('ArrowRight failed')
    await page.keyboard.press('ArrowLeft');if(await visibleId(page)!==a)throw Error('ArrowLeft failed')
    await page.locator('.v2-deck-controls button').last().click();if(await visibleId(page)===a)throw Error('Next button failed')
    await page.locator('.v2-deck-controls button').first().click();if(await visibleId(page)!==a)throw Error('Previous button failed')
    r.keyboardButtons=true
  })
  await scenario('reduced-motion',{viewport:{width:390,height:844},reducedMotion:'reduce'},async(page,r)=>{
    const a=await visibleId(page);await mouseDrag(page,0,-160);await waitChange(page,a)
    const behavior=await page.evaluate(()=>({matched:window.matchMedia('(prefers-reduced-motion: reduce)').matches,animation:getComputedStyle(document.querySelector('.v2-deck-front')).animationDuration,transform:getComputedStyle(document.querySelector('.v2-deck-front')).transform}))
    if(!behavior.matched || behavior.transform!=='none')throw Error('reduced motion still uses transform')
    r.behavior=behavior
  })
  await scenario('interactive-controls-safe',{viewport:{width:390,height:844}},async(page,r)=>{
    const a=await visibleId(page)
    const button=page.locator('.v2-care-more').first()
    await button.click();if(await visibleId(page)!==a)throw Error('More control changed card selection')
    r.moreSheetOpened=await page.getByRole('dialog').count()>0
  })
} finally{await browser.close()}
writeFileSync(resolve(outDir,'results.json'),JSON.stringify(evidence,null,2)+'\n')
console.log(JSON.stringify({scenarios:evidence.scenarios.length,failures,screenshots:evidence.screenshots.length,output:outDir},null,2))
if(failures)process.exitCode=1
