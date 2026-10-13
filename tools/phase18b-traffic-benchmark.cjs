/** JSON-envelope measurements only. No backend, HTTP, network or database. */
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const os = require('node:os')
const root = join(__dirname, '..')
const workspaceId = '11111111-1111-4111-8111-111111111111'
const subjectId = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
const json = (value) => Buffer.byteLength(JSON.stringify(value))
const samples = [
  { label: 'pose-only', overrides: { pose: 'thumbs-up' } },
  { label: 'face + palette', overrides: { expression: 'joyful', eyes: 'proud', paletteVariant: 'teal' } },
  { label: 'all 13 configured controls', overrides: {
    subjectId: 'spray-bottle', expression:'proud',eyes:'joyful',mouth:'smile',brows:'focused',pose:'thumbs-up',
    handGesture:'thumb',scale:1.15,proportion:'tall',prop:'sparkle-4',scene:'kitchen',paletteVariant:'coral',animation:'gesture',
  } },
  { label:'Reset to Auto', overrides:{} },
]
const writeSamples = samples.map(({label,overrides}) => {
  const rpc = {p_workspace_id:workspaceId,p_subject_type:'routine',p_subject_id:subjectId,
    p_expected_revision:1,p_generator_version:2,p_overrides:overrides,p_mutation_id:id}
  return {label, overrideBytes:json(overrides), rpcJsonBytes:json(rpc), requestsPerConfirmation:1}
})
const sampleDbRow = {
  workspace_id:workspaceId, subject_type:'routine',subject_id:subjectId,generator_version:2,schema_version:1,
  overrides_json:samples[2].overrides,revision:2,last_mutation_id:id,updated_by:'44444444-4444-4444-8444-444444444444',updated_at:'2026-10-12T12:00:00Z',
}
const rows = Array.from({length:1000},(_,i)=>({...sampleDbRow,subject_id:`${String(i+1).padStart(8,'0')}-2222-4222-8222-222222222222`}))
const result = {
  method: 'Node Buffer.byteLength(JSON.stringify(...)); request bodies and row JSON only; excludes HTTP headers, TLS, PostgREST transport, row/index overhead, WAL, auth, PostgreSQL physical storage',
  runtime: process.version, host:os.platform(), sampleCount: samples.length,
  samples: writeSamples,
  read: { readsPerNormalHouseholdRefresh:1, pollingReads:0, sampleRowJsonBytes:json(sampleDbRow),
    thousandRowsJsonBytes:json(rows), sampledRows:1000 },
  drag: { networkRequestsDuringSliderMotion:0, confirmationRequests:1 },
  supabaseFreeQuota: 'Not measured against a live Supabase instance. No billing/storage statement is inferred.',
  liveRlsVerification:'NOT RUN', realHttpBytes:'NOT MEASURED', pgTableBytes:'NOT MEASURED', devicePerf:'NOT MEASURED',
}
const directory = join(root,'docs/qa/phase18b-evidence')
mkdirSync(directory,{recursive:true})
writeFileSync(join(directory,'traffic-json-benchmark.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
