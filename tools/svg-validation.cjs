const DEFAULT_MAX_BYTES = 160 * 1024
const DEFAULT_MAX_PATHS = 120

function unique(values) {
  return [...new Set(values)]
}

function validateSvgSource(source, options = {}) {
  const issues = []
  const allowFixedColors = options.allowFixedColors === true
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS
  const bytes = Buffer.byteLength(source, 'utf8')

  if (!/<svg\b/i.test(source)) issues.push({ code: 'missing-svg-root', message: 'Missing <svg> root element' })
  if (/<svg\b(?![^>]*\bviewBox\s*=)[^>]*>/i.test(source)) issues.push({ code: 'missing-viewbox', message: 'SVG root must declare a viewBox' })
  if (/<image\b/i.test(source) || /data:image\//i.test(source)) issues.push({ code: 'raster-embed', message: 'Raster <image> or data:image content is not allowed' })
  if (/\b(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/)/i.test(source) || /url\(\s*["']?(?:https?:|\/\/)/i.test(source)) {
    issues.push({ code: 'external-reference', message: 'External SVG references are not allowed' })
  }
  if (/<font\b/i.test(source) || /@font-face/i.test(source) || /data:font\//i.test(source)) issues.push({ code: 'embedded-font', message: 'Embedded fonts are not allowed' })

  // Validate duplicate attributes within an element. The earlier string-only
  // validator missed syntactically invalid SVG such as `stroke="a" stroke="b"`.
  // This portable pass does not require an XML/DOM dependency in node.
  for (const tag of source.matchAll(/<([A-Za-z][A-Za-z0-9:-]*)\b([^<>]*)>/g)) {
    const attributes = [...tag[2].matchAll(/\s([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"[^"]*"|'[^']*')/g)]
      .map((attribute) => attribute[1])
    for (const name of unique(attributes.filter((attr, index) => attributes.indexOf(attr) !== index))) {
      issues.push({ code: 'duplicate-attribute', message: `Duplicate ${name} attribute on <${tag[1]}>` })
    }
  }

  const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])
  const duplicates = unique(ids.filter((id, index) => ids.indexOf(id) !== index))
  for (const id of duplicates) issues.push({ code: 'duplicate-id', message: `Duplicate SVG id: ${id}` })

  if (!allowFixedColors) {
    const fixedColors = unique([
      ...[...source.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]),
      ...[...source.matchAll(/\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi)].map((match) => match[0]),
    ])
    for (const color of fixedColors) issues.push({ code: 'fixed-color', message: `Fixed color is not allowed in V2 authored primitives: ${color}` })
  }

  const pathCount = (source.match(/<path\b/gi) || []).length
  if (pathCount > maxPaths) issues.push({ code: 'path-budget', message: `SVG has ${pathCount} paths; budget is ${maxPaths}` })
  if (bytes > maxBytes) issues.push({ code: 'file-size', message: `SVG is ${bytes} bytes; budget is ${maxBytes}` })

  return { valid: issues.length === 0, issues, metrics: { bytes, pathCount, idCount: ids.length } }
}

module.exports = { DEFAULT_MAX_BYTES, DEFAULT_MAX_PATHS, validateSvgSource }
