declare const require: (name: string) => any
import { buildOverviewGroups } from '../src/lib/overview'
import { buildActiveDeck, careCardContext, nextDeckIndex, overdueCalendarDays } from '../src/lib/overviewDeck'
import { applyMutationLocally } from '../src/lib/mutations'
import { additionalActivityAppendix } from '../src/lib/presentation'
import { cardVisualInputFromDomain } from '../src/visual/procedural/resolver'
import { getCardVisualRecipe } from '../src/visual/procedural/cache'
import { renderCardVisualSvg } from '../src/visual/procedural/render-card'
import { translate } from '../src/lib/translations'
import type { TaskOccurrence, WorkspaceData } from '../src/types/domain'
const { readFileSync } = require('node:fs')
const assert = require('node:assert/strict')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const now = new Date('2026-09-16T12:00:00.000Z')
const all = () => buildOverviewGroups(data, { now, scope: 'household', criticalCount: 3, criticalThreshold: 75 })
const overdue = data.tasks.find((task) => task.id.endsWith('0060'))!
const completed = data.tasks.find((task) => task.id.endsWith('0061'))!
const due = data.tasks.find((task) => task.id.endsWith('0062'))!
const futureParent = data.tasks.find((task) => task.id.endsWith('0063'))!
const futureChild = data.tasks.find((task) => task.id.endsWith('0064'))!
assert.ok(overdue && completed && due && futureParent && futureChild, 'Regression household contains known task identities')

// The deck is precisely the canonical active-today projection, NOT the history/next-seven-day sections.
const groups = all()
const deck = buildActiveDeck(groups)
assert.deepEqual(deck.map((entry) => entry.task.id), [...groups.overdue, ...groups.dueNow, ...groups.laterToday].map((task) => task.id))
assert.ok(deck.some((entry) => entry.task.id === overdue.id && entry.priority === 'overdue'))
assert.ok(deck.some((entry) => entry.task.id === due.id && entry.priority === 'dueNow'))
assert.ok(!deck.some((entry) => entry.task.id === completed.id || entry.task.id === futureParent.id || entry.task.id === futureChild.id))
assert.equal(nextDeckIndex(3, 0, -1), 2)
assert.equal(nextDeckIndex(3, 2, 1), 0)
assert.equal(nextDeckIndex(0, 0, 1), 0)
assert.equal(overdueCalendarDays('2026-09-15T19:30:00.000Z', now, 'Europe/Rome'), 1, 'Household day may differ from UTC day')
assert.equal(overdueCalendarDays('2026-10-25T00:30:00.000Z', new Date('2026-10-26T10:00:00.000Z'), 'Europe/Rome'), 1, 'DST fall-back counts local calendar days')

// In a shared household the canonical scope predicate continues to control the deck.
const member = data.members[0]
const scoped = buildActiveDeck(buildOverviewGroups(data, { now, scope: 'mine', currentMemberId: member.id }))
const household = buildActiveDeck(buildOverviewGroups(data, { now, scope: 'household', currentMemberId: member.id }))
assert.ok(household.length >= scoped.length)
assert.ok(scoped.every((entry) => !entry.task.assigneeMemberId || entry.task.assigneeMemberId === member.id))

const context = careCardContext(data, overdue, now)
assert.deepEqual(context.supplyAlerts.map((alert) => alert.name), ['Degreaser'], 'Real stock status from snapshot ID')
assert.equal(context.supplyAlerts[0].status, 'low')
assert.equal(context.assignmentScope, overdue.assignmentScope)
assert.equal(typeof context.cleanlinessScore, 'number')
assert.equal(careCardContext({ ...data, routines: data.routines.map((r) => r.id === overdue.routineId ? {...r, affectsCleanliness: false} : r) }, overdue, now).cleanlinessScore, null)
assert.equal(careCardContext(data, due, now).supplyAlerts.length, 0)

// Parent appendix is based on a real child occurrence. The child keeps its own card and mutation lifecycle.
const linkedFixture = { ...data, tasks: data.tasks.map((task) => {
  if (task.id === futureParent.id || task.id === futureChild.id) return { ...task, effectiveDueAt: '2026-09-16T08:00:00.000Z', dueAt: '2026-09-16T08:00:00.000Z' }
  return task
}) }
const linkedGroups = buildOverviewGroups(linkedFixture, { now, scope: 'household' })
const linkedDeck = buildActiveDeck(linkedGroups)
assert.ok(linkedDeck.some(({task}) => task.id === futureParent.id))
assert.ok(linkedDeck.some(({task}) => task.id === futureChild.id), 'Child occurrence must be independently actionable')
assert.equal(linkedDeck.filter(({task}) => task.id === futureChild.id).length, 1, 'Child card is not duplicated')
assert.ok(additionalActivityAppendix(linkedFixture, futureParent).some((entry) => entry.occurrence?.id === futureChild.id))
assert.deepEqual(careCardContext(linkedFixture, futureParent, now).linkedChildren.map((task) => task.id), [futureChild.id])
assert.deepEqual(careCardContext(linkedFixture, futureChild, now).linkedChildren, [])
const hiddenChild = { ...linkedFixture, tasks: linkedFixture.tasks.filter((task) => task.id !== futureChild.id) }
assert.equal(careCardContext(hiddenChild, futureParent, now).linkedChildren.length, 0, 'Never show a configured-only phantom child')

// Real existing mutation: complete -> no duplicate -> Undo reopens the SAME occurrence.
const complete = applyMutationLocally(data, {
  id: 'p8-complete', workspaceId: data.workspace.id, kind: 'complete', taskId: overdue.id,
  expectedVersion: overdue.version, eventId: 'p8-completion-event', eventAt: '2026-09-16T12:03:00.000Z',
})
assert.equal(complete.tasks.length, data.tasks.length)
assert.ok(!buildActiveDeck(buildOverviewGroups(complete, {now:new Date('2026-09-16T12:04:00.000Z'), scope:'household'})).some(({task})=>task.id===overdue.id))
assert.ok(buildOverviewGroups(complete, {now:new Date('2026-09-16T12:04:00.000Z'), scope:'household'}).finished.some((task)=>task.id===overdue.id))
const updated = complete.tasks.find((task) => task.id === overdue.id)!
const undone = applyMutationLocally(complete, {
  id:'p8-undo', workspaceId:data.workspace.id, kind:'undo',taskId:overdue.id,
  expectedVersion:updated.version,sourceEventId:'p8-completion-event',eventId:'p8-undo-event',eventAt:'2026-09-16T12:05:00.000Z',
})
assert.equal(undone.tasks.length, data.tasks.length)
assert.ok(buildActiveDeck(buildOverviewGroups(undone,{now:new Date('2026-09-16T12:06:00.000Z'),scope:'household'})).some(({task})=>task.id===overdue.id))
const skipped = applyMutationLocally(data, {id:'p8-skip',workspaceId:data.workspace.id,kind:'skip',taskId:overdue.id,expectedVersion:overdue.version,eventId:'p8-skipped',eventAt:'2026-09-16T12:03:00.000Z'})
assert.ok(!buildActiveDeck(buildOverviewGroups(skipped,{now,scope:'household'})).some(({task})=>task.id===overdue.id))
const postponed = applyMutationLocally(data, {id:'p8-postpone',workspaceId:data.workspace.id,kind:'postpone',taskId:overdue.id,expectedVersion:overdue.version,eventId:'p8-postponed',eventAt:'2026-09-16T12:03:00.000Z',effectiveDueAt:'2026-09-19T12:00:00.000Z'})
assert.ok(!buildActiveDeck(buildOverviewGroups(postponed,{now,scope:'household'})).some(({task})=>task.id===overdue.id))
assert.equal(postponed.tasks.find((task)=>task.id===overdue.id)?.scheduledSlotAt, overdue.scheduledSlotAt)
assert.equal(postponed.tasks.length, data.tasks.length)

// All-new and historical unknown actions have branded, SVG-only fallback artwork.
const unknown: TaskOccurrence = { ...due, id:'p8-unknown', actionNameSnapshot:'BLOPRATRON',routineNameSnapshot:'Care for hyper-dimensional doohickey',
  targets:[{entityId:'missing', entityName:'Zxylnox', entityTypeName:'Alien technology', matchReasons:[]}], routineId:'missing-routine' }
const input = cardVisualInputFromDomain(unknown, data)
const first = getCardVisualRecipe(input)
assert.equal(first.semantics.level, 'generic')
assert.equal(first.semantics.subjectId, 'generic-surface')
assert.equal(getCardVisualRecipe(input), first, 'Module-level cache preserves identity across rendering')
const svg1 = renderCardVisualSvg(first, {instanceKey:'v2-p8-card-1',decorative:true})
const svg2 = renderCardVisualSvg(first, {instanceKey:'v2-p8-card-2',decorative:true})
assert.ok(svg1.includes('data-hc-card-subject="generic-surface"') && !svg1.includes('<image'))
const defs1 = [...svg1.matchAll(/id="(hc-card[^\"]+)"/g)].map((m) => m[1]); const defs2 = [...svg2.matchAll(/id="(hc-card[^\"]+)"/g)].map((m) => m[1])
assert.ok(defs1.length > 0 && defs2.length > 0)
assert.ok(!defs1.some((id) => defs2.includes(id)), 'Two live cards must not share SVG IDs')
assert.ok(svg1.includes('var(--hc-art-'), 'Theme substitution remains CSS-semantic')

// EN / IT parity and wiring checks until full React/Vite dependencies are available.
for (const language of ['en','it'] as const) for (const key of ['houseState','activeDeck','completeCard','extraCare','previousCard','nextCard','dayOverdue','daysOverdue','careCardCollected','careActionFailed','allHandledToday'] as const) assert.ok(translate(language,key).length>0)
const operational = readFileSync('src/pages/OperationalTasksPage.tsx','utf8')
const activeComponent = readFileSync('src/components/overview/ActiveDeck.tsx','utf8')
const card = readFileSync('src/components/overview/CareCard.tsx','utf8')
const css = readFileSync('src/styles/overview-v2.css','utf8')
assert.ok(operational.includes('buildOverviewGroups(') && operational.includes('<HouseState') && operational.includes('<ActiveDeck'))
assert.ok(operational.includes("view === 'timeline' && <>") && operational.includes('restoreTaskToToday('))
const completeHandler = operational.slice(operational.indexOf('async function completeDeckTask('), operational.indexOf('function chooseUpcomingDay('))
assert.ok(completeHandler.includes('await completeTask(id)') && completeHandler.indexOf('await completeTask(id)') < completeHandler.indexOf('setCompletionStamp('))
assert.ok(readFileSync('src/components/overview/CardArtwork.tsx','utf8').includes('FIVE_INK_CARD_PALETTE'), 'Card art limits print ink roles without changing the v1 recipe')
assert.ok(card.includes('CardArtwork') && card.includes('CareCardMeta') && card.includes('LinkedActivityAppendix') && card.includes('onMore(task.id)'))
assert.ok(activeComponent.includes('nextDeckIndex(') && !activeComponent.includes('groupLinkedTaskOccurrences('))
assert.ok(readFileSync('src/components/overview/CriticalEntityCard.tsx','utf8').includes('item.roomName'), 'Critical cards preserve room context')
assert.ok(css.includes('prefers-reduced-motion: reduce') && css.includes('max-height: 760px') && css.includes('overflow: visible'))
assert.ok(readFileSync('src/components/AppShell.tsx','utf8').includes('house-v2-cockpit-shell') && css.includes('.house-v2-cockpit-shell { padding-bottom: 0; }'), 'Only Overview removes the shell bottom spacer')
assert.ok(!activeComponent.includes('Math.random(') && !card.includes('Math.random('))
console.log('V2 Phase 8 deck ordering, mutation/undo, scope, linked child, fallback, localized presentation and responsive wiring tests passed')
