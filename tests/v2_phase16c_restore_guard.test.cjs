/* Source contract only. The cloud query requires an actual staging run. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const cloud = fs.readFileSync(path.join(__dirname,'../src/lib/cloudRepository.ts'),'utf8');
const restore = cloud.slice(cloud.indexOf('export async function replaceCloudData('),cloud.indexOf('export async function archiveCloudWorkspace('));
assert.ok(restore.includes("'v2_extra_care_households'"));
assert.ok(restore.includes("'v2_recurrence_households'"));
assert.ok(restore.indexOf('for (const capabilityTable') < restore.indexOf("rpc('reset_workspace_content'"));
assert.match(restore,/if \(capabilityError && !\['42P01', 'PGRST205', 'PGRST116'\]/);
assert.ok(restore.includes('if (enrolled) throw new Error'), 'Destination ledger must be checked, not only uploaded backup markers.');
console.log('Phase 16C cloud restore preflight source check PASS (staging NOT RUN)');
