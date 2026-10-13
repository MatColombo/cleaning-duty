/** Reproducible pure renderer benchmark; excludes DOM, network, browser and mobile FPS. */
const {mkdtempSync,rmSync,mkdirSync,writeFileSync}=require('node:fs')
const {tmpdir}=require('node:os')
const {join}=require('node:path')
const {spawnSync}=require('node:child_process')
const {performance}=require('node:perf_hooks')
const root=join(__dirname,'..')
const out=mkdtempSync(join(tmpdir(),'hc-18a-bench-'))
try {
  let command='tsc', args=[]
  try {command=process.execPath;args=[require.resolve('typescript/bin/tsc')]} catch { /* system TypeScript */ }
  const r=spawnSync(command,[...args,'--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',join(root,'src'),'--outDir',out,
    join(root,'src/visual/studio/preview.ts'),join(root,'src/lib/theme.ts')],{cwd:root,stdio:'inherit'})
  if(r.status !== 0) process.exit(r.status || 1)
  const { generateCardVisualRecipe }=require(join(out,'visual/procedural/recipe.js'))
  const { renderStudioPreviewSvg }=require(join(out,'visual/studio/preview.js'))
  const { vectorPaletteFromTheme }=require(join(out,'visual/palette.js'))
  const { themePreset }=require(join(out,'lib/theme.js'))
  const p=vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const recipe=generateCardVisualRecipe({routineId:'bench-18a',actionId:'care',primaryTargetId:'oven',occurrenceId:'18a-1',triggerOrdinal:1,subjectName:'Oven',subjectTypeName:'Appliance',actionName:'Degrease',environmentName:'Kitchen'})
  const specs=[{}, {subjectId:'spray-bottle'}, {expression:'joyful', eyes:'surprised',brows:'focused',mouth:'smile'},
    {pose:'thumbs-up',handGesture:'thumb'}, {scale:1.25,proportion:'tall'}, {scene:'bathroom',prop:'steam',paletteVariant:'coral'}]
  const samples=[]
  const before=process.memoryUsage().heapUsed
  const start=performance.now()
  for(let index=0;index<1200;index++){
    const svg=renderStudioPreviewSvg(recipe,specs[index%specs.length],`bench-${index}`,p)
    samples.push({bytes:Buffer.byteLength(svg,'utf8'),paths:(svg.match(/<path\b/g)||[]).length,groups:(svg.match(/<g\b/g)||[]).length})
  }
  const durationMs=performance.now()-start
  const after=process.memoryUsage().heapUsed
  const range=(key)=>({min:Math.min(...samples.map(s=>s[key])),max:Math.max(...samples.map(s=>s[key])),mean:Math.round(samples.reduce((sum,s)=>sum+s[key],0)/samples.length)})
  const metrics={context:'Isolated Node.js pure SVG rendering; not a React app, UI frame rate, mobile GPU, or cloud traffic measurement',runtime:process.version,
    cases:specs.length,renderIterations:samples.length,durationMs:Number(durationMs.toFixed(2)),meanMs:Number((durationMs/samples.length).toFixed(4)),
    svgBytes:range('bytes'),svgPathCount:range('paths'),svgGroupCount:range('groups'),heapBeforeBytes:before,heapAfterBytes:after,
    realDeviceFPS:'NOT MEASURED',browserCPUAndMemory:'NOT MEASURED',cloudRequests:'No added transport in Studio sources (static audit); browser network trace NOT RUN'}
  mkdirSync(join(root,'docs/qa/phase18a-evidence'),{recursive:true})
  writeFileSync(join(root,'docs/qa/phase18a-evidence/metrics.json'),JSON.stringify(metrics,null,2)+'\n')
  console.log(JSON.stringify(metrics,null,2))
}finally{rmSync(out,{recursive:true,force:true})}
