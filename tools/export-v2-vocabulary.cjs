/**
 * Materialize the Phase 4 TypeScript vector vocabulary as themeable SVG sources.
 * These are deterministic designer handoff files; src/visual remains canonical.
 */
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'hc-v2-svg-export-'))
try {
  const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',join(root,'src'),'--outDir',tmp,join(root,'src/visual/compose.ts'),join(root,'src/visual/expressions.ts'),join(root,'src/visual/decorations.ts'),join(root,'src/visual/patterns.ts')], { cwd:root, stdio:'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
  const { listPrimitiveDefinitions } = require(join(tmp,'visual/registry.js'))
  const { renderPrimitiveSvg } = require(join(tmp,'visual/render.js'))
  const { renderManualCharacterSvg } = require(join(tmp,'visual/compose.js'))
  const { EXPRESSION_IDS, renderExpressionPreviewSvg } = require(join(tmp,'visual/expressions.js'))
  const { POSE_IDS } = require(join(tmp,'visual/poses.js'))
  const { DECORATION_IDS, renderDecorationSvg } = require(join(tmp,'visual/decorations.js'))
  const { VECTOR_PATTERN_KEYS, renderVectorDefs } = require(join(tmp,'visual/patterns.js'))
  const { createSvgIdScope } = require(join(tmp,'visual/id.js'))
  const palette = Object.freeze(Object.fromEntries([
    'paper','surface','ink','inkMuted','primary','primarySoft','mustard','coral','danger','turquoise'
  ].map(key=>[key,`var(--hc-art-${key.replace(/[A-Z]/g,v=>'-'+v.toLowerCase())})`])) )
  const folder=join(root,'design/v2/primitives')
  const save=(sub,name,svg)=>{
    const dest=join(folder,sub);mkdirSync(dest,{recursive:true});writeFileSync(join(dest,`${name}.svg`),svg)
  }
  const objects=listPrimitiveDefinitions().filter(d=>!d.metadata.demoOnly)
  for (const item of objects) {
    save('objects',item.metadata.id,renderPrimitiveSvg(item.metadata.id,{instanceKey:`export-${item.metadata.id}`, palette}))
  }
  for (const id of EXPRESSION_IDS) save('expressions',id,renderExpressionPreviewSvg(id,palette))
  for (const id of POSE_IDS) save('poses',id,renderManualCharacterSvg('generic-appliance',{instanceKey:`export-pose-${id}`,palette,expression:'neutral',pose:id}))
  for (const id of DECORATION_IDS) save('decorations',id,renderDecorationSvg(id,palette))
  for (const key of VECTOR_PATTERN_KEYS) {
    const ids=createSvgIdScope(`export-pattern-${key}`)
    save('patterns',key,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${renderVectorDefs(ids,palette,[key])}<rect width="128" height="128" fill="${ids.url(key)}"/></svg>`)
  }
  const manifest={
    documentation:'Generated from src/visual. Do not hand-edit exported SVG files.',
    artboard:'240x240 for objects/poses, 80x80 expressions, 128x128 decorations/patterns',
    objects:objects.map(({metadata})=>metadata),
    expressions:EXPRESSION_IDS,
    poses:POSE_IDS,
    decorations:DECORATION_IDS,
    patterns:VECTOR_PATTERN_KEYS,
  }
  writeFileSync(join(folder,'vocabulary-manifest.json'), JSON.stringify(manifest,null,2)+'\n')
  console.log(`Exported ${objects.length} object SVGs, ${EXPRESSION_IDS.length} face previews, ${POSE_IDS.length} pose previews, ${DECORATION_IDS.length} decorations and ${VECTOR_PATTERN_KEYS.length} pattern samples.`)
} finally { rmSync(tmp,{recursive:true,force:true}) }
