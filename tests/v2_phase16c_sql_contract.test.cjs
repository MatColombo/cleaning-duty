/* Static SQL contract checks only. These do not execute or validate migration in PostgreSQL. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261012160000_v2_phase16c_recurrence.sql'),'utf8');
assert.match(sql,/create or replace function public\.v2_apply_after_completion\(p_payload jsonb\)/i);
assert.match(sql,/create or replace function public\.v2_commit_generated_occurrences/i);
assert.match(sql,/routine_revision=routine\.revision and state='scheduled' and id<>task\.id/i,
  'Completion must not mistake its own still-scheduled task for another successor');
assert.match(sql,/safe_successor_ids:=array_append/i);
assert.match(sql,/for old_successor in select \* from public\.task_occurrences where id=any\(safe_successor_ids\)/i,
  'Undo/reopen must reconcile safely proven survivors');
assert.match(sql,/create unique index if not exists v2_recurrence_one_successor_per_event/i);
assert.match(sql,/Only owner can activate 16C/);
assert.match(sql,/perform pg_advisory_xact_lock/);
assert.doesNotMatch(sql,/\bdrop table\b/i);
console.log('Phase 16C static SQL contract checks passed (Postgres execution NOT tested)');
