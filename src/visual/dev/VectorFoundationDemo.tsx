import { themePreset } from '../../lib/theme'
import { SvgPrimitive } from '../SvgPrimitive'
import { vectorPaletteFromTheme } from '../palette'

/** Development-only gallery component. It is intentionally not routed in Phase 3. */
export function VectorFoundationDemo() {
  const retro = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
  const coastal = vectorPaletteFromTheme(themePreset('coastal-blue').palette)

  return <section className="hc-vector-demo hc-v2-paper" aria-label="House Care V2 vector foundation demo">
    <header>
      <p className="hc-v2-eyebrow">V2 vector foundation</p>
      <h1 className="hc-v2-display">Inline multicolor SVG</h1>
      <p>Authored primitives with scoped defs, semantic palettes, halftone and optional print registration.</p>
    </header>
    <div className="hc-vector-demo-grid">
      <article className="hc-vector-demo-card"><SvgPrimitive id="demo-geometric-house" instanceKey="demo-house-retro" label="Geometric house demo" palette={retro} /></article>
      <article className="hc-vector-demo-card"><SvgPrimitive id="demo-geometric-bottle" instanceKey="demo-bottle-coastal" label="Geometric bottle demo" palette={coastal} /></article>
      <article className="hc-vector-demo-card"><SvgPrimitive id="demo-geometric-scene" instanceKey="demo-scene-retro" label="Geometric room scene demo" palette={retro} misregistration={false} /></article>
      <article className="hc-vector-demo-card"><SvgPrimitive id="demo-geometric-house" instanceKey="demo-house-second-instance" label="Second scoped house instance" palette={coastal} /></article>
    </div>
  </section>
}
