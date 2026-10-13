const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const migration = fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261012190000_v2_phase18b_visual_overrides.sql'),'utf8')
const rollback = fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261012190001_v2_phase18b_rollback.sql.example'),'utf8')
const rls = fs.readFileSync(path.join(__dirname,'../supabase/staging/v2_phase18b_rls_concurrency.sql'),'utf8')
const repo = fs.readFileSync(path.join(__dirname,'../src/lib/cloudRepository.ts'),'utf8')
const sync = fs.readFileSync(path.join(__dirname,'../src/lib/syncCoordinator.ts'),'utf8')
for (const token of ['create table if not exists public.visual_overrides','primary key (workspace_id, subject_type, subject_id)',
  'create policy v2_visual_read','public.is_workspace_member(workspace_id)','revoke all on public.visual_overrides',
  'create or replace function public.v2_visual_json_valid','octet_length(p_value::text) > 2048',
  'create or replace function public.v2_commit_visual_override','p_expected_revision','p_mutation_id',
  'v2_visual_applied_ops','for update','archived_at is null',
  "perform 1 from public.workspaces where id=p_workspace_id for update",'create trigger v2_visual_entity_delete',
  'create trigger v2_visual_action_delete','create trigger v2_visual_routine_delete']) {
  assert.ok(migration.includes(token),`Missing mandatory RLS/CAS/cleanup SQL clause: ${token}`)
}
for (const forbidden of ['alter table public.task_occurrences add','create or replace function public.complete_task','create or replace function public.undo_task','create publication supabase_realtime']) {
  assert.ok(!migration.toLowerCase().includes(forbidden),`V1 contract/backend service must not change: ${forbidden}`)
}
assert.ok(rollback.includes('DROP TABLE IF EXISTS public.visual_overrides'))
assert.ok(rollback.includes('DROP TRIGGER IF EXISTS v2_visual_routine_delete'))
assert.ok(rls.includes('ROLLBACK;') && rls.includes('member_b_uid') && rls.includes('outsider_uid') && rls.includes('Direct writes were incorrectly allowed'))
assert.ok(repo.includes("db.from('visual_overrides').select(") && repo.includes(".rpc('v2_commit_visual_override'"))
assert.ok(sync.includes('enqueueVisual(') && sync.includes("entry.type === 'visual'") && sync.includes('visualMutationConfirmed'))
console.log('Phase 18B staged SQL contract/RLS/CAS/legacy cleanup static audit PASS (SQL not executed)')
