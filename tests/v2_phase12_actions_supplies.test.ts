declare const require: (name: string) => any
import type { ActionDefinition, StockStatus, Supply, WorkspaceData } from '../src/types/domain'
import { actionLibraryVisual, activeActionReferences, filterActionLibrary } from '../src/components/actions/actionPresentation'
import { activeSupplyReferences, filterSupplyLibrary, supplyLibraryVisual, supplyPrimitiveId, supplyStatusCounts } from '../src/components/supplies/supplyPresentation'
import { getPrimitiveDefinition } from '../src/visual/registry'
import { applyMutationLocally } from '../src/lib/mutations'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const actions = data.actions.filter((action) => !action.archivedAt)
const supplies = data.supplies.filter((supply) => !supply.archivedAt)
assert.ok(actions.length >= 4 && supplies.length >= 3)

// Action identities do not borrow routine/task occurrence data or create extra domain fields.
for (const action of actions) {
  const first = actionLibraryVisual(action)
  assert.deepEqual(first, actionLibraryVisual(structuredClone(action)))
  assert.ok(getPrimitiveDefinition(first.subjectId))
  assert.ok(first.identityKey.includes(action.id))
  assert.equal(first.identityKey, actionLibraryVisual({ ...action, name: 'Renamed / Rinominata' }).identityKey)
}
for (const [name, expectedSubject] of [
  ['Vacuum', 'vacuum'], ['Aspirare', 'vacuum'], ['Dust', 'duster'], ['Spolverare', 'duster'],
  ['Mop', 'mop'], ['Degrease', 'spray-bottle'], ['Descale', 'cleaner-bottle'],
  ['Unknown Xylophonic Maintenance', 'generic-tool'],
]) {
  assert.equal(actionLibraryVisual({ id: `action-${name}`, name }).subjectId, expectedSubject, `Action: ${name}`)
}
assert.equal(filterActionLibrary(actions, supplies, '', 'all').length, actions.length)
assert.equal(filterActionLibrary(actions, supplies, 'degrease', 'all').length, 1)
assert.equal(filterActionLibrary(actions, supplies, 'DEGREASER', 'all').length, 1, 'Supply references remain searchable')
assert.ok(filterActionLibrary(actions, supplies, '', 'vacuum').every((item) => item.name === 'Vacuum'))
assert.equal(filterActionLibrary(actions, supplies, 'fictional-not-in-library', 'all').length, 0)
const italian: ActionDefinition = { ...actions[0], id: 'italian-action', name: 'Disinfettare con microfibra', instructions: 'Istruzioni caffè' }
assert.equal(filterActionLibrary([italian], supplies, 'CAFFE', 'all').length, 1, 'Accent-insensitive action search')
const longAction = { ...actions[0], id: 'long-name-action', name: 'Unbounded-cleaning-word'.repeat(120) }
assert.doesNotThrow(() => actionLibraryVisual(longAction))
assert.equal(activeActionReferences(actions[0].id, data.routines), true)
assert.equal(activeActionReferences('not-referenced', data.routines), false)
assert.equal(activeActionReferences(actions[0].id, data.routines.map((routine) => ({...routine, archivedAt:'2020-01-01'}))), false)

// Supply inventory: qualitative state drives expressions, quantity remains optional data.
assert.equal(supplyPrimitiveId('Degreaser'), 'spray-bottle')
assert.equal(supplyPrimitiveId('Detergente per vetri'), 'spray-bottle')
assert.equal(supplyPrimitiveId('Sponges'), 'sponge')
assert.equal(supplyPrimitiveId('Panni in microfibra'), 'microfiber-stack')
assert.equal(supplyPrimitiveId('Dishwasher tablets'), 'tablet-pack')
assert.equal(supplyPrimitiveId('Pastiglie lavastoviglie'), 'tablet-pack')
assert.equal(supplyPrimitiveId('Kitchen paper'), 'paper-roll')
assert.equal(supplyPrimitiveId('Xylophonic Thing'), 'generic-supply')
assert.equal(supplyPrimitiveId('dishwasher-tabletish'), 'generic-supply', 'Reject token substring false positives')
const states: readonly StockStatus[] = ['available','low','reserve_only','out_of_stock']
const expressions = ['proud','worried','focused','tired']
for (const supply of supplies) {
  const visual = supplyLibraryVisual(supply)
  assert.deepEqual(visual, supplyLibraryVisual(structuredClone(supply)))
  assert.ok(getPrimitiveDefinition(visual.subjectId))
  assert.ok(visual.identityKey.includes(supply.id))
  for (let i = 0; i < states.length; i++) {
    const edition = supplyLibraryVisual({ ...supply, status: states[i] })
    assert.equal(edition.expression, expressions[i]); assert.equal(edition.identityKey, visual.identityKey)
  }
}
assert.deepEqual(supplyStatusCounts(supplies), { available: 1, low: 1, reserve_only: 1, out_of_stock: 0 })
assert.equal(filterSupplyLibrary(supplies, '', 'all').length, 3)
assert.equal(filterSupplyLibrary(supplies, 'BOTTLES', 'available').length, 1, 'Unit search')
assert.equal(filterSupplyLibrary(supplies, 'degreaser', 'low').length, 1)
assert.equal(filterSupplyLibrary(supplies, '', 'out_of_stock').length, 0)
assert.equal(activeSupplyReferences(supplies[0].id, data.actions, data.routines), true)
assert.equal(activeSupplyReferences('unknown', data.actions, data.routines), false)
assert.equal(activeSupplyReferences(supplies[0].id, data.actions.map((action) => ({ ...action, archivedAt: '2020-01-01' })), data.routines.map((routine) => ({ ...routine, archivedAt: '2020-01-01' }))), false)
const longSupply: Supply = { ...supplies[0], id: 'long-supply-id', name: 'AnticalcareStraordinario'.repeat(150) }
assert.doesNotThrow(() => supplyLibraryVisual(longSupply))
const archivedSupply = {...supplies[0], archivedAt: '2020-01-01'}
assert.equal(filterSupplyLibrary([archivedSupply], '', 'all').length, 0)
assert.equal(supplyStatusCounts([archivedSupply]).low, 0)

// A real quick status report preserves optional quantity/unit and source-task audit context.
const sourceSupply = supplies[0]
const reported = applyMutationLocally(data, {
  id: 'p12-stock-mutation', workspaceId: data.workspace.id, kind: 'supply_status',
  supplyId: sourceSupply.id, status: 'available', expectedVersion: sourceSupply.version,
  eventId: 'p12-stock-event', eventAt: '2026-09-16T12:15:00.000Z', sourceTaskId: data.tasks[0]?.id,
})
const afterStock = reported.supplies.find((item) => item.id === sourceSupply.id)!
assert.equal(afterStock.status, 'available')
assert.equal(afterStock.quantity, sourceSupply.quantity, 'Qualitative status update must not rewrite quantity')
assert.equal(afterStock.unit, sourceSupply.unit)
assert.equal(afterStock.version, sourceSupply.version + 1)
const reportEvent = reported.supplyEvents.find((event) => event.id === 'p12-stock-event')!
assert.equal(reportEvent.type, 'STOCK_CHANGED')
assert.equal(reportEvent.metadata.sourceTaskId, data.tasks[0]?.id)
assert.equal(reportEvent.metadata.from, sourceSupply.status)
assert.equal(reportEvent.metadata.to, 'available')
const staleStock = applyMutationLocally(reported, {
  id: 'p12-stale-stock', workspaceId: data.workspace.id, kind: 'supply_status', supplyId: sourceSupply.id,
  status: 'out_of_stock', expectedVersion: sourceSupply.version, eventId: 'p12-stale-event', eventAt: '2026-09-16T12:16:00.000Z',
})
assert.equal(staleStock, reported, 'Stale quick updates keep optimistic concurrency protection')

// HTML carries operational meaning; graphics are not needed for actions/status.
const actionPage = readFileSync('src/pages/ActionsPage.tsx', 'utf8')
const supplyPage = readFileSync('src/pages/SuppliesPage.tsx', 'utf8')
const actionCard = readFileSync('src/components/actions/ActionLibraryCard.tsx', 'utf8')
const supplyCard = readFileSync('src/components/supplies/SupplyLibraryCard.tsx', 'utf8')
const actionEditor = readFileSync('src/components/actions/ActionEditorSheet.tsx', 'utf8')
const supplyEditor = readFileSync('src/components/supplies/SupplyEditorSheet.tsx', 'utf8')
const stockHistory = readFileSync('src/components/supplies/SupplyHistorySheet.tsx', 'utf8')
const dataContext = readFileSync('src/contexts/DataContext.tsx', 'utf8')
const actionCss = readFileSync('src/styles/actions-v2.css','utf8')
const supplyCss = readFileSync('src/styles/supplies-v2.css','utf8')
assert.ok(actionPage.includes('<ActionLibraryCard') && actionPage.includes('<ActionEditorSheet'))
assert.ok(supplyPage.includes('<SupplyLibraryCard') && supplyPage.includes('<SupplyHistorySheet') && supplyPage.includes('<SupplyEditorSheet'))
assert.ok(actionCard.includes('action.instructions') && actionCard.includes('action.defaultSupplyIds') && actionCard.includes('action.revision'))
assert.ok(actionCard.includes('disabled={used}') && actionCard.includes('onArchive(action.id)'))
assert.ok(supplyCard.includes('supply.quantity') && supplyCard.includes('supply.unit') && supplyCard.includes('aria-pressed={supply.status === status}'))
assert.ok(supplyCard.includes('disabled={inUse}') && supplyCard.includes('await onStatusChange(supply.id, status)'))
assert.ok(stockHistory.includes('data.supplyEvents.filter') && stockHistory.includes('formatTaskDateTime'))
assert.ok(actionEditor.includes('await updateAction(action.id, input)') && actionEditor.includes('await addAction(input)'))
for (const field of ['name: name.trim()', 'icon: icon.trim()', 'instructions: instructions.trim()', 'defaultSupplyIds, metadata', '<MetadataFields', 'setDefaultSupplyIds']) assert.ok(actionEditor.includes(field), `Action editor: ${field}`)
assert.ok(supplyEditor.includes('await updateSupply(supply.id, input)') && supplyEditor.includes('await addSupply(input)'))
for (const field of ['name: name.trim()', 'icon: icon.trim()', 'status', 'quantity:', 'unit:', 'metadata', '<MetadataFields', 'setStatus(item)']) assert.ok(supplyEditor.includes(field), `Supply editor: ${field}`)
assert.ok(supplyPage.includes('onStatusChange={setSupplyStatus}'), 'Status updates continue through offline-safe stock mutation')
assert.ok(dataContext.includes('kind: \'supply_status\'') && dataContext.includes('sourceTaskId'), 'Task-context stock report path remains canonical')
assert.ok(dataContext.includes('if (inUse) return current') && dataContext.includes('routine.actionId === id && !routine.archivedAt'), 'Domain archive guards preserved')
assert.ok(dataContext.includes('revision: item.revision + 1'), 'Action revisions unchanged')
for (const css of [actionCss,supplyCss]) assert.ok(css.includes('overflow-wrap: anywhere') || actionCss.includes('overflow-wrap: anywhere'))
assert.ok(actionCss.includes('prefers-reduced-motion') && actionCss.includes('body[data-v2-no-art'))
assert.ok(supplyCss.includes('body[data-v2-no-art') && supplyCss.includes('max-width: 425px'))
assert.ok(readFileSync('src/main.tsx','utf8').includes("import './styles/actions-v2.css'"))
assert.ok(readFileSync('src/main.tsx','utf8').includes("import './styles/supplies-v2.css'"))
assert.ok(!actionPage.includes('Math.random') && !supplyPage.includes('Math.random'))

console.log('Phase 12 tests passed: stable Action/Supply SVG identities, EN/IT fallbacks, status/quantity/history, archive guards, editor fields and accessible no-art presentation')
