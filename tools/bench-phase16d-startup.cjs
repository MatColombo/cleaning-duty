/** Offline parsing-only reproducible microbenchmark. NOT a browser/cloud waterfall. */
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const { performance } = require('node:perf_hooks')
const { resolve, join } = require('node:path')
const root = resolve(__dirname, '..')
const household = JSON.parse(readFileSync(join(root, 'tests/fixtures/pre-v2-household-backup.json'), 'utf8')).data
const envelope = JSON.stringify({ schema: 2, appVersion: JSON.parse(readFileSync(join(root,'package.json'))).version,
  scope: `bench-user:${household.workspace.id}`, cachedAt: new Date().toISOString(), data: household })
const sample = []
for (let i = 0; i < 1000; i++) {
  const before = performance.now()
  const data = JSON.parse(envelope).data
  if (data.workspace.id !== household.workspace.id) throw Error('Invalid workspace identity')
  sample.push(performance.now() - before)
}
sample.sort((a,b)=>a-b)
const median = sample[499]
const p95 = sample[949]
const result = {
  kind: 'local JSON snapshot parse-only microbenchmark', runtime: process.version, device: process.platform,
  trials: sample.length, bytes: Buffer.byteLength(envelope), medianMs: +median.toFixed(4), p95Ms: +p95.toFixed(4),
  before: { knownHardcodedBootHoldMs: 520, exitAnimationMs: 360, requestsBeforeHouseholdFetch: 'catalog request(s) plus duplicate claim+membership requests', fullHouseholdFetch: '18 parallel tables and optional capability reads', measuredColdStartupMs: null, measuredWarmStartupMs: null },
  after: { knownHardcodedBootHoldMs: 0, exitAnimationMs: 120, requestedTablesAfterCachedRender: 18, cachedOverviewCanRenderBeforeFullFetch: true, duplicateClaimMembershipSkippedAfterFreshCatalog: true, measuredColdStartupMs: null, measuredWarmStartupMs: null },
  limitations: 'Parse timings are real process measurements; boot hold is source-defined, not wall-clock timing. No React bundle, network, device, installed PWA or first-paint time was measured.'
}
const output = process.argv[2]
if (output) { mkdirSync(resolve(output,'..'), {recursive:true}); writeFileSync(resolve(output),JSON.stringify(result,null,2)+'\n') }
console.log(JSON.stringify(result))
