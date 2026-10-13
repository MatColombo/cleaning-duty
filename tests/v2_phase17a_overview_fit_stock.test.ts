declare const require: (name: string) => any
import { careCardContext } from '../src/lib/overviewDeck'
import { requiredCardSupplies, visibleCardSupplies } from '../src/lib/cardSupplies'
import { additionalActivityAppendix } from '../src/lib/presentation'
import { materializeRoutineSlot } from '../src/lib/scheduler'
import { translate } from '../src/lib/translations'
import type { AdditionalActivityAppendixEntry } from '../src/lib/presentation'
import type { Routine, TaskOccurrence, WorkspaceData, StockStatus } from '../src/types/domain'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json','utf8')).data
const task = data.tasks.find(t => t.id.endsWith('0060'))!
const names: [string, StockStatus | null][] = [
  ['Available bottle', 'available'], ['Last reserve', 'reserve_only'], ['Empty bottle', 'out_of_stock'],
  ['Low supply', 'low'], ['Other reserve', 'reserve_only'], ['Unknown stock', null],
]
const extraSupplies = names.map(([name], i) => ({ supplyId:`p17a-${i}`, supplyName:name }))
const inventory = names.slice(0,5).map(([name,status],i) => ({...data.supplies[0], id:`p17a-${i}`, name, status:status!, archivedAt:undefined, quantity:i===2?0:i+1, unit:i===0?'bottles':undefined }))
const fixture = {...data, supplies:[...data.supplies,...inventory]}
const syntheticExtra: AdditionalActivityAppendixEntry = {
  id:'extra', routine: data.routines[0], status:'due', supplies:extraSupplies,
  targetNames:[], actionName:'',
}
const withPrimary = {...task, supplies:[extraSupplies[3],extraSupplies[0],extraSupplies[3]]}
const combined = requiredCardSupplies(fixture, withPrimary, [syntheticExtra])
assert.deepEqual(combined.map(x=>x.name), ['Empty bottle','Last reserve','Other reserve','Low supply','Available bottle','Unknown stock'], 'Out -> Reserve -> Low -> Available -> Unknown, ties by name')
assert.equal(combined.length, 6, 'Same supply required by main and Extra Care appears once')
assert.equal(combined[0].quantity, 0, 'Zero stock remains reportable, distinct from unreported')
assert.equal(combined[0].status,'out_of_stock')
assert.equal(combined[5].quantity, undefined)
assert.equal(combined[5].status, null, 'Missing inventory cannot be described as available')
assert.deepEqual(visibleCardSupplies(combined).shown.map(x=>x.name),combined.slice(0,4).map(x=>x.name))
assert.equal(visibleCardSupplies(combined).hiddenCount,2)
assert.equal(visibleCardSupplies(combined.slice(0,4)).hiddenCount,0)
assert.equal(visibleCardSupplies([]).shown.length,0)
assert.deepEqual(requiredCardSupplies(fixture,withPrimary,[{...syntheticExtra,status:'completed'}]).map(x=>x.name),['Low supply','Available bottle'], 'Completed Extra Care contributes no current required supplies')
assert.deepEqual(requiredCardSupplies(fixture,withPrimary,[{...syntheticExtra,status:'postponed'}]).map(x=>x.name),['Low supply','Available bottle'])
// Imported legacy linked child is included only while currently scheduled; never invent Extra Care configuration.
const legacyExtra = {...syntheticExtra,status:undefined,occurrence:{...task,state:'scheduled' as const}}
assert.equal(requiredCardSupplies(fixture,{...task,supplies:[]},[legacyExtra]).length,6)
assert.equal(requiredCardSupplies(fixture,{...task,supplies:[]},[{...legacyExtra,occurrence:{...task,state:'completed'}}]).length,0)
const context = careCardContext(fixture,withPrimary,new Date('2026-09-16T12:00:00Z'))
assert.equal(context.supplies.length,2,'Without an actually due appendix the parent remains standalone')
// End-to-end pure projection for a due #4 integrated extra (no phantom V1 child task).
const since = '2026-09-01T00:00:00.000Z'
const rid='p17a-main', cid='p17a-extra'
const main: Routine={...data.routines[0],id:rid,workspaceId:data.workspace.id,createdAt:since,actionId:'p17a-action',name:'Primary',parentRoutineId:undefined,
  recurrence:{kind:'interval',interval:1,unit:'day',anchorDate:'2026-09-01'},scheduleMode:'fixed',timeOfDay:'10:00',routineTimezone:'UTC',
  status:'active',revision:1,supplyIdsOverride:['p17a-3'],targetEntityIds:[fixture.entities[0].id],includeDescendantTargetIds:[], assignment:{mode:'everyone'},reminder:{mode:'at_due'},
  exceptions:{excludedDates:[],includedDateTimes:[]}}
const child: Routine={...main,id:cid,actionId:'p17a-extra-action',parentRoutineId:rid,triggerEvery:4,supplyIdsOverride:['p17a-3','p17a-2','p17a-0']}
let integrated: WorkspaceData={...fixture,workspace:{...fixture.workspace,timezone:'UTC'},extraCareMode:'integrated',routines:[main,child],
  actions:[...fixture.actions,{...fixture.actions[0],id:'p17a-action',defaultSupplyIds:['p17a-3']},{...fixture.actions[0],id:'p17a-extra-action',defaultSupplyIds:['p17a-3','p17a-2','p17a-0']}],tasks:[],extraCareEvents:[],extraCareLegacyCarries:[]}
for(let n=1;n<=4;n++) integrated=materializeRoutineSlot(integrated,main,`2026-09-${String(n).padStart(2,'0')}T10:00:00.000Z`)
const primary4=integrated.tasks.find(t=>t.triggerOrdinal===4)!
assert.deepEqual(additionalActivityAppendix(integrated,primary4).map(e=>e.status),['due'])
assert.deepEqual(careCardContext(integrated,primary4,new Date('2026-09-04T09:00:00Z')).supplies.map(s=>s.name),['Empty bottle','Low supply','Available bottle'])
for (const lang of ['en','it'] as const) for (const key of ['cardDetails','allRequiredSupplies','cardStockQuantityHint','stockQuantityNotReported'] as const)
  assert.ok(translate(lang,key).length>0)
const card=readFileSync('src/components/overview/CareCard.tsx','utf8')
const stock=readFileSync('src/components/overview/CareCardSupplies.tsx','utf8')
const hook=readFileSync('src/components/overview/useOverviewViewport.ts','utf8')
const css=readFileSync('src/styles/overview-v2.css','utf8')
assert.ok(card.indexOf('v2-care-scroll-content') < card.indexOf('v2-care-actions'),'Fixed actions are outside the scrollable body')
assert.ok(stock.includes('aria-haspopup="dialog"') && stock.includes('<Sheet') && stock.includes('hiddenCount > 0'))
assert.ok(stock.includes('supply.quantity == null') && stock.includes("t('stockQuantityNotReported')"))
assert.ok(hook.includes('window.visualViewport') && hook.includes('ResizeObserver') && hook.includes('getBoundingClientRect().bottom'))
assert.ok(css.includes('v2-overview-scroll-fallback') && css.includes('env(safe-area-inset-bottom)'))
assert.ok(css.includes('.v2-care-scroll-content') && css.includes('overflow-y:auto'))
console.log('Phase 17A stock order, dedupe, active Extra Care, 4/+N, unknown amounts, EN/IT and CSS/component contract tests passed')
