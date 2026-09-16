import { themePresets } from '../src/lib/theme'
import { translations } from '../src/lib/translations'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }

const loadingKeys = Array.from({ length: 18 }, (_, index) => `loadingPhrase${String(index + 1).padStart(2, '0')}`)
for (const key of loadingKeys) {
  const en = translations.en[key as keyof typeof translations.en]
  const it = translations.it[key as keyof typeof translations.it]
  assert(typeof en === 'string' && en.length > 4, `English ${key} must exist`)
  assert(typeof it === 'string' && it.length > 4, `Italian ${key} must exist`)
}

assert(themePresets.filter((preset) => preset.category === 'night').length >= 3, 'Must expose three night palettes')
assert(themePresets.filter((preset) => preset.category === 'mono').length >= 1, 'Must expose a greyscale palette')
assert(themePresets.filter((preset) => preset.category === 'accessible').length >= 1, 'Must expose a colourblind-safe palette')
assert(themePresets.filter((preset) => preset.category === 'colorful').length >= 3, 'Must expose three colourful palettes')
assert(themePresets.filter((preset) => preset.category === 'cool').length >= 4, 'Must expose four cool palettes')
assert(new Set(themePresets.map((preset) => preset.id)).size === themePresets.length, 'Theme preset IDs must be unique')

console.log('v1.2.1 loading and theme expansion tests passed')
