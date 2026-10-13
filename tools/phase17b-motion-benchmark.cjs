/** Deterministic isolated CPU benchmark, NOT a browser FPS or memory measurement. */
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { performance } = require('node:perf_hooks')
const source = readFileSync('src/lib/deckGestures.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
vm.runInNewContext(js, { module: mod, exports: mod.exports })
const { boundedDrag, dragTransform, releaseDirection } = mod.exports
let checksum=0
const loops=250000
const memoryBefore=process.memoryUsage().heapUsed
const start=performance.now()
for (let i=0; i<loops; i++) {
  const dx=Math.sin(i/19)*170
  const position=boundedDrag(dx, Math.cos(i/23)*90, 390)
  checksum += position.x + releaseDirection(dx, i%23===0?-.82:.23, 390, 3)
  if (i%25===0) checksum += dragTransform(position.x,position.y,position.angle).length
}
const durationMs=performance.now()-start
const memoryAfter=process.memoryUsage().heapUsed
const result={
  context:'Node pure geometry microbenchmark; no DOM, animation, GPU, network or device FPS sampling',
  runtime:process.version, iterations:loops, durationMs:Number(durationMs.toFixed(3)),
  averageUs:Number((durationMs*1000/loops).toFixed(4)),
  memoryBeforeBytes:memoryBefore, memoryAfterBytes:memoryAfter,
  heapDeltaBytes:memoryAfter-memoryBefore, checksum:Number(checksum.toFixed(2)),
  deviceFrameTiming:'NOT MEASURED', browserJsHeap:'NOT MEASURED', actualGestureFps:'NOT MEASURED',
  backendRequestsDuringDrag:'No transport calls in presentation code (static contract); network proof NOT MEASURED',
}
mkdirSync('docs/qa/phase17b-evidence', {recursive:true})
writeFileSync('docs/qa/phase17b-evidence/cpu-motion-benchmark.json', JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
