/** Offline visual proof: actual deterministic generator output, not an app screenshot. */
const { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const tmp = mkdtempSync(join(tmpdir(), 'house-care-phase18a-proof-'))
const esc = (value) => String(value).replace(/[&<>"]/g,(x)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]))
try {
  const tsc = (() => { try { return require.resolve('typescript/bin/tsc') } catch { return '' } })()
  const command = tsc ? [process.execPath, [tsc]] : ['tsc', []]
  const result=spawnSync(command[0], [...command[1], '--target','ES2022','--module','commonjs','--moduleResolution','node','--strict','--skipLibCheck','--rootDir',join(root,'src'),'--outDir',tmp,
    join(root,'src/visual/studio/preview.ts'),join(root,'src/lib/theme.ts')],{cwd:root,stdio:'inherit'})
  if (result.status !== 0) process.exit(result.status || 1)
  const { generateCardVisualRecipe } = require(join(tmp,'visual/procedural/recipe.js'))
  const { renderStudioPreviewSvg } = require(join(tmp,'visual/studio/preview.js'))
  const { themePreset } = require(join(tmp,'lib/theme.js'))
  const { vectorPaletteFromTheme } = require(join(tmp,'visual/palette.js'))
  const { STUDIO_OBJECT_IDS, STUDIO_GESTURES, STUDIO_PROPS, STUDIO_PROPORTIONS, STUDIO_ANIMATIONS } = require(join(tmp,'visual/studio/draft.js'))
  const { EXPRESSION_IDS } = require(join(tmp,'visual/expressions.js'))
  const { POSE_IDS } = require(join(tmp,'visual/poses.js'))
  const { CARD_PALETTE_VARIANTS, ENVIRONMENT_FAMILIES } = require(join(tmp,'visual/procedural/taxonomy.js'))
  const input = {routineId:'studio-kitchen-care',actionId:'action-degrease',primaryTargetId:'entity-oven',occurrenceId:'studio-proof-oven',triggerOrdinal:4,
    subjectName:'Oven',subjectTypeName:'Appliance',actionName:'Degrease',environmentName:'Kitchen'}
  const fallbackInput = {routineId:'studio-unrecognized', actionId:'unknown', primaryTargetId:'custom',occurrenceId:'studio-proof-other',
    subjectName:'Futura Zed / 鍋',subjectTypeName:'Mystery',actionName:'Unrecognized',environmentName:'Unknown'}
  const samples = [
    {label:'Auto · original identity',input,theme:'house-care-retro',override:{}},
    {label:'Expression · confident advertiser',input,theme:'house-care-retro',override:{expression:'proud',eyes:'surprised',brows:'focused',mouth:'smile'}},
    {label:'Glove, posture & hero scale',input,theme:'house-care-retro',override:{pose:'thumbs-up',handGesture:'thumb',scale:1.2,proportion:'tall'}},
    {label:'Scene / prop / palette',input,theme:'house-care-retro',override:{scene:'bathroom',prop:'steam',paletteVariant:'coral'}},
    {label:'Unrecognized name · safe fallback',input:fallbackInput,theme:'house-care-retro',override:{}},
    {label:'Night theme · curated object',input:fallbackInput,theme:'night-garden',override:{subjectId:'spray-bottle',expression:'joyful',pose:'wave',paletteVariant:'mustard'}},
  ]
  const svgTiles = samples.map((sample,index)=> {
    const palette=vectorPaletteFromTheme(themePreset(sample.theme).palette)
    const recipe=generateCardVisualRecipe(sample.input)
    return { ...sample, index, recipe, svg:renderStudioPreviewSvg(recipe,sample.override,`phase18a-proof-${index}`,palette), palette }
  })
  const w=1260,h=1360
  const contact = svgTiles.map(({label,svg,index,palette})=>{
    const x=20+(index%2)*625,y=80+Math.floor(index/2)*420
    return `<rect x="${x}" y="${y}" width="605" height="402" rx="18" fill="${palette.surface}" stroke="#153d3a" stroke-width="2"/>
      <text x="${x+20}" y="${y+34}" font-size="22" font-family="sans-serif" fill="${palette.ink}">${esc(label)}</text>
      ${svg.replace('<svg ', `<svg x="${x+10}" y="${y+45}" width="580" height="342" `)}`
  }).join('')
  const contactSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#f4e8d0"/><text x="20" y="42" font-family="sans-serif" font-size="30" font-weight="800" fill="#153d3a">HOUSE CARE · Character Studio 18A · deterministic previews</text>${contact}</svg>`
  const cards = svgTiles.map(({label,svg,index,theme,recipe})=>`<article class="proof-card"><div class="proof-preview ${theme==='night-garden'?'night':''}">${svg}</div><h2>${esc(label)}</h2><p>${esc(recipe.semantics.subjectId)} · Visual generator ${recipe.version} · ${esc(theme)}</p></article>`).join('')
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>House Care · Character Studio 18A visual proof</title><style>*{box-sizing:border-box}body{margin:0;background:#f4e8d0;color:#153d3a;font-family:system-ui,sans-serif}header{padding:24px max(20px,5vw);border-bottom:3px solid #153d3a}h1{font:900 clamp(1.8rem,5vw,3rem) Georgia,serif;margin:0 0 12px}p{line-height:1.45}.grid{margin:auto;max-width:1200px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,450px),1fr));gap:16px;padding:18px}.proof-card{border:2px solid #153d3a;border-radius:16px;background:#fff9ec;padding:12px}.proof-card h2{font:800 1.25rem Georgia,serif;margin:12px 4px 4px}.proof-card p{font-size:.84rem;margin:4px}.proof-preview{background:#fff9ec;border-radius:8px}.proof-preview.night{background:#17211b}.proof-preview svg{width:100%;height:auto;display:block}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><header><h1>Character Studio · Phase 18A</h1><p>Offline proof of the actual deterministic SVG renderer. These six snapshots show Auto, facial details, poses/hands, props/scene, fallback, and light/night palettes. This is <strong>not</strong> a screenshot of the live application. The real editor lives in Routines, Actions, and the Home inspector and discards changes when closed.</p></header><main class="grid">${cards}</main></body></html>`
  const schema={
    $schema:'https://json-schema.org/draft/2020-12/schema',title:'House Care Character Studio draft overrides (18A)',
    description:'Pure local preview configuration. Phase 18A never persists these values.',type:'object',additionalProperties:false,
    properties:{subjectId:{type:'string',enum:STUDIO_OBJECT_IDS},expression:{type:'string',enum:EXPRESSION_IDS},
      eyes:{type:'string',enum:EXPRESSION_IDS},mouth:{type:'string',enum:EXPRESSION_IDS},brows:{type:'string',enum:EXPRESSION_IDS},
      pose:{type:'string',enum:POSE_IDS},handGesture:{type:'string',enum:STUDIO_GESTURES},
      scale:{type:'number',minimum:0.75,maximum:1.25,multipleOf:0.05},
      proportion:{type:'string',enum:STUDIO_PROPORTIONS},prop:{type:'string',enum:STUDIO_PROPS},
      scene:{type:'string',enum:ENVIRONMENT_FAMILIES},paletteVariant:{type:'string',enum:CARD_PALETTE_VARIANTS},
      animation:{type:'string',enum:STUDIO_ANIMATIONS}},
    $comment:'Subject and fields are whitelisted. Only keys with non-Auto values are meaningful. Unknown fields rejected; no file, URL, markup, script, or external media.'
  }
  const outDir=join(root,'design/v2/page-reference')
  mkdirSync(outDir,{recursive:true})
  writeFileSync(join(outDir,'v2-phase18a-studio-proof.svg'),contactSvg)
  writeFileSync(join(outDir,'v2-phase18a-studio-proof.html'),html)
  writeFileSync(join(root,'docs','V2_PHASE18A_DRAFT_SCHEMA.json'),JSON.stringify(schema,null,2)+'\n')
  console.log(`Wrote ${svgTiles.length} real renderer visual proof snapshots and draft JSON schema. No browser/app screenshot.`)
} finally { rmSync(tmp,{recursive:true,force:true}) }
