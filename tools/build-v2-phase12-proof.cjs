/** Phase 12 dev-only illustration proof — rendered from the exact runtime primitive registry. */
const { mkdtempSync, rmSync, writeFileSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'hc-phase12-proof-'))
const escape = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
try {
  const compilation = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck', '--rootDir',join(root,'src'), '--outDir',tmp, join(root,'src/components/actions/actionPresentation.ts'),join(root,'src/components/supplies/supplyPresentation.ts'),join(root,'src/visual/compose.ts'),join(root,'src/lib/theme.ts')], {cwd:root,stdio:'inherit'})
  if(compilation.status!==0) process.exit(compilation.status||1)
  const { actionLibraryVisual } = require(join(tmp,'components/actions/actionPresentation.js'))
  const { supplyLibraryVisual } = require(join(tmp,'components/supplies/supplyPresentation.js'))
  const { renderManualCharacterSvg } = require(join(tmp,'visual/compose.js'))
  const { vectorPaletteFromTheme } = require(join(tmp,'visual/palette.js'))
  const { themePreset } = require(join(tmp,'lib/theme.js'))
  const p = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const fixture = JSON.parse(readFileSync(join(root,'tests/fixtures/pre-v2-household-backup.json'),'utf8')).data
  const actions = [...fixture.actions, ...[
    ['a-dust','Dust'], ['a-mop','Mop'], ['a-unknown','Care for a Zylophonic Thing'],
  ].map(([id,name])=>({id,name}))].slice(0,6)
  const supplies = [...fixture.supplies, ...[
    ['s-sponge','Sponges','available'], ['s-microfiber','Panni in microfibra','reserve_only'], ['s-tablets','Dishwasher tablets','out_of_stock'],
  ].map(([id,name,status])=>({id,name,status}))].slice(0,6)
  function tiles(records,resolve,type,startY) {
    return records.map((record,i)=>{
      const x=28+(i%3)*378, y=startY+Math.floor(i/3)*262
      const v=resolve(record)
      const art=renderManualCharacterSvg(v.subjectId,{instanceKey:`p12-${type}-${i}`,palette:p, decorative:true, expression:v.expression, pose:v.pose,misregistration:false})
        .replace('<svg ', `<svg x="${x+16}" y="${y+44}" width="162" height="164" `)
      const tag=type==='actions' ? v.family : String(record.status).replaceAll('_',' ')
      const words=String(record.name).split(/\s+/); const lines=['']; for(const word of words){ if((lines.at(-1)+' '+word).trim().length>13 && lines.at(-1))lines.push(''); lines[lines.length-1]=(lines.at(-1)+' '+word).trim() }
      const titleMarkup=lines.slice(0,3).map((part,j)=>`<text x="${x+198}" y="${y+65+j*26}" fill="${p.ink}" font-size="21" font-family="Georgia,serif" font-weight="bold">${escape(part)}</text>`).join('')
      return `<rect x="${x}" y="${y}" width="356" height="242" rx="15" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".3" stroke-width="2"/><rect x="${x+9}" y="${y+11}" width="181" height="218" rx="11" fill="${p.primarySoft}" opacity=".74"/>${art}<path d="M${x+17} ${y+29}h17" stroke="${p.mustard}" stroke-width="4"/>${titleMarkup}<text x="${x+198}" y="${y+150}" fill="${p.inkMuted}" font-size="15" font-family="sans-serif">${escape(tag)}</text><path d="M${x+198} ${y+160}h138" stroke="${p.coral}" stroke-width="2" opacity=".4"/><text x="${x+198}" y="${y+186}" fill="${p.ink}" font-size="14" font-family="sans-serif">${type==='actions'?'AUTHORED TOOL':'STOCK STATUS'}</text><text x="${x+198}" y="${y+209}" fill="${p.inkMuted}" font-size="13" font-family="sans-serif">${escape(v.subjectId)}</text>`
    }).join('')
  }
  const width=1180, height=1280
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${p.paper}"/><text x="27" y="48" fill="${p.ink}" font-family="Georgia,serif" font-weight="bold" font-size="38">House Care V2 · Actions &amp; Supplies</text><text x="28" y="75" fill="${p.inkMuted}" font-family="sans-serif" font-size="16">Phase 12 authored vector artwork · 70% clarity / 30% print treatment · not a live app screenshot</text><text x="28" y="117" fill="${p.ink}" font-family="Georgia,serif" font-size="29">Reusable Actions</text>${tiles(actions,actionLibraryVisual,'actions',145)}<text x="28" y="689" fill="${p.ink}" font-family="Georgia,serif" font-size="29">Household Supplies</text>${tiles(supplies,supplyLibraryVisual,'supplies',718)}<text x="28" y="1255" fill="${p.inkMuted}" font-family="sans-serif" font-size="13">All icons are from the authored SVG registry. No raster card art or runtime AI. Item labels and semantics remain HTML in the application.</text></svg>`
  const filename=join(root,'design/v2/page-reference/v2-phase12-actions-supplies.svg')
  writeFileSync(filename,svg)
  console.log(`Phase 12 action/supply SVG proof saved: ${filename}`)
} finally { rmSync(tmp,{recursive:true,force:true}) }
