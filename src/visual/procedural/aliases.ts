import type { ActionFamily, EnvironmentFamily, SubjectFamily } from './taxonomy'

/** Language-independent normalized matching; no locale-sensitive ordering. */
export function normalizeVisualPhrase(value?: string): string {
  return (value ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

/** Whole words/phrases only: `oven` must not match `ovenish`. */
function hasAlias(text: string, alias: string): boolean {
  return text.length > 0 && (` ${text} `).includes(` ${normalizeVisualPhrase(alias)} `)
}

/** Each subject id must exist in the authored Phase 4 registry. */
export const EXACT_SUBJECT_ALIASES = [
  { id: 'coffee-machine', family: 'appliance', names: ['coffee machine', 'coffee maker', 'espresso maker', 'espresso machine', 'macchina del caffe', 'macchina caffe', 'macchinetta caffe', 'macchina per caffe', 'macchina espresso', 'macchina del caffè'] },
  { id: 'shower-head', family: 'fixture', names: ['shower head', 'showerhead', 'soffione', 'doccetta', 'doccia', 'shower'] },
  { id: 'spray-bottle', family: 'surface', names: ['spray bottle', 'flacone spray', 'bottiglia spray', 'spruzzino', 'nebulizzatore'] },
  { id: 'detergent-bottle', family: 'generic-object', names: ['detergent bottle', 'laundry detergent', 'flacone detersivo', 'bottiglia detersivo'] },
  { id: 'cleaner-bottle', family: 'surface', names: ['cleaner bottle', 'flacone detergente', 'bottiglia detergente', 'detersivo', 'detergente'] },
  // Phase 9 exact subject extensions. Ordered narrow-to-broad; these add
  // precision without changing the established v1 generic family fallbacks.
  { id: 'bathtub', family: 'fixture', names: ['bathtub', 'bath tub', 'vasca da bagno', 'vasca'] },
  { id: 'toilet', family: 'fixture', names: ['toilet bowl', 'toilet', 'wc', 'water closet', 'gabinetto', 'vaso sanitario'] },
  { id: 'refrigerator', family: 'appliance', names: ['refrigerator', 'fridge', 'frigorifero', 'frigo'] },
  { id: 'tablet-pack', family: 'generic-object', names: ['dishwasher tablets', 'tablet pack', 'pastiglie lavastoviglie', 'capsule lavastoviglie'] },
  { id: 'dishwasher', family: 'appliance', names: ['dishwasher', 'dish washing machine', 'lavastoviglie'] },
  { id: 'washer', family: 'appliance', names: ['washing machine', 'clothes washer', 'lavatrice'] },
  { id: 'dryer', family: 'appliance', names: ['tumble dryer', 'clothes dryer', 'asciugatrice'] },
  { id: 'kettle', family: 'appliance', names: ['electric kettle', 'kettle', 'bollitore', 'bollitore elettrico'] },
  { id: 'chair', family: 'furniture', names: ['chair', 'sedia', 'sedie'] },
  { id: 'bookcase', family: 'furniture', names: ['bookcase', 'bookshelf', 'libreria'] },
  { id: 'bed', family: 'furniture', names: ['bed', 'letto', 'lettino'] },
  { id: 'cabinet', family: 'furniture', names: ['cabinet', 'cupboard', 'sideboard', 'armadietto', 'credenza'] },
  { id: 'table', family: 'furniture', names: ['table', 'tavolo', 'tavolino'] },
  { id: 'floor-patch', family: 'floor', names: ['floor tiles', 'floor patch', 'pavimento', 'piastrelle'] },
  { id: 'mirror', family: 'glass', names: ['mirror', 'specchio', 'specchiera'] },
  { id: 'bucket', family: 'generic-object', names: ['bucket', 'secchio'] },
  { id: 'duster', family: 'generic-object', names: ['feather duster', 'duster', 'piumino'] },
  { id: 'scrub-brush', family: 'generic-object', names: ['scrub brush', 'scrubbing brush', 'spazzola per pulire', 'spazzolone'] },
  { id: 'broom', family: 'generic-object', names: ['broom', 'scopa'] },
  { id: 'squeegee', family: 'generic-object', names: ['window squeegee', 'squeegee', 'tergivetro', 'tiracqua'] },
  { id: 'generic-tool', family: 'generic-object', names: ['generic tool', 'cleaning tool', 'attrezzo per pulizia'] },
  { id: 'paper-roll', family: 'generic-object', names: ['paper roll', 'toilet paper', 'kitchen paper', 'rotolo carta', 'carta igienica'] },
  { id: 'microfiber-stack', family: 'fabric', names: ['microfiber cloths', 'microfibre cloths', 'panni in microfibra', 'panni microfibra'] },
  { id: 'generic-supply', family: 'generic-object', names: ['generic supply', 'cleaning supplies', 'materiali di pulizia'] },
  { id: 'rug', family: 'fabric', names: ['rug', 'carpet', 'tappeto', 'tappetino'] },
  { id: 'shelf-prop', family: 'storage', names: ['wall shelf', 'mensola'] },
  { id: 'framed-art', family: 'furniture', names: ['framed art', 'quadro', 'cornice', 'painting'] },
  { id: 'stovetop', family: 'appliance', names: ['stovetop', 'stove top', 'cooktop', 'cooking hob', 'piano cottura', 'fornelli', 'hob'] },
  { id: 'countertop', family: 'surface', names: ['countertop', 'kitchen counter', 'counter top', 'piano di lavoro', 'piano lavoro', 'bancone'] },
  { id: 'sink', family: 'fixture', names: ['sink', 'washbasin', 'lavello', 'lavandino', 'lavabo'] },
  { id: 'oven', family: 'appliance', names: ['oven', 'forno'] },
  { id: 'sofa', family: 'furniture', names: ['sofa', 'couch', 'divano'] },
  { id: 'window', family: 'glass', names: ['window', 'windows', 'finestra', 'finestre', 'vetrata'] },
  { id: 'vacuum', family: 'appliance', names: ['vacuum cleaner', 'aspirapolvere', 'aspiratore'] },
  { id: 'sponge', family: 'surface', names: ['sponge', 'spugna', 'spugnetta'] },
  { id: 'cloth', family: 'fabric', names: ['microfiber cloth', 'microfibre cloth', 'panno microfibra', 'panno in microfibra', 'cloth', 'panno', 'strofinaccio'] },
  { id: 'mop', family: 'surface', names: ['mop', 'mocio', 'lavapavimenti'] },
  { id: 'house', family: 'room', names: ['house', 'home', 'casa', 'abitazione'] },
  { id: 'plant', family: 'outdoor', names: ['plant', 'pianta', 'piantina'] },
  { id: 'lamp', family: 'furniture', names: ['lamp', 'lampada', 'abat jour'] },
] as const satisfies readonly { id: string; family: SubjectFamily; names: readonly string[] }[]

export type ExactSubjectMatch = { readonly primitiveId: string; readonly family: SubjectFamily }
export function matchExactSubject(value?: string): ExactSubjectMatch | undefined {
  const phrase = normalizeVisualPhrase(value)
  for (const item of EXACT_SUBJECT_ALIASES) {
    if (item.names.some((name) => hasAlias(phrase, name))) {
      return { primitiveId: item.id, family: item.family }
    }
  }
  return undefined
}

const ENTITY_FAMILY_ALIASES: readonly { family: SubjectFamily; names: readonly string[] }[] = [
  { family: 'appliance', names: ['appliance', 'electric appliance', 'machine', 'elettrodomestico', 'macchinario', 'apparecchio elettrico'] },
  { family: 'fixture', names: ['fixture', 'plumbing', 'sanitary fixture', 'sanitario', 'rubinetteria', 'impianto idraulico'] },
  { family: 'furniture', names: ['furniture', 'furnishing', 'arredo', 'arredamento', 'mobile', 'mobili'] },
  { family: 'surface', names: ['surface', 'worktop', 'superficie', 'piano di lavoro', 'rivestimento'] },
  { family: 'floor', names: ['floor', 'flooring', 'pavimento', 'pavimentazione', 'tappeto', 'carpet'] },
  { family: 'glass', names: ['glass', 'glazing', 'vetro', 'vetri', 'vetrata', 'specchio', 'mirror'] },
  { family: 'fabric', names: ['fabric', 'textile', 'tessuto', 'tessile', 'stoffa', 'tenda', 'curtain'] },
  { family: 'storage', names: ['storage', 'shelving', 'shelf', 'armadio', 'scaffale', 'ripostiglio', 'dispensa'] },
  { family: 'room', names: ['room', 'space', 'area', 'stanza', 'locale', 'ambiente'] },
  { family: 'outdoor', names: ['outdoor', 'balcony', 'garden', 'balcone', 'giardino', 'terrazzo', 'esterno'] },
  { family: 'generic-object', names: ['object', 'item', 'entity', 'oggetto', 'elemento', 'entita'] },
]
export function matchEntityFamily(value?: string): SubjectFamily | undefined {
  const phrase = normalizeVisualPhrase(value)
  return ENTITY_FAMILY_ALIASES.find((entry) => entry.names.some((name) => hasAlias(phrase, name)))?.family
}

const ACTION_ALIASES: readonly { family: ActionFamily; names: readonly string[] }[] = [
  { family: 'degrease', names: ['degrease', 'degreasing', 'sgrassare', 'sgrassatura', 'sgrassa'] },
  { family: 'descale', names: ['descale', 'descaling', 'decalcify', 'decalcificazione', 'decalcificare', 'anticalcare', 'togliere calcare'] },
  { family: 'disinfect', names: ['disinfect', 'sanitize', 'sanitise', 'disinfettare', 'igienizzare', 'sanificare'] },
  { family: 'vacuum', names: ['vacuum', 'hoover', 'aspirare', 'aspirapolvere', 'passare aspirapolvere'] },
  { family: 'mop', names: ['mop', 'mopping', 'passare mocio', 'lavare pavimento', 'lavare pavimenti'] },
  { family: 'dust', names: ['dust', 'dusting', 'spolverare', 'spolvero'] },
  { family: 'polish', names: ['polish', 'polishing', 'lucidare', 'lucidatura'] },
  { family: 'scrub', names: ['scrub', 'scrubbing', 'strofinare', 'sfregare', 'scrostare'] },
  { family: 'wipe', names: ['wipe', 'wiping', 'passare panno', 'pulire con panno', 'asciugare'] },
  { family: 'spray', names: ['spray', 'spraying', 'spruzzare', 'nebulizzare'] },
  { family: 'wash', names: ['wash', 'washing', 'lavare', 'risciacquare', 'sciacquare'] },
  { family: 'tidy', names: ['tidy', 'tidying', 'declutter', 'riordinare', 'sistemare', 'mettere in ordine'] },
  { family: 'inspect', names: ['inspect', 'inspection', 'check', 'controllare', 'ispezionare', 'verificare'] },
  { family: 'refill', names: ['refill', 'replenish', 'ricaricare', 'rabboccare', 'riempire', 'rifornire'] },
  { family: 'move', names: ['move', 'rotate', 'spostare', 'ruotare', 'girare', 'trasferire'] },
  { family: 'maintain', names: ['maintain', 'maintenance', 'service', 'manutenzione', 'manutenere', 'revisionare'] },
  { family: 'generic-care', names: ['clean', 'cleaning', 'care', 'pulire', 'pulizia', 'cura'] },
]
export function matchActionFamily(value?: string): ActionFamily {
  const phrase = normalizeVisualPhrase(value)
  return ACTION_ALIASES.find((entry) => entry.names.some((name) => hasAlias(phrase, name)))?.family ?? 'generic-care'
}

const ENVIRONMENT_ALIASES: readonly { environment: EnvironmentFamily; names: readonly string[] }[] = [
  { environment: 'kitchen', names: ['kitchen', 'cucina', 'angolo cottura'] },
  { environment: 'bathroom', names: ['bathroom', 'washroom', 'toilet', 'bagno', 'servizi igienici'] },
  { environment: 'living', names: ['living room', 'living', 'lounge', 'soggiorno', 'salotto'] },
  { environment: 'bedroom', names: ['bedroom', 'camera da letto', 'camera matrimoniale'] },
  { environment: 'dining', names: ['dining room', 'dining', 'sala da pranzo'] },
  { environment: 'hallway', names: ['hallway', 'hall', 'corridor', 'corridorio', 'corridoio', 'ingresso'] },
  { environment: 'utility', names: ['utility room', 'laundry room', 'utility', 'lavanderia', 'locale tecnico', 'ripostiglio'] },
  { environment: 'outdoor', names: ['outdoor', 'garden', 'balcony', 'terrace', 'giardino', 'balcone', 'terrazzo', 'esterno'] },
]
export function matchEnvironment(value?: string): EnvironmentFamily | undefined {
  const phrase = normalizeVisualPhrase(value)
  return ENVIRONMENT_ALIASES.find((entry) => entry.names.some((name) => hasAlias(phrase, name)))?.environment
}
