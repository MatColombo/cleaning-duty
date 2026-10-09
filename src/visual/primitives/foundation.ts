import { VECTOR_ARTBOARDS } from '../artboards'
import type { PrimitiveDefinition } from '../types'

export const foundationDemoPrimitives: readonly PrimitiveDefinition[] = Object.freeze([
  {
    metadata: {
      id: 'demo-geometric-house',
      family: 'foundation-demo',
      artboard: VECTOR_ARTBOARDS.smallObject,
      safeInset: { top: 12, right: 12, bottom: 10, left: 12 },
      faceAnchor: { x: 64, y: 69 },
      limbAnchors: { leftArm: { x: 28, y: 72 }, rightArm: { x: 100, y: 72 } },
      supportedActionFamilies: ['maintain'],
      supportedEnvironmentFamilies: ['generic-interior'],
      demoOnly: true,
    },
    render({ palette, pattern }) {
      return {
        registration: '<path d="M19 55 L64 18 L109 55 V109 H19 Z" />',
        body: `<path d="M19 55 L64 18 L109 55 V109 H19 Z" fill="${palette.surface}" stroke="${palette.ink}" stroke-width="5" stroke-linejoin="round" />
          <path d="M15 57 L64 15 L113 57" fill="none" stroke="${palette.coral}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="47" y="72" width="34" height="37" rx="4" fill="${palette.primary}" />
          <rect x="26" y="58" width="24" height="21" rx="3" fill="${palette.turquoise}" />
          <rect x="78" y="58" width="24" height="21" rx="3" fill="${palette.mustard}" />
          <path d="M20 88 H108 V109 H20 Z" fill="${pattern('halftoneFine')}" opacity="0.55" />`,
        foreground: `<circle cx="57" cy="86" r="3" fill="${palette.paper}" /><circle cx="71" cy="86" r="3" fill="${palette.paper}" /><path d="M55 95 Q64 102 73 95" fill="none" stroke="${palette.paper}" stroke-width="3" stroke-linecap="round" />`,
      }
    },
  },
  {
    metadata: {
      id: 'demo-geometric-bottle',
      family: 'foundation-demo',
      artboard: VECTOR_ARTBOARDS.mainObject,
      safeInset: { top: 18, right: 26, bottom: 18, left: 26 },
      faceAnchor: { x: 120, y: 137 },
      limbAnchors: { leftArm: { x: 62, y: 140 }, rightArm: { x: 178, y: 140 }, leftLeg: { x: 97, y: 207 }, rightLeg: { x: 143, y: 207 } },
      supportedActionFamilies: ['spray', 'wipe', 'maintain'],
      supportedEnvironmentFamilies: ['generic-interior'],
      demoOnly: true,
    },
    render({ palette, pattern }) {
      return {
        registration: '<path d="M79 75 C79 57 93 44 111 44 H132 C150 44 164 57 164 75 V90 C184 108 194 134 194 164 V193 C194 211 180 224 162 224 H78 C60 224 46 211 46 193 V164 C46 134 56 108 76 90 Z" />',
        body: `<path d="M93 24 H164 V45 H132 L121 61 H93 Z" fill="${palette.surface}" stroke="${palette.ink}" stroke-width="6" stroke-linejoin="round" />
          <path d="M79 75 C79 57 93 44 111 44 H132 C150 44 164 57 164 75 V90 C184 108 194 134 194 164 V193 C194 211 180 224 162 224 H78 C60 224 46 211 46 193 V164 C46 134 56 108 76 90 Z" fill="${palette.turquoise}" stroke="${palette.ink}" stroke-width="7" stroke-linejoin="round" />
          <path d="M58 170 H182 V211 H58 Z" fill="${pattern('halftoneMedium')}" opacity="0.55" />
          <rect x="78" y="151" width="84" height="42" rx="12" fill="${palette.paper}" stroke="${palette.ink}" stroke-width="5" />
          <path d="M72 109 Q120 82 168 109" fill="none" stroke="${palette.mustard}" stroke-width="9" stroke-linecap="round" opacity="0.85" />`,
        foreground: `<circle cx="108" cy="169" r="5" fill="${palette.ink}" /><circle cx="132" cy="169" r="5" fill="${palette.ink}" /><path d="M105 181 Q120 192 135 181" fill="none" stroke="${palette.ink}" stroke-width="5" stroke-linecap="round" />`,
      }
    },
  },
  {
    metadata: {
      id: 'demo-geometric-scene',
      family: 'foundation-demo',
      artboard: VECTOR_ARTBOARDS.scene,
      safeInset: { top: 24, right: 28, bottom: 22, left: 28 },
      faceAnchor: { x: 243, y: 184 },
      limbAnchors: {},
      supportedActionFamilies: ['maintain'],
      supportedEnvironmentFamilies: ['living', 'generic-interior'],
      demoOnly: true,
    },
    render({ palette, pattern }) {
      return {
        registration: '<rect x="74" y="154" width="284" height="112" rx="28" />',
        body: `<rect x="20" y="20" width="440" height="280" rx="28" fill="${palette.paper}" />
          <path d="M20 208 L460 116 V300 H20 Z" fill="${palette.primarySoft}" />
          <rect x="74" y="154" width="284" height="112" rx="28" fill="${palette.coral}" stroke="${palette.ink}" stroke-width="7" />
          <rect x="98" y="130" width="236" height="76" rx="24" fill="${palette.coral}" stroke="${palette.ink}" stroke-width="7" />
          <rect x="100" y="174" width="90" height="54" rx="16" fill="${pattern('halftoneDiagonal')}" opacity="0.62" />
          <rect x="240" y="174" width="90" height="54" rx="16" fill="${palette.turquoise}" opacity="0.8" />
          <circle cx="380" cy="100" r="42" fill="${pattern('sparkles')}" />
          <path d="M376 265 H430" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round" />
          <path d="M399 265 V120" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round" />
          <path d="M365 120 H432 L414 68 H383 Z" fill="${palette.mustard}" stroke="${palette.ink}" stroke-width="6" stroke-linejoin="round" />
          <ellipse cx="210" cy="274" rx="150" ry="18" fill="${pattern('halftoneCoarse')}" opacity="0.48" />`,
        foreground: `<circle cx="224" cy="176" r="5" fill="${palette.ink}" /><circle cx="248" cy="176" r="5" fill="${palette.ink}" /><path d="M221 190 Q236 202 251 190" fill="none" stroke="${palette.ink}" stroke-width="5" stroke-linecap="round" />`,
      }
    },
  },
])
