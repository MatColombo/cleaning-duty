export const themeTokenKeys = [
  'canvas',
  'surface',
  'surfaceSoft',
  'ink',
  'inkMuted',
  'primary',
  'primarySoft',
  'due',
  'overdue',
  'danger',
] as const

export type ThemeTokenKey = typeof themeTokenKeys[number]
export type ThemePalette = Record<ThemeTokenKey, string>
export type ThemePresetId =
  | 'fresh-sage'
  | 'warm-clay'
  | 'coastal-blue'
  | 'lavender-smoke'
  | 'charcoal-citrus'
  | 'night-garden'
  | 'midnight-blue'
  | 'plum-night'
  | 'graphite-mono'
  | 'clear-spectrum'
  | 'candy-pop'
  | 'confetti'
  | 'electric-garden'
  | 'arctic-mint'
  | 'glacier-blue'
  | 'nordic-fog'
  | 'deep-teal'
export type ThemeId = ThemePresetId | 'custom'
export type ThemeCategory = 'classic' | 'night' | 'mono' | 'accessible' | 'colorful' | 'cool'

export interface ThemePreset {
  id: ThemePresetId
  name: string
  category: ThemeCategory
  palette: ThemePalette
}

export const themeCategoryOrder: ThemeCategory[] = ['classic', 'night', 'mono', 'accessible', 'colorful', 'cool']

export const themePresets: ThemePreset[] = [
  {
    id: 'fresh-sage',
    name: 'Fresh Sage',
    category: 'classic',
    palette: { canvas: '#F7F7F2', surface: '#FFFFFF', surfaceSoft: '#EEF3EF', ink: '#1D2A24', inkMuted: '#66716A', primary: '#2F6F5E', primarySoft: '#B7D8C9', due: '#E7B65A', overdue: '#D97A61', danger: '#B54A4A' },
  },
  {
    id: 'warm-clay',
    name: 'Warm Clay',
    category: 'classic',
    palette: { canvas: '#FAF6F1', surface: '#FFFFFF', surfaceSoft: '#F2E9E2', ink: '#30241F', inkMuted: '#75655D', primary: '#A75F4A', primarySoft: '#E5C1B6', due: '#D5A545', overdue: '#C96D55', danger: '#A94747' },
  },
  {
    id: 'coastal-blue',
    name: 'Coastal Blue',
    category: 'classic',
    palette: { canvas: '#F4F8F8', surface: '#FFFFFF', surfaceSoft: '#EAF2F4', ink: '#1E2D31', inkMuted: '#617177', primary: '#3E6F7F', primarySoft: '#BED7DE', due: '#D6AA4D', overdue: '#D37661', danger: '#AF4A4A' },
  },
  {
    id: 'lavender-smoke',
    name: 'Lavender Smoke',
    category: 'classic',
    palette: { canvas: '#F7F5F9', surface: '#FFFFFF', surfaceSoft: '#F0EDF4', ink: '#292532', inkMuted: '#6D6875', primary: '#665C7A', primarySoft: '#D3CDE0', due: '#D4A84B', overdue: '#CB735F', danger: '#AC494D' },
  },
  {
    id: 'charcoal-citrus',
    name: 'Charcoal Citrus',
    category: 'classic',
    palette: { canvas: '#F7F7F3', surface: '#FFFFFF', surfaceSoft: '#EEF0EC', ink: '#252925', inkMuted: '#676E68', primary: '#49524B', primarySoft: '#D6DED7', due: '#D0A23B', overdue: '#CE7058', danger: '#A84747' },
  },
  {
    id: 'night-garden',
    name: 'Night Garden',
    category: 'night',
    palette: { canvas: '#101713', surface: '#17211B', surfaceSoft: '#202C25', ink: '#F2F6F3', inkMuted: '#B7C4BC', primary: '#74C69D', primarySoft: '#294C3A', due: '#F0C56A', overdue: '#F28B74', danger: '#FF7B7B' },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    category: 'night',
    palette: { canvas: '#0E1520', surface: '#141E2B', surfaceSoft: '#1D2A39', ink: '#F3F7FB', inkMuted: '#B3C0CF', primary: '#75BDE0', primarySoft: '#27485D', due: '#F0BF63', overdue: '#EF8876', danger: '#FF7A86' },
  },
  {
    id: 'plum-night',
    name: 'Plum Night',
    category: 'night',
    palette: { canvas: '#18121C', surface: '#211827', surfaceSoft: '#2C2033', ink: '#FAF4FC', inkMuted: '#C6B8CC', primary: '#C39BE8', primarySoft: '#49335D', due: '#F1C36C', overdue: '#F18A7E', danger: '#FF7788' },
  },
  {
    id: 'graphite-mono',
    name: 'Graphite Mono',
    category: 'mono',
    palette: { canvas: '#F2F2F2', surface: '#FFFFFF', surfaceSoft: '#E4E4E4', ink: '#1F1F1F', inkMuted: '#5D5D5D', primary: '#3F3F3F', primarySoft: '#D2D2D2', due: '#707070', overdue: '#4E4E4E', danger: '#232323' },
  },
  {
    id: 'clear-spectrum',
    name: 'Clear Spectrum',
    category: 'accessible',
    palette: { canvas: '#F7F8FA', surface: '#FFFFFF', surfaceSoft: '#EAF0F4', ink: '#17212B', inkMuted: '#58646F', primary: '#0072B2', primarySoft: '#C8E6F3', due: '#E69F00', overdue: '#D55E00', danger: '#A83A00' },
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    category: 'colorful',
    palette: { canvas: '#FFF7FC', surface: '#FFFFFF', surfaceSoft: '#F9E7F4', ink: '#2C1931', inkMuted: '#705E75', primary: '#B43E8F', primarySoft: '#F2B7D9', due: '#E59B2F', overdue: '#E0614C', danger: '#B8293D' },
  },
  {
    id: 'confetti',
    name: 'Confetti',
    category: 'colorful',
    palette: { canvas: '#F8FAFF', surface: '#FFFFFF', surfaceSoft: '#E8EEFF', ink: '#1E2440', inkMuted: '#5E6682', primary: '#315BDB', primarySoft: '#CBD8FF', due: '#D99100', overdue: '#D9506A', danger: '#AA3151' },
  },
  {
    id: 'electric-garden',
    name: 'Electric Garden',
    category: 'colorful',
    palette: { canvas: '#F8F6FF', surface: '#FFFFFF', surfaceSoft: '#EDE8FF', ink: '#211C34', inkMuted: '#615C72', primary: '#6554C0', primarySoft: '#CFC5FF', due: '#D9A514', overdue: '#E0645C', danger: '#B72F55' },
  },
  {
    id: 'arctic-mint',
    name: 'Arctic Mint',
    category: 'cool',
    palette: { canvas: '#F2FAF8', surface: '#FFFFFF', surfaceSoft: '#E2F3EF', ink: '#17302D', inkMuted: '#5A6D69', primary: '#227B72', primarySoft: '#BDE4DD', due: '#C99A36', overdue: '#C96655', danger: '#A63D47' },
  },
  {
    id: 'glacier-blue',
    name: 'Glacier Blue',
    category: 'cool',
    palette: { canvas: '#F3F8FC', surface: '#FFFFFF', surfaceSoft: '#E5F0F8', ink: '#172B3A', inkMuted: '#5C6E7B', primary: '#2D74A6', primarySoft: '#BCD8EC', due: '#C89A36', overdue: '#C56A59', danger: '#A53E48' },
  },
  {
    id: 'nordic-fog',
    name: 'Nordic Fog',
    category: 'cool',
    palette: { canvas: '#F5F7F8', surface: '#FFFFFF', surfaceSoft: '#E8EDF0', ink: '#202C33', inkMuted: '#647078', primary: '#526F7B', primarySoft: '#CFDDE2', due: '#C89D47', overdue: '#C16C5D', danger: '#A94850' },
  },
  {
    id: 'deep-teal',
    name: 'Deep Teal',
    category: 'cool',
    palette: { canvas: '#F2F8F7', surface: '#FFFFFF', surfaceSoft: '#E4F0EE', ink: '#16302F', inkMuted: '#5B6C6A', primary: '#286A68', primarySoft: '#B9D8D4', due: '#C89E43', overdue: '#C86B59', danger: '#A83F47' },
  },
]

export const defaultThemeId: ThemeId = 'fresh-sage'

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === 'string' && themePresets.some((preset) => preset.id === value)
}

export function themePreset(id: ThemeId): ThemePreset {
  return themePresets.find((preset) => preset.id === id) ?? themePresets[0]
}

const HEX = /^#[0-9a-f]{6}$/i
export function sanitizePalette(value: unknown, fallback = themePresets[0].palette): ThemePalette {
  const input = value && typeof value === 'object' ? value as Partial<Record<ThemeTokenKey, unknown>> : {}
  return Object.fromEntries(themeTokenKeys.map((key) => [key, typeof input[key] === 'string' && HEX.test(input[key] as string) ? (input[key] as string).toUpperCase() : fallback[key]])) as ThemePalette
}

function rgb(hex: string) {
  const value = hex.slice(1)
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
}

function luminance(hex: string) {
  return rgb(hex).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

export function contrastRatio(a: string, b: string): number {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (bright + .05) / (dark + .05)
}

export function bestForeground(background: string): '#FFFFFF' | '#111111' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#111111') ? '#FFFFFF' : '#111111'
}

export interface ContrastIssue { pair: string; ratio: number; minimum: number }
export function contrastIssues(palette: ThemePalette): ContrastIssue[] {
  const pairs: Array<[string, string, string, number]> = [
    ['Ink / Canvas', palette.ink, palette.canvas, 4.5],
    ['Ink / Surface', palette.ink, palette.surface, 4.5],
    ['Muted / Canvas', palette.inkMuted, palette.canvas, 4.5],
    ['Muted / Surface', palette.inkMuted, palette.surface, 4.5],
    ['Primary action text', bestForeground(palette.primary), palette.primary, 4.5],
    ['Danger action text', bestForeground(palette.danger), palette.danger, 4.5],
  ]
  return pairs.flatMap(([pair, foreground, background, minimum]) => {
    const ratio = contrastRatio(foreground, background)
    return ratio + 0.001 < minimum ? [{ pair, ratio, minimum }] : []
  })
}

export function applyTheme(palette: ThemePalette) {
  const root = document.documentElement
  root.style.setProperty('--color-canvas', palette.canvas)
  root.style.setProperty('--color-surface', palette.surface)
  root.style.setProperty('--color-surface-soft', palette.surfaceSoft)
  root.style.setProperty('--color-ink', palette.ink)
  root.style.setProperty('--color-ink-muted', palette.inkMuted)
  root.style.setProperty('--color-primary', palette.primary)
  root.style.setProperty('--color-primary-soft', palette.primarySoft)
  root.style.setProperty('--color-due', palette.due)
  root.style.setProperty('--color-overdue', palette.overdue)
  root.style.setProperty('--color-danger', palette.danger)
  root.style.setProperty('--color-on-primary', bestForeground(palette.primary))
  root.style.setProperty('--color-on-danger', bestForeground(palette.danger))
  root.style.colorScheme = luminance(palette.canvas) < 0.28 ? 'dark' : 'light'
  document.querySelector('meta[name=\"theme-color\"]')?.setAttribute('content', palette.canvas)
}
