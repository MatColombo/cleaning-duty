export interface DiagnosticAction {
  at: string
  label: string
  route: string
}

export interface ErrorLogEntry {
  id: string
  firstAt: string
  lastAt: string
  count: number
  message: string
  code?: string
  details?: string
  hint?: string
  stack?: string
  area?: string
  route: string
  workspaceId?: string
  workspaceName?: string
  userId?: string
  online: boolean
  recentActions: DiagnosticAction[]
}

interface DiagnosticContext {
  workspaceId?: string
  workspaceName?: string
  userId?: string
}

const STORAGE_KEY = 'house-care-error-log-v1'
const MAX_ENTRIES = 40
const MAX_ACTIONS = 8
const DEDUPE_WINDOW_MS = 30_000

let diagnosticContext: DiagnosticContext = {}
let recentActions: DiagnosticAction[] = []
const listeners = new Set<() => void>()
let installed = false

function safeString(value: unknown, max = 1200): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value.slice(0, max)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(value, (_key, nested) => {
      if (typeof nested === 'object' && nested !== null) {
        if (seen.has(nested)) return '[circular]'
        seen.add(nested)
      }
      return nested
    }).slice(0, max)
  } catch {
    try { return String(value).slice(0, max) } catch { return undefined }
  }
}

function objectField(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined
  return (value as Record<string, unknown>)[key]
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  const message = objectField(error, 'message')
  const details = objectField(error, 'details')
  const hint = objectField(error, 'hint')
  const code = objectField(error, 'code')
  const parts = [message, details, hint].map((part) => safeString(part, 500)).filter(Boolean)
  if (parts.length) return `${parts.join(' · ')}${code ? ` (${safeString(code, 80)})` : ''}`
  return safeString(error, 700) ?? 'Unknown error'
}

function loadEntries(): ErrorLogEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : []
  } catch { return [] }
}

function saveEntries(entries: ErrorLogEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))) } catch { /* local diagnostics must never break the app */ }
  listeners.forEach((listener) => listener())
}

export function getErrorLog(): ErrorLogEntry[] {
  return loadEntries().slice().reverse()
}

export function clearErrorLog(): void {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
  listeners.forEach((listener) => listener())
}

export function subscribeErrorLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setDiagnosticContext(next: DiagnosticContext): void {
  diagnosticContext = { ...diagnosticContext, ...next }
}

export function recordDiagnosticAction(label: string): void {
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, 140)
  if (!clean) return
  const route = typeof location === 'undefined' ? '' : `${location.pathname}${location.search}`
  recentActions = [...recentActions, { at: new Date().toISOString(), label: clean, route }].slice(-MAX_ACTIONS)
}

export function logClientError(error: unknown, context: { area?: string; details?: string } = {}): string {
  const message = normalizeError(error)
  const now = new Date().toISOString()
  const route = typeof location === 'undefined' ? '' : `${location.pathname}${location.search}`
  const code = safeString(objectField(error, 'code'), 100)
  const details = context.details ?? safeString(objectField(error, 'details'), 800)
  const hint = safeString(objectField(error, 'hint'), 500)
  const stack = error instanceof Error ? error.stack?.slice(0, 3500) : safeString(objectField(error, 'stack'), 3500)
  const entries = loadEntries()
  const signature = `${message}|${context.area ?? ''}|${route}|${diagnosticContext.workspaceId ?? ''}`
  const last = entries.at(-1)
  const lastSignature = last ? `${last.message}|${last.area ?? ''}|${last.route}|${last.workspaceId ?? ''}` : ''
  const withinWindow = last && Date.now() - new Date(last.lastAt).getTime() <= DEDUPE_WINDOW_MS

  if (last && withinWindow && signature === lastSignature) {
    entries[entries.length - 1] = {
      ...last,
      lastAt: now,
      count: last.count + 1,
      details: details ?? last.details,
      hint: hint ?? last.hint,
      recentActions: recentActions.slice(),
    }
  } else {
    entries.push({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      firstAt: now,
      lastAt: now,
      count: 1,
      message,
      code,
      details,
      hint,
      stack,
      area: context.area,
      route,
      workspaceId: diagnosticContext.workspaceId,
      workspaceName: diagnosticContext.workspaceName,
      userId: diagnosticContext.userId,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      recentActions: recentActions.slice(),
    })
  }
  saveEntries(entries)
  return message
}

function actionLabel(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const element = target.closest('button, a, [role="button"], summary') as HTMLElement | null
  if (!element) return null
  const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent
  if (!label) return null
  return `Tap: ${label}`
}

export function installClientDiagnostics(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.addEventListener('click', (event) => {
    const label = actionLabel(event.target)
    if (label) recordDiagnosticAction(label)
  }, true)
  document.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null
    if (!form) return
    const title = form.closest('[role="dialog"]')?.getAttribute('aria-label') || form.getAttribute('aria-label') || 'form'
    recordDiagnosticAction(`Submit: ${title}`)
  }, true)
  window.addEventListener('error', (event) => {
    logClientError(event.error ?? event.message, { area: 'window' })
  })
  window.addEventListener('unhandledrejection', (event) => {
    logClientError(event.reason, { area: 'unhandled promise' })
  })
}
