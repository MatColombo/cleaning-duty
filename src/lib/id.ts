export const newId = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()

/** Stable UUID-shaped identifier for records that must converge across devices.
 * This is not used for secrets; it is only an idempotency key. */
export function stableId(value: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < value.length; i += 1) {
    const k = value.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1
  const hex = [h1, h2, h3, h4].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('')
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const normalized = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${variant}${hex.slice(17)}`
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`
}
