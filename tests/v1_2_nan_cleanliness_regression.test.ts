const assert = { equal: (a: unknown, b: unknown, msg: string) => { if (a !== b) throw new Error(`${msg}: ${String(a)} !== ${String(b)}`) }, deepEqual: (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Arrays differ') } }
function check(value: boolean, message: string) { if (!value) throw new Error(message) }
import { aggregateCleanliness, cleanlinessForTrajectory } from '../src/lib/cleanliness'
import type { WorkspaceData, HealthTrajectory } from '../src/types/domain'

const now = '2026-10-30T00:00:00.000Z'
const healthy: HealthTrajectory = { workspaceId:'w', itemId:'valid', routineId:'r1', cleanlinessChannel:'regular', healthAnchorAt:'2026-10-29T00:00:00.000Z', healthAnchorPct:100, healthDueAt:'2026-10-31T00:00:00.000Z', healthOverdueEndAt:'2026-11-02T00:00:00.000Z', updatedAt:now }
const broken: HealthTrajectory = { ...healthy, itemId:'invalid', routineId:'r2', healthAnchorPct:NaN }
const makeRoutine = (id:string, itemId:string) => ({id, workspaceId:'w', name:id, actionId:'a', targetEntityIds:[itemId], includeDescendantTargetIds:[], recurrence:{kind:'daily' as const,interval:2,anchorDate:'2026-10-01'}, timeOfDay:'00:00', routineTimezone:'UTC', scheduleMode:'fixed' as const, exceptions:{excludedDates:[],includedDateTimes:[]}, assignment:{mode:'unassigned' as const}, reminder:{mode:'none' as const}, cleanlinessChannel:'regular' as const, careLevel:'routine' as const, refreshLevelPct:100, status:'active' as const, revision:1, createdAt:now})
const data = { workspace:{id:'w', name:'Home', timezone:'UTC', careSensitivity:'balanced', createdAt:now}, entities:[{id:'valid', workspaceId:'w',typeId:'t',name:'Valid',labels:[],metadata:{},createdAt:now},{id:'invalid', workspaceId:'w',typeId:'t',name:'Invalid',labels:[],metadata:{},createdAt:now}], routines:[makeRoutine('r1','valid'),makeRoutine('r2','invalid')], healthTrajectories:[healthy, broken], tasks:[], taskEvents:[], completionSnapshots:[] } as unknown as WorkspaceData
check(Number.isNaN(cleanlinessForTrajectory(broken, now)), 'Invalid input must remain detectable')
const aggregate = aggregateCleanliness(data, ['valid','invalid'], 'regular', now)
assert.equal(aggregate.score, 50, 'One invalid trajectory must not poison a valid aggregate')
assert.deepEqual(aggregate.itemScores.map((x) => x.itemId), ['valid'])
assert.equal(aggregateCleanliness(data, ['invalid'], 'regular', now).score, null, 'All-invalid aggregate must be Not tracked, not 0%')
const deepData = { ...data, routines: data.routines.map((r) => ({ ...r, cleanlinessChannel: 'deep', careLevel: 'deep' })), healthTrajectories: data.healthTrajectories.map((t) => ({ ...t, cleanlinessChannel: 'deep' })) } as WorkspaceData
assert.equal(aggregateCleanliness(deepData, ['valid','invalid'], 'deep', now).score, 50, 'Deep channel must also ignore invalid trajectories')
console.log('v1 NaN cleanliness regression tests passed')
