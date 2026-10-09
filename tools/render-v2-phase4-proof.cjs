/** Vector-only contact sheet for visual QA; not a shipped bitmap asset. */
const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root=join(__dirname,'..'); const out=mkdtempSync(join(tmpdir(),'hc4proof-'))
try {
  const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',join(root,'src'),'--outDir',out,join(root,'src/visual/compose.ts'),join(root,'src/lib/theme.ts')],{cwd:root,stdio:'inherit'})
  if (result.status!==0)process.exit(result.status||1)
  const { AUTHORED_OBJECT_IDS }=require(join(out,'visual/primitives/authored.js'))
  const { renderManualCharacterSvg }=require(join(out,'visual/compose.js'))
  const { themePreset }=require(join(out,'lib/theme.js'))
  const { vectorPaletteFromTheme }=require(join(out,'visual/palette.js'))
  const palette=vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const moods=['smile','worried','angry','smile','joyful','focused','proud','smile','neutral','joyful','smile','relieved','joyful','proud','smile','relieved','neutral','neutral','worried','smile']
  const poses=['thumbs-up','arms-down','shrug','arms-down','fist-pump','arms-down','wave','arms-down','arms-down','celebrate']
  const cells=AUTHORED_OBJECT_IDS.map((id,index)=>{
    const col=index%5,row=Math.floor(index/5),x=20+col*244,y=24+row*254
    const art=renderManualCharacterSvg(id,{instanceKey:`proof-${id}`,palette,expression:moods[index],pose: index===8||index===15||index===16||index===17 ? undefined : poses[index%poses.length]})
    return `<g transform="translate(${x} ${y})"><rect width="226" height="238" rx="18" fill="${palette.surface}" stroke="${palette.ink}" stroke-width="1.8"/><svg x="15" y="4" width="195" height="195" viewBox="0 0 240 240">${art}</svg><text x="113" y="224" fill="${palette.ink}" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">${id}</text></g>`
  }).join('\n')
  const sheet=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1054"><rect width="1240" height="1054" fill="${palette.paper}"/>${cells}</svg>`
  const directory=join(root,'design/v2/page-reference')
  mkdirSync(directory,{recursive:true})
  const proof=join(directory,'v2-vocabulary-proof.svg')
  writeFileSync(proof,sheet)
  console.log(`Wrote ${proof} (${AUTHORED_OBJECT_IDS.length} object proofs)`)
} finally {rmSync(out,{recursive:true,force:true})}
