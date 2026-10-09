/** Development-only recipe contact sheet and themeable HTML. No V2 page routing. */
const { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root=join(__dirname,'..')
const tmp=mkdtempSync(join(tmpdir(),'hc-v2-phase5-proof-'))
const escape=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
try {
  const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),
    '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck',
    '--rootDir',join(root,'src'),'--outDir',tmp,
    join(root,'src/visual/procedural/index.ts'),join(root,'src/lib/theme.ts')],{cwd:root,stdio:'inherit'})
  if(result.status!==0)process.exit(result.status||1)
  const visual=require(join(tmp,'visual/procedural/index.js'))
  const {themePresets,themePreset}=require(join(tmp,'lib/theme.js'))
  const {CSS_VECTOR_PALETTE,vectorPaletteFromTheme}=require(join(tmp,'visual/palette.js'))
  const golden=JSON.parse(readFileSync(join(root,'tests/fixtures/v2-visual-v1-golden.json'),'utf8'))
  const samples=[
    ['Oven / edition 5',golden.cases[0].input],
    ['Oven / edition 6',golden.cases[1].input],
    ['Kitchen sink / Italian',golden.cases[2].input],
    ['Linked coffee / Italian',golden.cases[3].input],
    ['Unknown / generic fallback',golden.cases[4].input],
    ['Bathroom / shower',{
      routineId:'routine-shower',actionId:'action-descaling',primaryTargetId:'entity-shower',
      occurrenceId:'task-shower-5',triggerOrdinal:5,subjectName:'Shower',subjectTypeName:'Surface',
      actionName:'Descale',environmentName:'Bathroom',
    }],
  ]
  const preview=(label,input,index,palette)=>{
    const recipe=visual.generateCardVisualRecipe(input)
    const art=visual.renderCardVisualSvg(recipe,{instanceKey:`phase5-proof-${index}`,palette})
    return {label,recipe,art}
  }
  const retro=vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const pages=samples.map(([label,input],i)=>preview(label,input,i,CSS_VECTOR_PALETTE))
  const cards=pages.map(({label,recipe,art})=>`<article class="card"><div class="art">${art}</div><h2>${escape(label)}</h2><p>Subject: <b>${escape(recipe.semantics.subjectId)}</b> (${escape(recipe.semantics.level)}) · Action: ${escape(recipe.semantics.actionFamily)} · Environment: ${escape(recipe.semantics.environment)}</p><p>Template: ${escape(recipe.template)} · Palette: ${escape(recipe.paletteVariant)} · Edition: ${escape(recipe.occurrenceSeed)} · Stamp: ${escape(recipe.edition.stamp)}</p></article>`).join('')
  const paletteOptions=themePresets.map((preset)=>`<option value="${escape(preset.id)}">${escape(preset.name)}</option>`).join('')
  const themes={}
  for(const preset of themePresets)themes[preset.id]=vectorPaletteFromTheme(preset.palette)
  const paletteVars=(p)=>Object.entries(p).map(([key,value])=>`--hc-art-${key.replace(/[A-Z]/g,v=>'-'+v.toLowerCase())}:${value}`).join(';')
  const gallery=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>House Care V2 — Procedural Cards · Phase 5</title><style>:root{${paletteVars(retro)}}*{box-sizing:border-box}body{margin:0;background:var(--hc-art-paper);color:var(--hc-art-ink);font:15px/1.5 system-ui,-apple-system,sans-serif}header{padding:22px clamp(16px,5vw,50px);background:var(--hc-art-surface);border-bottom:3px solid var(--hc-art-ink)}h1,h2{font-family:Georgia,serif;line-height:1.06}h1{font-size:clamp(2rem,5vw,3.5rem);margin:8px 0}p{margin:6px 0}header p{max-width:75ch}main{max-width:1350px;margin:0 auto;padding:20px}.tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0}.tools select{border:2px solid var(--hc-art-ink);border-radius:10px;color:var(--hc-art-ink);background:var(--hc-art-surface);font:inherit;padding:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,450px),1fr));gap:22px}.card{background:var(--hc-art-surface);padding:12px;border:2px solid var(--hc-art-ink);border-radius:18px;min-width:0}.art svg{width:100%;height:auto;display:block}.card h2{margin:10px 6px 4px;font-size:1.4rem}.card p{padding:0 6px;font-size:.88rem;overflow-wrap:anywhere}code{overflow-wrap:anywhere}small{display:block;margin:10px;color:var(--hc-art-ink-muted)}@media(max-width:600px){main{padding:12px}.grid{gap:12px}.card{padding:5px}}</style></head><body><header><h1>House Care · Generator V1</h1><p>Development-only procedural SVG preview. The same routine shares composition and palette, while each occurrence receives a deterministic edition. Art comes solely from the Phase 4 SVG vocabulary. No external images, database changes, or runtime AI.</p><div class="tools"><label>Active theme <select id="theme">${paletteOptions}</select></label><small>Palette changes recolor the same recipes; the underlying seeds do not change.</small></div></header><main><div class="grid">${cards}</div><p><small>Standalone reference only — not connected to the production Overview, task mutation services, or Timeline.</small></p></main><script>const palettes=${JSON.stringify(themes)};const sel=document.getElementById('theme');sel.value='house-care-retro';sel.onchange=()=>{const p=palettes[sel.value];for(const [k,v] of Object.entries(p)){const css='--hc-art-'+k.replace(/[A-Z]/g,s=>'-'+s.toLowerCase());document.documentElement.style.setProperty(css,v)}};</script></body></html>`
  const proof=samples.map(([label,input],i)=>preview(label,input,i,retro))
  const text=(value)=>escape(value)
  const elements=proof.map(({label,recipe,art},i)=>{
    const x=20+(i%2)*630,y=22+Math.floor(i/2)*458
    const nested=art.replace('<svg ',`<svg x="${x}" y="${y+34}" width="590" height="387" `)
    return `<text x="${x+8}" y="${y+22}" font-family="sans-serif" font-size="21" font-weight="700" fill="${retro.ink}">${text(label)}</text>${nested}<text x="${x+8}" y="${y+441}" font-family="sans-serif" font-size="14" fill="${retro.ink}">${text(recipe.semantics.level)} · ${text(recipe.semantics.subjectId)} · ${text(recipe.template)}</text>`
  }).join('')
  const fullSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 1374" width="1260" height="1374"><rect width="1260" height="1374" fill="${retro.paper}"/>${elements}</svg>`
  const out=join(root,'design/v2/page-reference')
  mkdirSync(out,{recursive:true})
  writeFileSync(join(out,'v2-procedural-cards.html'),gallery)
  writeFileSync(join(out,'v2-procedural-cards-proof.svg'),fullSvg)
  console.log(`Phase 5 procedural proof built: ${samples.length} authored-geometry recipes, 2 themeable assets`)
}finally{rmSync(tmp,{recursive:true,force:true})}
