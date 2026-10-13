/** Serialized RPC envelope sizes, not captured Supabase wire traffic or actual PG disk bytes. */
const fs=require('node:fs')
const {TextEncoder}=require('node:util')
const encoder=new TextEncoder()
const bytes=(value)=>encoder.encode(JSON.stringify(value)).byteLength
const mid='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const wid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const item=(i)=>({id:`prop-${i}`,kind:['plant','lamp','picture','tiles'][i%4],ink:['teal','coral','mustard','ink'][i%4],layer:i%2?'behind':'above',x:100+i*41,y:80+i*30,scale:1+(i%3)*.1,rotation:(i%8)*15})
const send=(items)=>({p_workspace_id:wid,p_scene_id:sid,p_expected_revision:2,p_generator_version:1,p_items:items,p_mutation_id:mid})
const samples=[{label:'reset-to-auto-existing-row',items:[]},{label:'one-prop-confirmation',items:[item(0)]},{label:'four-curated-props',items:Array.from({length:4},(_,i)=>item(i))},{label:'sixteen-curated-props',items:Array.from({length:16},(_,i)=>item(i))}]
const variants=samples.map(v=>({label:v.label,propCount:v.items.length,serializedRpcEnvelopeBytes:bytes(send(v.items)),serializedJsonbItemsBytes:bytes(v.items)}))
const testChanges=180
const output={context:'Locally serialized JSON UTF-8 RPC argument envelopes only; excludes HTTP headers, TLS, auth, PostgREST meta, Supabase network framing, indexes, TOAST and DB page overhead.',runtime:process.version,maximumPropertiesPerScene:16,maximumItemsJsonBytes:6144,sceneRowSuggestedStorage:'One row per household/scene containing explicit customized props; reset stores [] revision tombstone, defaults have no row.',sampleRequests:variants,exampleSliderChangesBeforeConfirmation:testChanges,simulatedRequestsDuringDrag:0,simulatedRequestsOnSingleConfirm:1,simulatedRequestReductionVersusPerSliderWritesPercent:Number(((1-1/testChanges)*100).toFixed(2)),hypothetical100ScenesMaxItemsJsonBytes:100*6144,pgPhysicalRowSize:'NOT MEASURED — must use pg_total_relation_size / pg_column_size on staging',liveCloudRequests:'NOT MEASURED'}
const outputPath=process.argv[2]
if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output,null,2))
