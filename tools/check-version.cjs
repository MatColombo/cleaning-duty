const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const expectedV = `v${version}`
const failures = []

const read = (file) => readFileSync(join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

const readme = read('README.md')
expect(readme.split(/\r?\n/, 1)[0].includes(expectedV), `README heading must include ${expectedV}`)

const sw = read('public/sw.js')
expect(sw.includes(`const VERSION = '${expectedV}'`), `public/sw.js VERSION must be ${expectedV}`)
for (const match of sw.matchAll(/\?v=([^'"\s]+)/g)) {
  expect(match[1] === version, `public/sw.js cache-buster ${match[1]} must equal ${version}`)
}

const manifest = read('public/manifest.webmanifest')
for (const match of manifest.matchAll(/\?v=([^"\s]+)/g)) {
  expect(match[1] === version, `manifest cache-buster ${match[1]} must equal ${version}`)
}

const html = read('index.html')
for (const match of html.matchAll(/\?v=([^"\s]+)/g)) {
  expect(match[1] === version, `index.html cache-buster ${match[1]} must equal ${version}`)
}

const versionModule = read('src/app/version.ts')
expect(versionModule.includes("from '../../package.json'"), 'src/app/version.ts must derive APP_VERSION from package.json')
const diagnostics = read('src/components/ErrorLogPanel.tsx')
expect(diagnostics.includes('APP_VERSION') && diagnostics.includes('v{APP_VERSION}'), 'Diagnostics must show canonical APP_VERSION')
const backup = read('src/lib/backup.ts')
expect(backup.includes('APPLICATION_VERSION = APP_VERSION'), 'backup application version must derive from APP_VERSION')

if (failures.length) {
  console.error(`Version consistency check failed for package version ${version}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Version consistency check passed: ${version}`)
