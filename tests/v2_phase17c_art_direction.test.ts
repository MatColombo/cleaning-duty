declare const require: (name: string) => any
declare const process: { cwd(): string }

import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'
import { renderExpressionMark } from '../src/visual/expressions'
import { renderPoseLayers } from '../src/visual/poses'
import { CSS_VECTOR_PALETTE } from '../src/visual/palette'
import { generateCardVisualRecipe } from '../src/visual/procedural/recipe'
import { renderCardVisualSvg } from '../src/visual/procedural/render-card'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function assert(test: unknown, message: string): asserts test {
  if (!test) throw new Error(message)
}

assert(HOUSE_CARE_VISUAL_VERSION === 2, 'Phase 17C intentionally upgrades the deterministic visual generator to v2')

const joyful = renderExpressionMark('joyful', CSS_VECTOR_PALETTE)
assert(joyful.includes('data-hc-face-part="eyes"'), 'Expressions expose explicit eye grouping for readable motion-safe animation')
assert(joyful.includes('data-hc-face-part="mouth"'), 'Expressions expose explicit mouth grouping')
assert(joyful.includes('data-hc-face-part="brows"'), 'Expressions expose explicit brow grouping')

const thumbs = renderPoseLayers('thumbs-up', CSS_VECTOR_PALETTE)
assert(thumbs.foreground.includes('data-hc-thumb="up"'), 'Thumbs-up pose must explicitly mark the positive gesture')
assert(thumbs.foreground.includes('data-hc-pose-hand="right"'), 'Thumbs-up pose must preserve a stable right-hand target for hero emphasis')
assert(!thumbs.foreground.includes('middle-finger'), 'Gesture markup must not rely on ambiguous naming')

const fallbackRecipe = generateCardVisualRecipe({
  routineId: 'routine-multi', actionId: 'action-blorp', primaryTargetId: undefined,
  occurrenceId: 'occ-17c-1', triggerOrdinal: 1,
  subjectName: 'Łazienka / キッチン / غرفة', subjectTypeName: 'Mystery',
  actionName: 'Blorp', environmentName: 'Unknown room',
})
assert(fallbackRecipe.version === 2, 'Arbitrary multilingual names still resolve through generator v2')
const fallbackSvg = renderCardVisualSvg(fallbackRecipe, { instanceKey: 'phase17c-check', decorative: true, palette: CSS_VECTOR_PALETTE })
assert(fallbackSvg.includes('data-hc-card-layer="scene"') && fallbackSvg.includes('data-hc-card-layer="hero"'), 'Rendered cards keep explicit scene/hero layering')
assert(fallbackSvg.includes('data-hc-card-scene=') && fallbackSvg.includes('data-hc-card-props='), 'Rendered cards add poster scene props for stronger composition')
assert(fallbackSvg.includes('data-hc-face-role="hero"'), 'Rendered cards keep authored facial roles for the enlarged hero expression overlay')
assert(!fallbackSvg.includes('<image') && !fallbackSvg.includes('<foreignObject') && !fallbackSvg.includes('feTurbulence'), '17C keeps art procedural, lightweight and image-free')

const artworkSource = readFileSync(join(process.cwd(), 'src/components/overview/CardArtwork.tsx'), 'utf8')
assert(artworkSource.includes("prefers-reduced-motion: reduce"), 'Hero-card motion must fully respect reduced-motion')
assert(artworkSource.includes('IntersectionObserver'), 'Hero-card motion must guard offscreen/inactive cards')
assert(!/fetch\(|XMLHttpRequest|axios|supabase/i.test(artworkSource), 'No backend or network calls are allowed during drag/motion')

const overviewCss = readFileSync(join(process.cwd(), 'src/styles/overview-v2.css'), 'utf8')
assert(overviewCss.includes('@keyframes v2-card-hero-tilt'), 'Overview CSS defines finite tactile hero tilt')
assert(overviewCss.includes('@keyframes v2-card-hero-blink'), 'Overview CSS defines a finite blink animation')
assert(overviewCss.includes('@media (prefers-reduced-motion: reduce)'), 'Overview CSS disables nonessential motion when requested')

const secondaryCss = readFileSync(join(process.cwd(), 'src/styles/secondary-v2.css'), 'utf8')
assert(secondaryCss.includes('@keyframes v2-sheet-rise'), 'Secondary sheets use a tactile but finite rise animation')
assert(secondaryCss.includes('@keyframes v2-sheet-backdrop-in'), 'Secondary sheets animate the backdrop coherently')
