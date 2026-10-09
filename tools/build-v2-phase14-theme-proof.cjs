/** Optional static QA proof using the production authored SVGs and palette adapter. */
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'hc-phase14-proof-'))
const escape = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
try {
  const build = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',join(root,'src'),'--outDir',tmp, join(root,'src/visual/compose.ts'),join(root,'src/visual/palette.ts'),join(root,'src/lib/theme.ts')], {cwd:root,stdio:'inherit'})
  if(build.status!==0) process.exit(build.status||1)
  const { renderManualCharacterSvg } = require(join(tmp,'visual/compose.js'))
  const { vectorPaletteFromTheme } = require(join(tmp,'visual/palette.js'))
  const { deriveVisualInkRoles } = require(join(tmp,'visual/VisualPaletteAdapter.js'))
  const { themePreset } = require(join(tmp,'lib/theme.js'))
  const custom = { ...themePreset('house-care-retro').palette,canvas:'#FFFFFF',surface:'#FFFFFF',ink:'#FFFFFF',primary:'#FFFFFF',due:'#FFFFFF',overdue:'#FFFFFF',danger:'#FFFFFF' }
  const scenarios = [
    ['House Care Retro',themePreset('house-care-retro').palette],
    ['Fresh Sage',themePreset('fresh-sage').palette],
    ['Night Garden',themePreset('night-garden').palette],
    ['Graphite Mono',themePreset('graphite-mono').palette],
    ['Clear Spectrum',themePreset('clear-spectrum').palette],
    ['Extreme Custom',custom],
  ]
  const swatches = ['paper','outline','primary','warning','overdue','soft']
  const tiles = scenarios.map(([name,theme],i)=>{
    const x=30+(i%2)*573, y=95+Math.floor(i/2)*320
    const art = deriveVisualInkRoles(theme)
    const p = vectorPaletteFromTheme(theme)
    const house=renderManualCharacterSvg('house',{instanceKey:`p14-house-${i}`,decorative:true,expression:'proud',pose:'thumbs-up',palette:p,misregistration:false}).replace('<svg ',`<svg x="${x+24}" y="${y+54}" width="160" height="160" `)
    const spray=renderManualCharacterSvg('spray-bottle',{instanceKey:`p14-spray-${i}`,decorative:true,expression:'smile',pose:'wave',palette:p,misregistration:false}).replace('<svg ',`<svg x="${x+170}" y="${y+78}" width="130" height="130" `)
    const inks=swatches.map((key,j)=>{
      const sx=x+20+(j%3)*166, sy=y+236+Math.floor(j/3)*27
      return `<rect x="${sx}" y="${sy-13}" width="19" height="19" rx="4" fill="${art[key]}" stroke="${art.outline}" stroke-width=".7"/><text x="${sx+26}" y="${sy+2}" fill="${art.outline}" font-family="sans-serif" font-size="12">${key}</text>`
    }).join('')
    return `<rect x="${x}" y="${y}" width="550" height="300" rx="16" fill="${theme.surface}" stroke="${art.outline}" stroke-opacity=".18" stroke-width="2"/><rect x="${x+16}" y="${y+44}" width="285" height="183" rx="12" fill="${art.paper}"/>${house}${spray}<text x="${x+18}" y="${y+30}" fill="${art.outline}" font-family="sans-serif" font-size="22" font-weight="bold">${escape(name)}</text><text x="${x+323}" y="${y+103}" fill="${art.outline}" font-family="sans-serif" font-size="14">${art.adjustedRoles.length?'Art contrast corrected':'Original art inks'}</text>${inks}`
  }).join('')
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1180 1090"><rect width="1180" height="1090" fill="#F4E8D0"/><text x="30" y="46" font-family="Georgia,serif" font-size="37" font-weight="bold" fill="#153D3A">House Care V2 — theme-derived vector inks</text><text x="30" y="72" font-family="sans-serif" font-size="16" fill="#153D3A">Art-only contrast fallback; six curated roles, unchanged saved palettes; production authored vectors</text>${tiles}</svg>`
  const path=join(root,'design/v2/page-reference/v2-phase14-theme-proof.svg')
  writeFileSync(path,svg)
  console.log('Saved Phase 14 art palette proof:',path)
} finally { rmSync(tmp,{recursive:true,force:true}) }
