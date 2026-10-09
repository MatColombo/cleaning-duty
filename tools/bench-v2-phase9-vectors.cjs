/** Node CPU/SVG-byte proxy. NOT a mobile browser FPS or memory benchmark. */
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { performance } = require('node:perf_hooks')
const { spawnSync } = require('node:child_process')
const root=join(__dirname,'..'), temp=mkdtempSync(join(tmpdir(),'hc-v2-p9-bench-'))
try {
  const build=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),
    '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck',
    '--rootDir',join(root,'src'),'--outDir',temp,
    join(root,'src/visual/procedural/render-card.ts'),join(root,'src/visual/procedural/recipe.ts'),join(root,'src/lib/theme.ts')],
    {cwd:root,stdio:'inherit'})
  if(build.status!==0) process.exit(build.status||1)
  const { generateCardVisualRecipe }=require(join(temp,'visual/procedural/recipe.js'))
  const { renderCardVisualSvg }=require(join(temp,'visual/procedural/render-card.js'))
  const { vectorPaletteFromTheme }=require(join(temp,'visual/palette.js'))
  const { themePreset }=require(join(temp,'lib/theme.js'))
  const palette=vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const fixtures=[
    ['oven','degrease','Oven'],['sink','wipe','Sink'],['bookcase','dust','Bookcase'],
    ['washer','maintain','Washing machine'],['bathtub','wash','Bathtub'],
    ['zxylo','unknown action','Unclassifiable custom item'],
  ]
  const inputs=Array.from({length:10000},(_,i)=>{
    const [id,action,label]=fixtures[i%fixtures.length]
    return {routineId:`routine-${i%160}`,actionId:action,primaryTargetId:id,
      occurrenceId:`occ-${i}`,triggerOrdinal:i+1,subjectName:label,actionName:action}
  })
  const beforeRecipes=performance.now()
  const recipes=inputs.map(generateCardVisualRecipe)
  const recipeMs=performance.now()-beforeRecipes
  for(let i=0;i<20;i++)renderCardVisualSvg(recipes[i],{instanceKey:`warm-${i}`,palette})
  const measured=240, bytes=[], pathCounts=[], nestedSvgCounts=[]
  const beforeSvg=performance.now()
  for(let i=0;i<measured;i++){
    const svg=renderCardVisualSvg(recipes[i],{instanceKey:`bench-${i}`,palette})
    bytes.push(Buffer.byteLength(svg))
    pathCounts.push((svg.match(/<path\b/g)||[]).length)
    nestedSvgCounts.push((svg.match(/<svg\b/g)||[]).length)
    if(svg.includes('feTurbulence')||svg.includes('<image'))throw Error('Card renderer uses expensive filter or raster')
  }
  const svgMs=performance.now()-beforeSvg
  const sort=(a,b)=>a-b, sortedBytes=bytes.slice().sort(sort), sortedPaths=pathCounts.slice().sort(sort)
  const data={
    name:'House Care V2 Phase 9 Node render proxy',platform:process.platform,node:process.version,
    caveat:'Pure Node CPU/SVG-size proxy only; does not measure mobile paint, GPU, device memory or FPS.',
    counts:{recipes:inputs.length,renderedSvg:measured,visibleFullArtInOverview:1},
    elapsedMs:{recipeBatch:Number(recipeMs.toFixed(2)),svgBatch:Number(svgMs.toFixed(2)),perSvg:Number((svgMs/measured).toFixed(3))},
    svgBytes:{median:sortedBytes[Math.floor(sortedBytes.length*.5)],p95:sortedBytes[Math.floor(sortedBytes.length*.95)],max:sortedBytes.at(-1)},
    pathCount:{median:sortedPaths[Math.floor(sortedPaths.length*.5)],max:sortedPaths.at(-1)},
    nestedSvgMax:Math.max(...nestedSvgCounts),
  }
  writeFileSync(join(root,'docs/V2_PHASE9_RENDER_PROXY.json'),JSON.stringify(data,null,2)+'\n')
  console.log(JSON.stringify(data,null,2))
} finally {rmSync(temp,{recursive:true,force:true})}
