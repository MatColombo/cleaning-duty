const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const root = join(__dirname, '../src')
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]) }
const errors = []
let count = 0
for (const path of files(root).filter(f => /\.tsx?$/.test(f))) {
  const src = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  for (const d of file.parseDiagnostics) errors.push(`${path}:${file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
  count++
}
errors.forEach(e => console.error(e))
if (errors.length) process.exitCode = 1
else console.log(`TypeScript/TSX syntax parse passed: ${count} source files (not a dependency-backed typecheck)`)
