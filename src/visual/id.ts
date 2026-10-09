import type { VectorIdScope } from './types'

/** Small stable FNV-1a hash. IDs are presentation-only; this is not security-sensitive. */
export function stableVisualHash(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function sanitizeSvgIdPart(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'instance'
}

export function createSvgIdScope(instanceKey: string, namespace = 'hc-v2'): VectorIdScope {
  const safeNamespace = sanitizeSvgIdPart(namespace)
  const safeInstance = sanitizeSvgIdPart(instanceKey).slice(0, 32)
  const prefix = `${safeNamespace}-${safeInstance}-${stableVisualHash(`${namespace}|${instanceKey}`)}`
  return Object.freeze({
    prefix,
    id(localId: string) {
      return `${prefix}-${sanitizeSvgIdPart(localId)}`
    },
    url(localId: string) {
      return `url(#${prefix}-${sanitizeSvgIdPart(localId)})`
    },
  })
}
