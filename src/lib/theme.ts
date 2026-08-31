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
export type ThemeId = 'fresh-sage' | 'warm-clay' | 'coastal-blue' | 'lavender-smoke' | 'charcoal-citrus' | 'custom'

export interface ThemePreset {
  id: Exclude<ThemeId, 'custom'>
  name: string
  palette: ThemePalette
}

export const themePresets: ThemePreset[] = [
  {
    id: 'fresh-sage',
    name: 'Fresh Sage',
    palette: { canvas: '#F7F7F2', surface: '#FFFFFF', surfaceSoft: '#EEF3EF', ink: '#1D2A24', inkMuted: '#66716A', primary: '#2F6F5E', primarySoft: '#B7D8C9', due: '#E7B65A', overdue: '#D97A61', danger: '#B54A4A' },
  },
  {
    id: 'warm-clay',
    name: 'Warm Clay',
    palette: { canvas: '#FAF6F1', surface: '#FFFFFF', surfaceSoft: '#F2E9E2', ink: '#30241F', inkMuted: '#75655D', primary: '#A75F4A', primarySoft: '#E5C1B6', due: '#D5A545', overdue: '#C96D55', danger: '#A94747' },
  },
  {
    id: 'coastal-blue',
    name: 'Coastal Blue',
    palette: { canvas: '#F4F8F8', surface: '#FFFFFF', surfaceSoft: '#EAF2F4', ink: '#1E2D31', inkMuted: '#617177', primary: '#3E6F7F', primarySoft: '#BED7DE', due: '#D6AA4D', overdue: '#D37661', danger: '#AF4A4A' },
  },
  {
    id: 'lavender-smoke',
    name: 'Lavender Smoke',
    palette: { canvas: '#F7F5F9', surface: '#FFFFFF', surfaceSoft: '#F0EDF4', ink: '#292532', inkMuted: '#6D6875', primary: '#665C7A', primarySoft: '#D3CDE0', due: '#D4A84B', overdue: '#CB735F', danger: '#AC494D' },
  },
  {
    id: 'charcoal-citrus',
    name: 'Charcoal Citrus',
    palette: { canvas: '#F7F7F3', surface: '#FFFFFF', surfaceSoft: '#EEF0EC', ink: '#252925', inkMuted: '#676E68', primary: '#49524B', primarySoft: '#D6DED7', due: '#D0A23B', overdue: '#CE7058', danger: '#A84747' },
  },
]

export const defaultThemeId: ThemeId = 'fresh-sage'

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
  root.style.colorScheme = 'light'
}
