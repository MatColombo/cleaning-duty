// Compile pure-domain tests with the installed TypeScript and execute the output.
const { mkdtempSync, readdirSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = join(__dirname, '..')
const out = mkdtempSync(join(tmpdir(), 'house-care-tests-'))
try {
  const tests = readdirSync(join(root, 'tests')).filter((name) => name.endsWith('.test.ts')).map((name) => join(root, 'tests', name))
  const compiler = require.resolve('typescript/bin/tsc')
  const compiled = spawnSync(process.execPath, [compiler, '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--strict', '--skipLibCheck', '--outDir', out, ...tests], { cwd: root, stdio: 'inherit' })
  if (compiled.status !== 0) process.exitCode = compiled.status || 1
  else {
    writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}')
    for (const file of readdirSync(join(out, 'tests')).filter((name) => name.endsWith('.test.js')).sort()) {
      const result = spawnSync(process.execPath, [join(out, 'tests', file)], { cwd: root, stdio: 'inherit' })
      if (result.status !== 0) { process.exitCode = result.status || 1; break }
    }
  }
} finally { rmSync(out, { recursive: true, force: true }) }
