const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs')
const { extname, join, relative } = require('node:path')
const { validateSvgSource } = require('./svg-validation.cjs')

const root = join(__dirname, '..')
const scanRoots = [
  { path: 'design/v2/primitives', allowFixedColors: false },
  { path: 'design/v2/patterns', allowFixedColors: false },
  { path: 'design/v2/exports', allowFixedColors: true },
  { path: 'design/v2/brand', allowFixedColors: true },
  { path: 'public/brand/v2', allowFixedColors: true },
]

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : extname(path).toLowerCase() === '.svg' ? [path] : []
  })
}

let checked = 0
let failed = 0
for (const target of scanRoots) {
  for (const file of walk(join(root, target.path))) {
    checked += 1
    const result = validateSvgSource(readFileSync(file, 'utf8'), { allowFixedColors: target.allowFixedColors })
    if (!result.valid) {
      failed += 1
      console.error(`\n${relative(root, file)}`)
      for (const issue of result.issues) console.error(`  [${issue.code}] ${issue.message}`)
    }
  }
}

if (failed) {
  console.error(`\nV2 SVG validation failed: ${failed}/${checked} files have issues.`)
  process.exitCode = 1
} else {
  console.log(`V2 SVG validation passed (${checked} SVG files checked).`)
}
