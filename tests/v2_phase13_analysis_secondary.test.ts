declare const require: (name: string) => any
import type { WorkspaceData } from '../src/types/domain'
import { todayActivitySummary, activityOutcomeSummary, cleanlinessTrend, historyEntriesV12 } from '../src/lib/analytics'
import { outcomeBarShares } from '../src/components/analysis/analysisPresentation'
import { localDateInZone } from '../src/lib/date'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const now = new Date('2026-09-16T18:00:00.000Z')

// Presentation geometry never changes analytics counts or introduces negative/NaN segments.
assert.deepEqual(outcomeBarShares([12, 3, 5]), [60, 15, 25])
assert.deepEqual(outcomeBarShares([0, 0, 0]), [0, 0, 0])
assert.deepEqual(outcomeBarShares([12, -2, Number.NaN]), [100, 0, 0])
assert.ok(Math.abs(outcomeBarShares([3, 4, 11]).reduce((a,b) => a+b, 0) - 100) < 0.00001)
const today = todayActivitySummary(data, now)
const outcomes = activityOutcomeSummary(data, 30, now)
const trend = cleanlinessTrend(data, 30, now)
const history = historyEntriesV12(data, 30, now)
for (const value of [today.completed, today.skipped, today.rescheduled, today.roomsMaintained, outcomes.completed, outcomes.skipped, outcomes.rescheduled]) assert.ok(Number.isFinite(value) && value >= 0)
assert.ok(trend.length > 0 && trend.every((p) => p.regular === null || (p.regular >= 0 && p.regular <= 100)))
assert.ok(trend.every((p) => p.deep === null || (p.deep >= 0 && p.deep <= 100)))
for (const entry of history) assert.ok(data.tasks.some((task) => task.id === entry.taskId))
for (const entry of history) assert.match(localDateInZone(data.workspace.timezone, new Date(entry.at)), /^\d{4}-\d{2}-\d{2}$/)

const page = readFileSync('src/pages/InsightsPage.tsx','utf8')
const view = readFileSync('src/components/analysis/AnalysisDashboard.tsx','utf8')
const sheet = readFileSync('src/components/Sheet.tsx','utf8')
const settings = readFileSync('src/pages/SettingsPage.tsx','utf8')
const auth = readFileSync('src/pages/AuthPage.tsx','utf8')
const setup = readFileSync('src/pages/SetupPage.tsx','utf8')
const analysisCss = readFileSync('src/styles/analysis-v2.css','utf8')
const secondaryCss = readFileSync('src/styles/secondary-v2.css','utf8')
const imports = readFileSync('src/main.tsx','utf8')

// Data inputs, time window and grouping are identical to the original Analysis implementation.
for (const expression of ['todayActivitySummary(data, now)','activityOutcomeSummary(data, days, now)','cleanlinessTrend(data, days, now)','historyEntriesV12(data, Math.max(days, 30), now)','localDateInZone(data.workspace.timezone, new Date(entry.at))']) {
  assert.ok(page.includes(expression), `Canonical analytics input missing: ${expression}`)
}
assert.ok(page.includes('<AnalysisDashboard') && !page.includes('generateCardVisualRecipe'))
assert.ok(!view.includes('Math.random') && !view.includes('Date.now()'))
for (const label of ["t('completed')", "t('skipped')", "t('rescheduled')", "t('roomsMaintained')", "t('regularCleanliness')", "t('deepCleanliness')", "t('history')"]) assert.ok(view.includes(label), `Analysis label: ${label}`)
assert.ok(view.includes('<CleanlinessChart') && view.includes('outcomeBarShares('))
assert.ok(view.includes('points={trend}') && view.includes('role="img"') && view.includes('aria-label={`${label}:'))
assert.ok(view.includes('entry.health.map(') && view.includes('entry.previousDueAt') && view.includes('entry.newDueAt'))
assert.ok(view.includes('to={`/task/${entry.taskId}`}'), 'Event links must preserve exact task occurrence identity')
assert.ok(view.includes('aria-pressed={period === days}') && view.includes('onClick={() => onDaysChange(period)}'))
assert.ok(view.includes('outcomes.completed') && view.includes('outcomes.skipped') && view.includes('outcomes.rescheduled'))
assert.ok(view.includes('today.everythingHandled') && view.includes('today.plannedCount === 0'))
assert.ok(!view.includes('<image') && !view.includes('<foreignObject'))

// Shared sheet focus/dismissal behavior must remain authoritative.
for (const requirement of ["nextWrappedFocus(", "event.key === 'Escape'", "event.key !== 'Tab'", "previousFocus?.focus()", "previousOverflow", "onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}", 'role="dialog" aria-modal="true"', 'aria-labelledby={titleId}', 'createPortal(content, document.body)']) {
  assert.ok(sheet.includes(requirement), `Sheet behavior missing: ${requirement}`)
}
assert.ok(sheet.includes('className="sheet hc-v2-sheet"'))

// Auth/setup/settings retain their existing calls and user-visible fields.
for (const field of ['signIn(email, password)','signUp(email, password)','type="email"','type="password"','setMode(', 'disabled={busy}']) assert.ok(auth.includes(field))
for (const field of ['createWorkspace(name.trim(), ownerName.trim(), timezone)','restoreWorkspace(id)', 'deleteWorkspace(id)', 'typed !== workspaceName', 'value={name}', 'value={ownerName}']) assert.ok(setup.includes(field))
for (const field of ['updateWorkspace(', 'addMember(', 'updateMemberAssignmentProfile(', 'addFieldDefinition(', 'updateFieldDefinition(', 'createHouseholdBackup(data!)', 'parseHouseholdBackup(', 'setAppearancePreferences(', 'togglePush()', 'installApp()', '<ErrorLogPanel', 'resetLocal()']) assert.ok(settings.includes(field), `Settings operation missing: ${field}`)
assert.ok(settings.includes('new URLSearchParams(location.search).get(\'errors\') === \'1\''))
for (const css of [analysisCss,secondaryCss]) assert.ok(css.includes('prefers-reduced-motion') && css.includes('body[data-v2-no-art="true"]'))
assert.ok(analysisCss.includes('overflow-wrap:anywhere') && analysisCss.includes('max-width:560px'))
assert.ok(secondaryCss.includes(':focus-visible') && secondaryCss.includes('max-height:min(92dvh,880px)'))
assert.ok(imports.includes("import './styles/analysis-v2.css'"))
assert.ok(imports.includes("import './styles/secondary-v2.css'"))

console.log('Phase 13 tests passed: canonical analytics inputs, actual history/task projections, outcome shares, sheet focus/dismissal, settings/auth/setup feature parity and responsive/no-art safeguards')
