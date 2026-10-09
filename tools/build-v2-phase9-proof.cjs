/**
 * Build the Phase 9 visual QA sheet from runtime-authored SVG sources.
 * Only source vectors and fixed editorial choices; no bitmap artwork or AI.
 * Does not ship in the PWA bundle.
 */
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const build = mkdtempSync(join(tmpdir(), 'hc-phase9-proof-'))
const escape = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
try {
  const compilation = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict',
    '--skipLibCheck','--rootDir',join(root,'src'),'--outDir',build,
    join(root,'src/visual/compose.ts'),join(root,'src/lib/theme.ts'),
    join(root,'src/visual/procedural/render-card.ts'),join(root,'src/visual/procedural/recipe.ts')],
    { cwd:root, stdio:'inherit' })
  if (compilation.status !== 0) process.exit(compilation.status || 1)
  const { listPrimitiveDefinitions } = require(join(build,'visual/registry.js'))
  const { renderManualCharacterSvg } = require(join(build,'visual/compose.js'))
  const { vectorPaletteFromTheme } = require(join(build,'visual/palette.js'))
  const { themePreset } = require(join(build,'lib/theme.js'))
  const { generateCardVisualRecipe } = require(join(build,'visual/procedural/recipe.js'))
  const { renderCardVisualSvg } = require(join(build,'visual/procedural/render-card.js'))
  const p = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const ids = listPrimitiveDefinitions().filter((item) => !item.metadata.demoOnly).map((item) => item.metadata.id)
  const cols = 8, stepX = 187, stepY = 215, marginX = 16, marginY = 88
  const rows = Math.ceil(ids.length/cols), width = cols*stepX+2*marginX, height = marginY+rows*stepY+28
  const contact = ids.map((id,i)=>{
    const x=marginX+(i%cols)*stepX, y=marginY+Math.floor(i/cols)*stepY
    const meta=listPrimitiveDefinitions().find(item=>item.metadata.id===id).metadata
    const character=renderManualCharacterSvg(id, {
      instanceKey:`phase9-contact-${i}`, palette:p,
      decorative:true,
      expression:meta.faceAnchor?'smile':undefined,
      pose:meta.limbAnchors?'arms-down':undefined,
      misregistration:false,
    }).replace('<svg ', `<svg x="${x+19}" y="${y+6}" width="148" height="148" `)
    return `<rect x="${x}" y="${y}" width="177" height="194" rx="13" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".17"/>${character}<text x="${x+88}" y="${y+174}" font-family="sans-serif" font-size="15" text-anchor="middle" fill="${p.ink}">${escape(id)}</text>`
  }).join('')
  const contactSheet=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${p.paper}"/><text x="24" y="39" font-family="Georgia,serif" font-weight="bold" font-size="34" fill="${p.ink}">House Care V2 — Authored SVG vocabulary</text><text x="25" y="63" font-family="sans-serif" font-size="16" fill="${p.inkMuted}">48 deterministic SVG objects · faces/poses chosen manually · no raster assets</text>${contact}</svg>`
  writeFileSync(join(root,'design/v2/page-reference/v2-phase9-vocabulary.svg'),contactSheet)
  const miniW=960, miniH=760
  const miniature=ids.map((id,i)=>{
    const x=16+(i%8)*118, y=72+Math.floor(i/8)*109
    const raw=renderManualCharacterSvg(id,{
      instanceKey:`phase9-48-${i}`, palette:p,decorative:true,misregistration:false,
    }).replace('<svg ', `<svg x="${x+34}" y="${y+10}" width="48" height="48" `)
    return `<rect x="${x}" y="${y}" width="110" height="94" rx="10" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".14"/>${raw}<text x="${x+55}" y="${y+80}" font-family="sans-serif" font-size="10" text-anchor="middle" fill="${p.ink}">${escape(id)}</text>`
  }).join('')
  writeFileSync(join(root,'design/v2/page-reference/v2-phase9-vocabulary-48px.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${miniW} ${miniH}"><rect width="100%" height="100%" fill="${p.paper}"/><text x="16" y="29" font-family="Georgia,serif" font-size="25" fill="${p.ink}">House Care — 48 px untextured silhouettes</text><text x="16" y="48" font-family="sans-serif" font-size="13" fill="${p.inkMuted}">Actual primitive drawing size: 48 × 48 px</text>${miniature}</svg>`)
  const cases=[
    {id:'oven',type:'oven',name:'Oven',action:'Degrease',ordinal:5,env:'Kitchen'},
    {id:'oven',type:'oven',name:'Oven',action:'Degrease',ordinal:6,env:'Kitchen'},
    {id:'refrigerator',type:'Refrigerator',name:'Fridge',action:'Wipe',ordinal:3,env:'Kitchen'},
    {id:'bathtub',type:'Vasca da bagno',name:'Vasca',action:'Lavare',ordinal:4,env:'Bagno'},
    {id:'bookcase',type:'Bookcase',name:'Bookshelf',action:'Dust',ordinal:2,env:'Living Room'},
    {id:'generic-surface',type:'Invented device',name:'Zxylophone doohickey',action:'Flibber',ordinal:9,env:'Unknown'},
  ]
  const w=1290, h=1110
  const sheet=cases.map((c,i)=>{
    const x=20+(i%2)*643, y=65+Math.floor(i/2)*346
    const recipe=generateCardVisualRecipe({
      routineId: c.id==='oven'?'same-oven-routine':`p9-${c.id}`,actionId:c.action,
      primaryTargetId:c.id,occurrenceId:`phase9-occ-${i}`,triggerOrdinal:c.ordinal,
      subjectName:c.name,subjectTypeName:c.type,actionName:c.action,
      environmentName:c.env,
    })
    const card=renderCardVisualSvg(recipe,{instanceKey:`p9-card-${i}`,palette:p,decorative:true})
      .replace('<svg ',`<svg x="${x}" y="${y+32}" width="610" height="298" `)
    return `<text x="${x+8}" y="${y+18}" fill="${p.ink}" font-family="sans-serif" font-size="20" font-weight="bold">${escape(`${c.name} · ${c.action} · edition ${c.ordinal}`)}</text>${card}`
  }).join('')
  const proceduralSheet=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${p.paper}"/><text x="23" y="35" fill="${p.ink}" font-family="Georgia,serif" font-size="29" font-weight="bold">V2 — Procedural illustration QA</text>${sheet}</svg>`
  writeFileSync(join(root,'design/v2/page-reference/v2-phase9-card-proof.svg'),proceduralSheet)
  console.log(`Phase 9 QA SVG sheets built: ${ids.length} objects, ${cases.length} sample cards`)
} finally { rmSync(build,{recursive:true,force:true}) }
