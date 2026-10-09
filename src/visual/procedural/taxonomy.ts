/** Closed, decorative-only V2 taxonomy. These labels are never persisted as domain state. */
export const SUBJECT_FAMILIES = [
  'appliance', 'fixture', 'furniture', 'surface', 'floor', 'glass',
  'fabric', 'storage', 'room', 'outdoor', 'generic-object',
] as const
export type SubjectFamily = typeof SUBJECT_FAMILIES[number]

export const ACTION_FAMILIES = [
  'wipe', 'spray', 'scrub', 'vacuum', 'mop', 'dust', 'wash', 'descale',
  'degrease', 'disinfect', 'polish', 'tidy', 'inspect', 'refill', 'move',
  'maintain', 'generic-care',
] as const
export type ActionFamily = typeof ACTION_FAMILIES[number]

export const ENVIRONMENT_FAMILIES = [
  'kitchen', 'bathroom', 'living', 'bedroom', 'dining', 'hallway',
  'utility', 'outdoor', 'generic-interior',
] as const
export type EnvironmentFamily = typeof ENVIRONMENT_FAMILIES[number]

/** Priority refers to the origin of the object artwork, not task priority. */
export type VisualResolutionLevel = 'exact-subject' | 'entity-family' | 'action-family' | 'generic'

/** A closed set of options prevents invalid assets in a recipe. */
export const CARD_TEMPLATES = [
  'subject-left', 'subject-right', 'center-stage', 'medallion', 'diagonal', 'split-panel',
] as const
export type CardTemplate = typeof CARD_TEMPLATES[number]

/** Variant IDs, not hardcoded hex values; semantic theme inks are applied at render time. */
export const CARD_PALETTE_VARIANTS = ['teal', 'coral', 'mustard', 'turquoise'] as const
export type CardPaletteVariant = typeof CARD_PALETTE_VARIANTS[number]

export const CARD_BORDER_STYLES = ['single', 'double', 'ticket', 'offset'] as const
export type CardBorderStyle = typeof CARD_BORDER_STYLES[number]

export const CARD_STAMPS = ['house-care', 'daily-care', 'extra-care', 'fine-print', 'edition'] as const
export type CardStamp = typeof CARD_STAMPS[number]
