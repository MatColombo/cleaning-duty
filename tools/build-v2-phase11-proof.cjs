/** Development-only visual check for the Phase 11 *routine identity* projection.
 * No screenshot mocks/AI/raster art. This proof is NOT a connected page. */
const { mkdtempSync, rmSync, writeFileSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const out = mkdtempSync(join(tmpdir(), 'hc-p11-proof-'))
const escape = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
try {
  const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--strict', '--skipLibCheck', '--rootDir', join(root, 'src'), '--outDir', out,
    join(root, 'src/visual/procedural/routine-identity.ts'), join(root, 'src/visual/compose.ts'), join(root, 'src/visual/procedural/render-card.ts'), join(root, 'src/lib/theme.ts')], {cwd: root, stdio: 'inherit'})
  if (compile.status !== 0) process.exit(compile.status || 1)
  const { getRoutineIdentityRecipe } = require(join(out, 'visual/procedural/routine-identity.js'))
  const { cardPaletteForVariant } = require(join(out, 'visual/procedural/render-card.js'))
  const { renderManualCharacterSvg } = require(join(out, 'visual/compose.js'))
  const { vectorPaletteFromTheme } = require(join(out, 'visual/palette.js'))
  const { themePreset } = require(join(out, 'lib/theme.js'))
  const data = JSON.parse(readFileSync(join(root, 'tests/fixtures/pre-v2-household-backup.json'), 'utf8')).data
  const palette = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const routines = data.routines.filter((item) => !item.parentRoutineId).concat({
    ...data.routines[0], id:'unknown-user-routine', actionId:'unknown-action', targetEntityIds:['unknown-object'],
    name:'Pulire oggetto sconosciuto', careLevel:'routine', status:'paused',
  })
  const width = 950, height = 1135, top = 196, rowHeight = 220
  const cards = routines.map((routine,i) => {
    const x=32, y=top+i*rowHeight
    const recipe=getRoutineIdentityRecipe(routine,data)
    const p=cardPaletteForVariant(palette,recipe)
    const target=data.entities.find(item=>item.id===routine.targetEntityIds[0])
    const action=data.actions.find(item=>item.id===routine.actionId)
    const art=renderManualCharacterSvg(recipe.semantics.subjectId,{
      instanceKey:`p11-proof-${i}`,palette:p,expression:recipe.expression,pose:recipe.pose,
      decorative:true,misregistration:false,
    }).replace('<svg ', `<svg x="${x+20}" y="${y+14}" width="150" height="150" `)
    const head=escape(routine.name)
    const care=routine.careLevel==='deep'?'DEEP CLEAN':'REGULAR'
    const status=routine.status==='paused'?'PAUSED':'ACTIVE'
    const statusInk=routine.status==='paused'?p.mustard:p.primary
    const extra = routine.id===data.routines[0].id
      ? `<rect x="${x+202}" y="${y+141}" width="680" height="31" rx="7" fill="${p.mustard}" opacity=".2"/><text x="${x+214}" y="${y+162}" font-size="15" font-family="sans-serif" font-weight="bold" fill="${p.ink}">EXTRA CARE CONFIGURED · every 3 canonical triggers</text>`:''
    return `<rect x="${x}" y="${y}" width="886" height="201" rx="16" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".25" stroke-width="2"/>
      <rect x="${x+10}" y="${y+10}" width="175" height="181" rx="12" fill="${p.primary}" opacity=".1"/>
      ${art}
      <text x="${x+202}" y="${y+28}" font-size="13" letter-spacing="1.2" font-family="sans-serif" fill="${p.inkMuted}">${escape(action?.name||'GENERIC CARE')}</text>
      <text x="${x+202}" y="${y+64}" font-size="29" font-family="Georgia,serif" font-weight="bold" fill="${p.ink}">${head}</text>
      <rect x="${x+735}" y="${y+13}" width="133" height="30" rx="15" fill="${statusInk}" opacity=".2"/>
      <text x="${x+801}" y="${y+34}" font-size="15" font-family="sans-serif" text-anchor="middle" fill="${p.ink}" font-weight="bold">${status}</text>
      <text x="${x+202}" y="${y+93}" font-size="17" font-family="sans-serif" fill="${p.inkMuted}">${escape(target?.name||'Custom target')}  ·  ${care}</text>
      <text x="${x+202}" y="${y+121}" font-size="14" font-family="monospace" fill="${p.inkMuted}">routine ID: ${escape(routine.id.slice(0,24))}  /  art seed: ${escape(recipe.stableSeed)}</text>
      ${extra}`
  }).join('')
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${palette.paper}"/>
    <text x="37" y="60" font-family="Georgia,serif" font-weight="bold" font-size="49" fill="${palette.ink}">House Care · Routines</text>
    <text x="37" y="95" font-family="sans-serif" font-size="19" fill="${palette.inkMuted}">Phase 11 · authored SVG identities · no task editions · EN/IT fallback</text>
    <rect x="34" y="120" width="268" height="56" rx="13" fill="${palette.primary}" opacity=".17"/><text x="53" y="159" font-family="Georgia,serif" font-size="27" fill="${palette.ink}">Regular active</text>
    <rect x="320" y="120" width="268" height="56" rx="13" fill="${palette.coral}" opacity=".17"/><text x="339" y="159" font-family="Georgia,serif" font-size="27" fill="${palette.ink}">Deep active</text>
    <rect x="606" y="120" width="312" height="56" rx="13" fill="${palette.mustard}" opacity=".17"/><text x="624" y="159" font-family="Georgia,serif" font-size="27" fill="${palette.ink}">Paused / Ended</text>
    ${cards}
    <text x="35" y="1104" font-family="sans-serif" font-size="15" fill="${palette.inkMuted}">Vector reference only. All operational labels remain HTML in the actual UI.</text>
  </svg>`
  const target=join(root,'design/v2/page-reference/v2-phase11-routine-identities.svg')
  writeFileSync(target,svg)
  console.log(`Phase 11 stable routine identity proof: ${routines.length} library cards, ${new Set(routines.map(r=>getRoutineIdentityRecipe(r,data).stableSeed)).size} stable seeds`)
} finally { rmSync(out,{recursive:true,force:true}) }
