import { VECTOR_ARTBOARDS } from '../artboards'
import type { PrimitiveDefinition, PrimitiveFamily, PrimitiveRenderContext, PrimitiveRenderLayers, VectorPoint, LimbAnchors } from '../types'

/**
 * Curated, face-free SVG object silhouettes. The Phase 5 semantic resolver will
 * refer to these IDs, but this vocabulary contains no automatic selection.
 * Every item uses the same 240-unit artboard and semantic inks.
 */
export interface AuthoredObjectSpec {
  id: string
  family: PrimitiveFamily
  face?: VectorPoint
  limbs?: LimbAnchors
  actions: readonly string[]
  environments: readonly string[]
  draw: (context: PrimitiveRenderContext) => PrimitiveRenderLayers
}
const safeInset = Object.freeze({ top: 8, right: 8, bottom: 9, left: 8 })
const define = (spec: AuthoredObjectSpec): PrimitiveDefinition => ({
  metadata: {
    id: spec.id,
    family: spec.family,
    artboard: VECTOR_ARTBOARDS.mainObject,
    safeInset,
    faceAnchor: spec.face,
    limbAnchors: spec.limbs,
    supportedActionFamilies: spec.actions,
    supportedEnvironmentFamilies: spec.environments,
  },
  render: spec.draw,
})

const defaultLimb = { leftArm: { x: 52, y: 140 }, rightArm: { x: 188, y: 140 }, leftLeg: { x: 94, y: 202 }, rightLeg: { x: 147, y: 202 } }
const base = (p: PrimitiveRenderContext['palette']) => `<ellipse cx="120" cy="222" rx="82" ry="9" fill="${p.ink}" opacity=".12"/>`
const outline = (p: PrimitiveRenderContext['palette'], width = 6) => `stroke="${p.ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`
const box = (x: number, y: number, width: number, height: number, rx: number, fill: string, stroke: string) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" ${stroke}/>`
const speckle = (pattern: PrimitiveRenderContext['pattern'], x: number, y: number, width: number, height: number) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${pattern('halftoneFine')}" opacity=".64"/>`
const leg = (p: PrimitiveRenderContext['palette'], x: number, y = 203) => `<path d="M${x} ${y} v13" ${outline(p, 7)} fill="none"/>`

export const authoredObjectPrimitives: readonly PrimitiveDefinition[] = Object.freeze([
  define({id:'house',family:'object',face:{x:120,y:138},limbs:{...defaultLimb,leftArm:{x:42,y:145},rightArm:{x:196,y:145}},actions:['maintain','tidy','inspect'],environments:['generic-interior'],draw:({palette:p,pattern})=>({
    registration:'<path d="M35 91 L120 21 L205 91 V211 H35 Z"/>',
    body:`${base(p)}<path d="M37 90 L120 25 L203 90 V207 H37 Z" fill="${p.surface}" ${outline(p)}/><path d="M25 95 L120 17 L216 95" fill="none" stroke="${p.coral}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 160 H202 V207 H38 Z" fill="${pattern('halftoneFine')}"/><rect x="57" y="98" width="34" height="42" rx="4" fill="${p.turquoise}" ${outline(p,4)}/><rect x="151" y="98" width="32" height="42" rx="4" fill="${p.mustard}" ${outline(p,4)}/><path d="M105 206 V162 Q105 151 116 151 H128 Q139 151 139 162 V206" fill="${p.primarySoft}" ${outline(p,5)}/><circle cx="130" cy="180" r="3" fill="${p.ink}"/><rect x="171" y="38" width="13" height="28" rx="2" fill="${p.ink}"/>`,
  })}),
  define({id:'sink',family:'object',face:{x:119,y:157},limbs:{leftArm:{x:39,y:156},rightArm:{x:202,y:158},leftLeg:{x:91,y:205},rightLeg:{x:152,y:205}},actions:['wipe','wash','descale','scrub'],environments:['kitchen','bathroom','utility'],draw:({palette:p,pattern})=>({
    registration:'<path d="M28 123 H212 L184 209 H57 Z"/>',
    body:`${base(p)}<path d="M96 118 V66 Q96 39 122 39 Q148 39 148 65 V106" fill="none" ${outline(p,12)}/><path d="M139 105 H164" ${outline(p,9)} fill="none"/><rect x="111" y="116" width="16" height="11" rx="3" fill="${p.mustard}"/><path d="M26 129 H214 L192 205 Q187 214 178 214 H63 Q54 214 49 205 Z" fill="${p.surface}" ${outline(p)}/><path d="M49 137 H191 L177 192 H66 Z" fill="${p.primarySoft}" stroke="${p.ink}" stroke-width="4"/><path d="M51 189 H190 V206 H56 Z" fill="${pattern('halftoneMedium')}"/><path d="M18 127 H222" ${outline(p,9)} fill="none"/><circle cx="84" cy="101" r="9" fill="${p.coral}" ${outline(p,3)}/><circle cx="176" cy="101" r="9" fill="${p.turquoise}" ${outline(p,3)}/>`,
  })}),
  define({id:'shower-head',family:'object',face:{x:117,y:90},limbs:{leftArm:{x:44,y:133},rightArm:{x:187,y:129}},actions:['wash','descale','scrub'],environments:['bathroom'],draw:({palette:p})=>({
    body:`${base(p)}<path d="M174 204 V63 Q174 32 139 32 H117 Q91 32 91 62" fill="none" ${outline(p,13)}/><path d="M58 100 Q75 56 119 58 Q165 62 178 106 Q120 126 58 100 Z" fill="${p.turquoise}" ${outline(p)}/><path d="M64 100 Q119 117 173 106" fill="none" ${outline(p,5)}/><path d="M77 118 l-10 17 M101 123 l-8 18 M126 124 l0 21 M150 118 l7 18" fill="none" stroke="${p.primary}" stroke-width="7" stroke-linecap="round"/><path d="M65 165 l-8 15 M95 170 v17 M124 171 v14 M159 165 l7 16" fill="none" stroke="${p.turquoise}" stroke-width="5" stroke-linecap="round"/><rect x="162" y="194" width="26" height="20" rx="6" fill="${p.mustard}" ${outline(p,4)}/>`,
  })}),
  define({id:'oven',family:'object',face:{x:120,y:148},limbs:defaultLimb,actions:['degrease','wipe','scrub','inspect'],environments:['kitchen'],draw:({palette:p,pattern})=>({
    registration:'<rect x="48" y="51" width="144" height="156" rx="12"/>',
    body:`${base(p)}${box(45,51,150,156,12,p.surface,outline(p))}${box(52,57,136,35,5,p.primarySoft,outline(p,4))}${[75,105,135,165].map(x=>`<circle cx="${x}" cy="75" r="7" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3"/>`).join('')}${box(56,105,128,83,7,p.ink,`stroke="${p.ink}" stroke-width="4"`)}${box(66,116,108,60,4,p.turquoise,'stroke="none"')}<rect x="66" y="151" width="108" height="25" fill="${pattern('halftoneMedium')}"/><path d="M66 113 H174" stroke="${p.surface}" stroke-width="7" stroke-linecap="round"/>${leg(p,72,207)}${leg(p,168,207)}<rect x="69" y="191" width="102" height="9" rx="3" fill="${p.coral}"/>`,
  })}),
  define({id:'stovetop',family:'object',face:{x:121,y:155},limbs:{leftArm:{x:37,y:147},rightArm:{x:203,y:147}},actions:['degrease','wipe','scrub'],environments:['kitchen'],draw:({palette:p})=>({
    body:`${base(p)}<path d="M22 117 L56 66 H184 L220 117 L198 192 H41 Z" fill="${p.surface}" ${outline(p)}/><path d="M56 74 H184 L202 117 H39 Z" fill="${p.primarySoft}" ${outline(p,4)}/>${[[86,95],[153,95]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="25" ry="12" fill="${p.ink}"/><ellipse cx="${x}" cy="${y}" rx="14" ry="6" fill="${p.turquoise}"/>`).join('')}<rect x="42" y="127" width="154" height="58" rx="7" fill="${p.coral}" opacity=".65"/>${[78,119,160].map(x=>`<circle cx="${x}" cy="173" r="6" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3"/>`).join('')}<path d="M83 54 Q72 38 85 26 M120 52 Q109 35 119 22 M157 54 Q169 39 156 22" fill="none" stroke="${p.coral}" stroke-width="5" stroke-linecap="round"/>`,
  })}),
  define({id:'coffee-machine',family:'object',face:{x:118,y:139},limbs:defaultLimb,actions:['descale','wipe','wash','maintain'],environments:['kitchen'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(46,39,145,169,18,p.turquoise,outline(p))}${box(58,52,118,26,6,p.ink,`stroke="${p.ink}" stroke-width="4"`)}<circle cx="77" cy="64" r="5" fill="${p.mustard}"/><circle cx="98" cy="64" r="5" fill="${p.coral}"/>${box(72,86,94,94,8,p.surface,outline(p,4))}<path d="M72 105 H166" stroke="${p.ink}" stroke-width="7"/><path d="M91 182 H148 L157 202 H82 Z" fill="${p.ink}"/>${box(87,180,58,15,3,p.mustard,outline(p,3))}<path d="M176 90 H211 V126 Q211 136 198 136 H174" fill="none" ${outline(p,8)}/><path d="M65 155 H174 V177 H65 Z" fill="${pattern('halftoneFine')}"/>`,
  })}),
  define({id:'sofa',family:'object',face:{x:120,y:149},limbs:{leftArm:{x:42,y:146},rightArm:{x:198,y:146}},actions:['vacuum','dust','tidy','wash'],environments:['living','bedroom'],draw:({palette:p,pattern})=>({
    registration:'<rect x="27" y="101" width="186" height="98" rx="21"/>',
    body:`${base(p)}${box(38,74,164,82,24,p.coral,outline(p))}${box(23,120,194,82,22,p.coral,outline(p))}${box(36,127,168,50,11,p.mustard,outline(p,4))}${box(46,123,72,48,8,p.primarySoft,outline(p,3))}${box(121,123,73,48,8,p.surface,outline(p,3))}<rect x="44" y="163" width="151" height="34" rx="8" fill="${pattern('halftoneFine')}"/><path d="M55 207 V219 M188 207 V219" fill="none" ${outline(p,9)}/><path d="M24 144 V185 M215 144 V185" fill="none" ${outline(p,8)}/>`,
  })}),
  define({id:'countertop',family:'object',face:{x:120,y:154},limbs:defaultLimb,actions:['wipe','degrease','disinfect','polish'],environments:['kitchen','bathroom','utility'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(23,97,194,19,6,p.mustard,outline(p,4))}${box(34,116,171,93,3,p.primarySoft,outline(p,5))}<path d="M119 120 V205 M37 175 H203" ${outline(p,4)} fill="none"/><rect x="40" y="179" width="75" height="27" fill="${pattern('halftoneFine')}"/><rect x="120" y="179" width="79" height="27" fill="${pattern('halftoneFine')}"/><path d="M107 135 V155 M132 135 V155" ${outline(p,5)}/><rect x="60" y="62" width="29" height="34" rx="5" fill="${p.coral}" ${outline(p,3)}/><path d="M67 64 Q62 51 71 45 M81 63 Q88 54 83 45" fill="none" stroke="${p.primary}" stroke-width="5"/><rect x="144" y="65" width="38" height="26" rx="4" fill="${p.surface}" ${outline(p,3)}/>`,
  })}),
  define({id:'window',family:'environment',face:undefined,actions:['wipe','wash','polish'],environments:['living','bedroom','kitchen','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(38,20,164,187,5,p.surface,outline(p,8))}${box(51,32,138,160,2,p.turquoise,outline(p,4))}<path d="M120 34 V191 M52 115 H189" ${outline(p,7)} fill="none"/><path d="M58 100 L104 50 M128 175 L172 131" stroke="${p.surface}" stroke-width="10" stroke-linecap="round"/><path d="M53 175 H187 V190 H53 Z" fill="${pattern('halftoneFine')}"/><path d="M26 207 H215" ${outline(p,11)} fill="none"/>`,
  })}),
  define({id:'spray-bottle',family:'tool',face:{x:119,y:147},limbs:{...defaultLimb,leftArm:{x:57,y:143},rightArm:{x:185,y:141}},actions:['spray','wipe','disinfect','degrease'],environments:['generic-interior','kitchen','bathroom','living'],draw:({palette:p,pattern})=>({
    registration:'<path d="M75 99 Q75 78 97 78 H142 Q165 78 165 99 L191 181 Q196 210 166 213 H72 Q44 210 50 183 Z"/>',
    body:`${base(p)}<path d="M88 38 H167 V57 H136 L128 78 H93 Z" fill="${p.surface}" ${outline(p,6)}/><path d="M79 56 H63 V47 H92" fill="none" ${outline(p,7)}/><path d="M91 63 H150 V87 H91 Z" fill="${p.primary}"/><path d="M76 97 Q76 79 95 79 H148 Q167 79 167 97 L190 181 Q199 211 166 215 H71 Q42 211 51 183 Z" fill="${p.turquoise}" ${outline(p,7)}/><path d="M60 171 H183 V206 H60 Z" fill="${pattern('halftoneMedium')}" opacity=".52"/>${box(82,127,74,72,12,p.surface,outline(p,4))}<path d="M75 101 Q121 85 164 105" fill="none" stroke="${p.mustard}" stroke-width="7" stroke-linecap="round"/>`,
  })}),
  define({id:'sponge',family:'tool',face:{x:120,y:146},limbs:{leftArm:{x:44,y:147},rightArm:{x:198,y:147}},actions:['scrub','wipe','degrease','wash'],environments:['kitchen','bathroom'],draw:({palette:p,pattern})=>({
    registration:'<rect x="37" y="83" width="165" height="126" rx="22"/>',
    body:`${base(p)}${box(32,80,176,129,19,p.mustard,outline(p,7))}<path d="M37 169 H203 V199 Q202 208 192 208 H49 Q38 208 37 197 Z" fill="${p.turquoise}"/><path d="M38 117 H202 V147 H38 Z" fill="${pattern('halftoneCoarse')}" opacity=".6"/>${[[71,105],[109,96],[157,106],[181,138],[61,165],[160,179]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="${p.ink}" opacity=".35"/>`).join('')}`,
  })}),
  define({id:'cloth',family:'tool',face:{x:120,y:150},limbs:{leftArm:{x:38,y:153},rightArm:{x:202,y:154}},actions:['wipe','dust','polish','wash'],environments:['generic-interior','kitchen','bathroom'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M32 79 Q72 69 108 75 Q149 82 205 69 L210 185 Q184 198 157 194 Q128 188 104 206 Q70 218 36 196 Z" fill="${p.turquoise}" ${outline(p,7)}/><path d="M83 76 L97 192 Q123 178 151 185 L142 81" fill="${p.primarySoft}" ${outline(p,4)}/><path d="M47 131 H191 V179 H47 Z" fill="${pattern('halftoneFine')}" opacity=".6"/><path d="M53 93 L67 190 M164 86 L178 185" stroke="${p.surface}" stroke-width="5" stroke-dasharray="4 8"/>`,
  })}),
  define({id:'mop',family:'tool',face:{x:116,y:162},limbs:{leftArm:{x:73,y:142},rightArm:{x:160,y:143}},actions:['mop','wash'],environments:['kitchen','bathroom','hallway','living'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M116 26 L128 149" fill="none" ${outline(p,14)}/><path d="M115 26 L126 139" fill="none" stroke="${p.primary}" stroke-width="7" stroke-linecap="round"/><path d="M85 144 Q115 128 151 143 L161 166 H75 Z" fill="${p.mustard}" ${outline(p,5)}/><path d="M78 163 Q65 192 53 207 Q65 219 76 207 Q87 224 99 211 Q113 229 127 213 Q143 226 158 206 Q172 216 186 201 L156 164 Z" fill="${p.surface}" ${outline(p,5)}/><path d="M92 169 L80 207 M119 171 V214 M147 167 L159 207" fill="none" stroke="${p.turquoise}" stroke-width="6"/><ellipse cx="121" cy="219" rx="91" ry="7" fill="${pattern('halftoneFine')}"/>`,
  })}),
  define({id:'vacuum',family:'tool',face:{x:123,y:148},limbs:{leftArm:{x:69,y:134},rightArm:{x:181,y:135}},actions:['vacuum','tidy'],environments:['living','bedroom','hallway','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M90 92 Q76 54 46 55 Q30 57 30 81 V127 L43 150" fill="none" ${outline(p,12)}/><path d="M30 147 L63 163 L51 177 L20 169 Z" fill="${p.primary}" ${outline(p,5)}/><path d="M58 185 H24" ${outline(p,10)} fill="none"/><path d="M76 99 Q78 71 112 70 H145 Q177 70 179 106 L188 176 Q187 196 166 199 H90 Q70 199 66 179 Z" fill="${p.coral}" ${outline(p,7)}/><path d="M78 161 H180 V193 H78 Z" fill="${pattern('halftoneMedium')}" opacity=".5"/>${box(96,87,65,27,9,p.surface,outline(p,4))}<circle cx="90" cy="197" r="14" fill="${p.ink}"/><circle cx="169" cy="197" r="14" fill="${p.ink}"/><circle cx="90" cy="197" r="5" fill="${p.surface}"/><circle cx="169" cy="197" r="5" fill="${p.surface}"/>`,
  })}),
  define({id:'cleaner-bottle',family:'supply',face:{x:119,y:151},limbs:{leftArm:{x:61,y:140},rightArm:{x:179,y:139}},actions:['spray','wash','scrub','refill','disinfect'],environments:['generic-interior','utility','kitchen','bathroom'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(101,25,39,39,8,p.ink,outline(p,4))}${box(109,36,23,17,2,p.coral,'stroke="none"')}<path d="M87 63 H154 V90 Q178 105 178 127 V196 Q176 213 160 213 H82 Q63 213 63 196 V127 Q63 103 87 90 Z" fill="${p.primary}" ${outline(p,7)}/>${box(77,112,87,79,9,p.surface,outline(p,4))}<path d="M80 161 H162 V186 H80 Z" fill="${pattern('halftoneFine')}"/><path d="M99 91 H144" stroke="${p.mustard}" stroke-width="9" stroke-linecap="round"/>`,
  })}),
  define({id:'plant',family:'environment',face:{x:120,y:183},limbs:undefined,actions:['dust','water','maintain'],environments:['living','bedroom','kitchen','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M120 148 Q91 110 72 64 M120 151 Q133 95 171 56 M120 152 Q117 93 118 24" fill="none" stroke="${p.ink}" stroke-width="6" stroke-linecap="round"/><path d="M73 80 Q31 76 42 33 Q83 37 91 96 Z" fill="${p.primary}" ${outline(p,5)}/><path d="M161 90 Q160 39 202 40 Q214 78 166 101 Z" fill="${p.turquoise}" ${outline(p,5)}/><path d="M103 71 Q84 26 112 17 Q145 46 124 84 Z" fill="${p.primarySoft}" ${outline(p,5)}/><path d="M123 129 Q157 105 190 118 Q170 155 125 152 Z" fill="${p.mustard}" ${outline(p,4)}/><path d="M115 132 Q78 114 48 137 Q78 168 118 150 Z" fill="${p.turquoise}" ${outline(p,4)}/><path d="M82 157 H159 L147 211 H92 Z" fill="${p.coral}" ${outline(p,6)}/><path d="M95 192 H148 V211 H93 Z" fill="${pattern('halftoneFine')}"/><path d="M83 158 H159" ${outline(p,7)} fill="none"/>`,
  })}),
  define({id:'lamp',family:'environment',face:undefined,actions:['dust','inspect'],environments:['living','bedroom','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M96 69 H148 L176 127 H67 Z" fill="${p.mustard}" ${outline(p,6)}/><path d="M88 105 H157 L167 126 H78 Z" fill="${pattern('halftoneMedium')}" opacity=".5"/><path d="M122 128 V208" ${outline(p,9)} fill="none"/><path d="M86 208 H156" ${outline(p,11)} fill="none"/><circle cx="123" cy="136" r="7" fill="${p.surface}"/><path d="M80 65 Q115 45 150 65" stroke="${p.coral}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  })}),
  define({id:'framed-art',family:'environment',face:undefined,actions:['dust','wipe'],environments:['living','bedroom','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(46,33,149,167,2,p.ink,outline(p,4))}${box(58,46,125,141,0,p.paper,`stroke="${p.surface}" stroke-width="5"`)}<path d="M58 150 V47 H183 V111 Q143 121 123 166 Z" fill="${p.mustard}"/><path d="M58 149 L126 84 L183 153 V187 H58 Z" fill="${p.coral}"/><circle cx="153" cy="77" r="25" fill="${p.turquoise}"/><path d="M91 60 L97 73 L111 77 L97 82 L91 97 L85 82 L72 77 L85 72 Z" fill="${p.surface}"/>${speckle(pattern,61,163,118,23)}`,
  })}),
  define({id:'generic-appliance',family:'object',face:{x:120,y:146},limbs:defaultLimb,actions:['wipe','maintain','wash','inspect'],environments:['kitchen','utility','generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}${box(46,52,148,151,18,p.primarySoft,outline(p,7))}${box(57,62,126,35,5,p.surface,outline(p,4))}<circle cx="164" cy="80" r="7" fill="${p.coral}"/>${box(63,111,114,77,10,p.turquoise,outline(p,5))}<path d="M68 158 H171 V183 H68 Z" fill="${pattern('halftoneMedium')}" opacity=".55"/><path d="M68 196 V210 M171 196 V210" ${outline(p,8)} fill="none"/><path d="M86 74 H129" stroke="${p.primary}" stroke-width="7" stroke-linecap="round"/>`,
  })}),
  define({id:'generic-surface',family:'object',face:{x:120,y:145},limbs:{leftArm:{x:39,y:146},rightArm:{x:201,y:146}},actions:['wipe','polish','scrub','tidy','inspect'],environments:['generic-interior'],draw:({palette:p,pattern})=>({
    body:`${base(p)}<path d="M25 110 L71 76 H176 L214 110 V125 H25 Z" fill="${p.mustard}" ${outline(p,6)}/>${box(35,124,171,61,7,p.primarySoft,outline(p,5))}<rect x="40" y="163" width="161" height="21" fill="${pattern('halftoneFine')}"/><path d="M53 186 L43 217 M187 186 L197 217" ${outline(p,9)} fill="none"/><path d="M49 138 H190" stroke="${p.surface}" stroke-width="4" stroke-dasharray="12 8"/>`,
  })}),
])

export const AUTHORED_OBJECT_IDS: readonly string[] = Object.freeze(authoredObjectPrimitives.map((definition) => definition.metadata.id))
