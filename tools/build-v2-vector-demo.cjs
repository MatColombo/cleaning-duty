const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = join(__dirname, '..')
const out = mkdtempSync(join(tmpdir(), 'house-care-vector-demo-'))
try {
  const compiler = require.resolve('typescript/bin/tsc')
  const compile = spawnSync(process.execPath, [
    compiler,
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--strict',
    '--skipLibCheck',
    '--rootDir', join(root, 'src'),
    '--outDir', out,
    join(root, 'src/visual/render.ts'),
  ], { cwd: root, stdio: 'inherit' })
  if (compile.status !== 0) process.exit(compile.status || 1)

  const { renderPrimitiveSvg } = require(join(out, 'visual/render.js'))
  const retro = {
    paper: '#F4E8D0', surface: '#FFF9EC', ink: '#153D3A', inkMuted: '#586663',
    primary: '#1F6B63', primarySoft: '#C7D7CB', mustard: '#C38A32', coral: '#C65E48', danger: '#A93F3A', turquoise: '#4E9D94',
  }
  const coastal = {
    paper: '#F4F8F8', surface: '#FFFFFF', ink: '#1E2D31', inkMuted: '#617177',
    primary: '#3E6F7F', primarySoft: '#BED7DE', mustard: '#D6AA4D', coral: '#D37661', danger: '#AF4A4A', turquoise: '#6D929B',
  }

  const cards = [
    ['demo-geometric-house', 'house-retro', retro, true, 'House / Retro palette'],
    ['demo-geometric-house', 'house-coastal', coastal, true, 'Same primitive / Coastal palette'],
    ['demo-geometric-bottle', 'bottle-retro', retro, true, 'Object / Halftone + registration'],
    ['demo-geometric-bottle', 'bottle-clean', coastal, false, 'Object / registration disabled'],
    ['demo-geometric-scene', 'scene-retro', retro, false, 'Scene artboard / flat vector'],
  ]
  const markup = cards.map(([id, key, palette, registration, label]) => `<article class="demo-card"><div class="art">${renderPrimitiveSvg(id, { instanceKey: key, palette, title: label, misregistration: registration })}</div><strong>${label}</strong><code>${id}</code></article>`).join('\n')
  const stress = Array.from({ length: 24 }, (_, index) => renderPrimitiveSvg(index % 2 ? 'demo-geometric-house' : 'demo-geometric-bottle', {
    instanceKey: `stress-demo-${index}`,
    palette: index % 3 ? retro : coastal,
    decorative: true,
    misregistration: index % 4 !== 0,
  })).join('')

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>House Care V2 Vector Foundation Demo</title>
<style>
:root{--paper:#F4E8D0;--surface:#FFF9EC;--ink:#153D3A;--muted:#586663;--teal:#1F6B63;--coral:#C65E48}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:system-ui,sans-serif;background-color:var(--paper);background-image:radial-gradient(circle at 1px 1px,rgba(21,61,58,.08) 0 .55px,transparent .7px),radial-gradient(circle at 4px 5px,rgba(198,94,72,.04) 0 .45px,transparent .6px);background-size:7px 7px,11px 11px}.shell{max-width:1040px;margin:auto;padding:24px}.eyebrow{font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--teal)}h1{font-family:Georgia,serif;font-size:clamp(2rem,8vw,4.5rem);line-height:.9;margin:.25rem 0 .75rem}.lede{max-width:62ch;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:16px;margin-top:24px}.demo-card{display:grid;gap:10px;padding:16px;border:2px solid var(--ink);border-radius:18px;background:rgba(255,249,236,.9);box-shadow:5px 5px 0 rgba(21,61,58,.08)}.art{min-height:200px;display:grid;place-items:center}.art svg{display:block;width:100%;max-height:290px}.demo-card code{font-size:.72rem;color:var(--muted);overflow-wrap:anywhere}.stress{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:30px;padding:12px;border-radius:18px;background:rgba(255,249,236,.65)}.stress svg{display:block;width:100%;min-width:0}.note{font-size:.85rem;color:var(--muted);margin-top:12px}@media(max-width:540px){.shell{padding:14px}.grid{grid-template-columns:1fr 1fr;gap:10px}.demo-card{padding:10px}.art{min-height:140px}.grid .demo-card:last-child{grid-column:1/-1}.stress{grid-template-columns:repeat(4,1fr)}}
</style></head><body><main class="shell"><p class="eyebrow">House Care V2 · Phase 3</p><h1>Vector foundation</h1><p class="lede">Technical demo only. No task artwork or procedural card generation: scoped inline SVG, semantic palette substitution, reusable halftone/pattern defs and deterministic print registration.</p><section class="grid">${markup}</section><p class="note">24-instance collision/render stress strip:</p><section class="stress" aria-hidden="true">${stress}</section></main></body></html>`

  const targetDir = join(root, 'design/v2/page-reference')
  mkdirSync(targetDir, { recursive: true })
  writeFileSync(join(targetDir, 'vector-foundation-demo.html'), html)
  console.log('Wrote design/v2/page-reference/vector-foundation-demo.html')
} finally {
  rmSync(out, { recursive: true, force: true })
}
