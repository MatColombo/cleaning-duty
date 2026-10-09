import { VECTOR_ARTBOARDS } from '../artboards'
import type { LimbAnchors, PrimitiveDefinition, PrimitiveFamily, PrimitiveRenderContext, PrimitiveRenderLayers, VectorPoint } from '../types'

/**
 * Phase 9 additions: authored, face-free silhouettes for common household
 * subjects, tools and scene props. These are intentionally simple enough to
 * stay recognizable at 48 px. No task data, card generator, or hardcoded inks.
 *
 * Do not reorder/alter Phase 4 definitions; generator-v1 historical recipes
 * must continue to render the same way.
 */
type Ink = PrimitiveRenderContext['palette']
type Action = readonly string[]
type Env = readonly string[]
interface Spec {
  id: string
  family: PrimitiveFamily
  face?: VectorPoint
  limbs?: LimbAnchors
  actions: Action
  environments: Env
  draw: (ctx: PrimitiveRenderContext) => PrimitiveRenderLayers
}
const safeInset = Object.freeze({ top: 8, right: 8, bottom: 8, left: 8 })
const anchor: LimbAnchors = { leftArm: { x: 51, y: 142 }, rightArm: { x: 189, y: 142 }, leftLeg: { x: 95, y: 205 }, rightLeg: { x: 145, y: 205 } }
const define = (s: Spec): PrimitiveDefinition => ({
  metadata: { id: s.id, family: s.family, artboard: VECTOR_ARTBOARDS.mainObject, safeInset,
    faceAnchor: s.face, limbAnchors: s.limbs,
    supportedActionFamilies: s.actions, supportedEnvironmentFamilies: s.environments },
  render: s.draw,
})
const stroke = (p: Ink, w = 6) => `stroke="${p.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
const rect = (x: number, y: number, w: number, h: number, r: number, ink: string, p: Ink, sw = 6) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${ink}" ${stroke(p,sw)}/>`
const line = (d: string, p: Ink, w = 5, ink = p.ink) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
const base = (p: Ink) => `<ellipse cx="120" cy="222" rx="83" ry="6" fill="${p.ink}" opacity=".13"/>`
const halftone = (key: Parameters<PrimitiveRenderContext['pattern']>[0], ctx: PrimitiveRenderContext) => ctx.pattern(key)
const kitchen: Env = ['kitchen','utility']
const bath: Env = ['bathroom','utility']
const living: Env = ['living','bedroom','dining','generic-interior']
const clean: Action = ['wipe','scrub','wash','dust','maintain']
const clothes: Action = ['wash','tidy','maintain']
const wash: Action = ['wash','wipe','disinfect','maintain']

export const expandedObjectPrimitives: readonly PrimitiveDefinition[] = Object.freeze([
  // Appliances & fixtures — the existing generic-appliance already covers the generic case.
  define({ id:'bathtub', family:'object', face:{x:124,y:151}, limbs:{...anchor,leftArm:{x:30,y:157},rightArm:{x:207,y:157}}, actions:wash, environments:bath,
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M55 104 V58 Q55 39 74 39 Q93 39 93 56 V77',p,10)}${line('M78 77 H107',p,7)}${rect(24,112,193,91,29,p.surface,p)}${rect(37,111,167,25,10,p.turquoise,p,4)}<path d="M45 168 H200 V182 Q185 202 57 195 Z" fill="${pattern('halftoneFine')}" opacity=".6"/>${line('M47 199 L39 214 M191 199 L200 214',p,7)}<circle cx="75" cy="91" r="11" fill="${p.mustard}" opacity=".65"/><circle cx="117" cy="76" r="7" fill="${p.turquoise}" opacity=".7"/>`})}),
  define({ id:'toilet', family:'object', face:{x:122,y:159}, limbs:{...anchor,leftArm:{x:58,y:152},rightArm:{x:186,y:152}}, actions:wash, environments:bath,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(62,27,115,77,13,p.turquoise,p)}${rect(76,42,86,47,7,p.surface,p,4)}<circle cx="149" cy="47" r="5" fill="${p.mustard}"/>${rect(53,107,133,24,12,p.surface,p,5)}<path d="M66 124 H176 Q187 173 155 194 L154 209 H84 V194 Q54 179 66 124 Z" fill="${p.surface}" ${stroke(p,7)}/><path d="M78 133 H164 V164 Q118 184 82 161 Z" fill="${pattern('halftoneMedium')}" opacity=".4"/>${rect(71,199,102,15,4,p.primarySoft,p,4)}`})}),
  define({ id:'refrigerator',family:'object',face:{x:124,y:153},limbs:anchor,actions:clean,environments:kitchen,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(57,23,128,191,13,p.surface,p,7)}<path d="M60 111 H183" ${stroke(p,5)} fill="none"/>${rect(65,29,112,77,5,p.turquoise,p,3)}<path d="M75 38 H171 V100 H75 Z" fill="${pattern('halftoneFine')}" opacity=".33"/>${line('M76 83 V102 M77 137 V160',p,8)}<path d="M83 211 v9 M162 211 v9" ${stroke(p,7)}/>`})}),
  define({ id:'dishwasher',family:'object',face:{x:122,y:157},limbs:anchor,actions:['wash','refill','maintain','wipe'],environments:kitchen,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(45,48,151,160,11,p.surface,p,7)}${rect(54,56,133,39,6,p.primarySoft,p,4)}${[77,104,132].map(x=>`<circle cx="${x}" cy="76" r="5" fill="${p.mustard}" stroke="${p.ink}" stroke-width="2"/>`).join('')}${rect(60,104,121,90,6,p.turquoise,p,5)}${line('M91 117 H149',p,7)}<path d="M67 171 H175 V187 H67 Z" fill="${pattern('halftoneFine')}" opacity=".6"/>${line('M67 207 V216 M172 207 V216',p,7)}`})}),
  define({ id:'washer',family:'object',face:{x:120,y:150},limbs:anchor,actions:clothes,environments: ['utility','bathroom'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(47,41,146,170,14,p.surface,p,7)}${rect(55,48,130,35,6,p.primarySoft,p,4)}<circle cx="164" cy="67" r="8" fill="${p.mustard}" ${stroke(p,3)}/><circle cx="119" cy="147" r="54" fill="${p.turquoise}" ${stroke(p,7)}/><circle cx="119" cy="147" r="43" fill="${pattern('halftoneMedium')}" stroke="${p.ink}" stroke-width="3" opacity=".6"/><path d="M91 132 Q114 113 150 134 M86 170 Q120 185 153 163" fill="none" stroke="${p.surface}" stroke-width="8" opacity=".85"/>${line('M64 210 V216 M171 210 V216',p,7)}`})}),
  define({ id:'dryer',family:'object',face:{x:120,y:148},limbs:anchor,actions:clothes,environments:['utility','bathroom'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(46,41,148,170,13,p.surface,p,7)}${rect(55,50,131,34,5,p.mustard,p,4)}<circle cx="164" cy="67" r="7" fill="${p.coral}" ${stroke(p,3)}/><circle cx="120" cy="145" r="54" fill="${p.primarySoft}" ${stroke(p,7)}/><circle cx="120" cy="145" r="39" fill="${pattern('halftoneFine')}" opacity=".6"/><path d="M92 144 Q102 119 127 128 Q143 134 148 158 Q128 172 101 159" fill="${p.turquoise}" stroke="${p.ink}" stroke-width="4"/><path d="M83 67 H121" ${stroke(p,5)}/>${line('M63 210 V217 M171 210 V217',p,7)}`})}),
  define({ id:'kettle',family:'object',face:{x:115,y:155},limbs:{...anchor,leftArm:{x:74,y:144},rightArm:{x:168,y:145}},actions:['descale','wash','refill','maintain'],environments:kitchen,
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M92 80 Q70 35 111 31 Q155 29 154 84',p,12)}<path d="M85 85 H153 Q173 97 177 151 L164 207 H70 L59 152 Q59 105 85 85 Z" fill="${p.turquoise}" ${stroke(p,7)}/><path d="M60 113 L34 95 L33 83 L66 94" fill="${p.mustard}" ${stroke(p,5)}/><path d="M169 110 Q215 107 210 155 Q205 184 172 171" ${stroke(p,10)} fill="none"/><path d="M72 183 H164 V202 H72 Z" fill="${pattern('halftoneFine')}" opacity=".7"/>${rect(88,74,66,13,5,p.surface,p,4)}`})}),

  // Furniture, surfaces & fixtures — generic-surface remains the authored fallback.
  define({ id:'chair',family:'object',face:{x:124,y:137},limbs:{leftArm:{x:57,y:131},rightArm:{x:180,y:131}},actions:['dust','wipe','polish','tidy'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(66,29,112,113,18,p.coral,p,7)}${rect(49,135,144,33,11,p.mustard,p)}<rect x="70" y="58" width="105" height="49" rx="7" fill="${pattern('halftoneFine')}" opacity=".42"/>${line('M70 166 L59 215 M174 166 L184 215',p,10)}${line('M47 132 V151 M194 132 V151',p,10)}`})}),
  define({ id:'table',family:'object',face:{x:118,y:139},limbs:{leftArm:{x:36,y:135},rightArm:{x:201,y:135}},actions:['wipe','dust','polish','tidy'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M32 120 L66 89 H176 L208 120 V139 H32 Z" fill="${p.mustard}" ${stroke(p,7)}/><path d="M52 143 V212 M186 143 V212" ${stroke(p,12)} fill="none"/><path d="M53 179 H187" ${stroke(p,6)} fill="none"/><path d="M51 120 H193 V134 H51 Z" fill="${pattern('halftoneFine')}" opacity=".45"/>${rect(106,62,30,27,5,p.turquoise,p,4)}${line('M117 62 Q102 50 107 42 M123 61 Q139 51 137 42',p,4,p.primary)}`})}),
  define({ id:'bookcase',family:'object',face:{x:121,y:169},limbs:{leftArm:{x:44,y:153},rightArm:{x:196,y:153}},actions:['dust','tidy','wipe','inspect'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(42,20,155,195,7,p.surface,p,7)}${line('M51 91 H189 M51 150 H189',p,8)}${[57,85,111,143].map((x,i)=>`<rect x="${x}" y="${i%2?43:38}" width="${i===3?28:24}" height="${i%2?47:52}" rx="2" fill="${[p.coral,p.primary,p.turquoise,p.mustard][i]}" ${stroke(p,3)}/>`).join('')}<path d="M59 146 V114 H88 V146 Z M97 145 L107 107 L124 143" fill="${p.mustard}" ${stroke(p,3)}/><path d="M145 146 V108 H175 V146 Z" fill="${pattern('halftoneMedium')}" ${stroke(p,3)}/><path d="M53 198 H185" ${stroke(p,6)} fill="none"/>`})}),
  define({ id:'bed',family:'object',face:{x:121,y:162},limbs:{leftArm:{x:37,y:142},rightArm:{x:203,y:142}},actions:['tidy','wash','move','vacuum'],environments:['bedroom'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(31,83,179,130,15,p.coral,p,7)}${rect(43,95,153,105,10,p.surface,p,4)}${rect(51,102,57,41,12,p.primarySoft,p,4)}${rect(132,102,57,41,12,p.primarySoft,p,4)}<path d="M44 156 H196 V191 H44 Z" fill="${p.turquoise}" ${stroke(p,4)}/><path d="M48 182 H190 V195 H48 Z" fill="${pattern('halftoneFine')}" opacity=".5"/>${line('M47 213 V221 M194 213 V221',p,8)}`})}),
  define({ id:'cabinet',family:'object',face:{x:120,y:152},limbs:anchor,actions:['wipe','dust','tidy','polish'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(34,68,173,140,12,p.primarySoft,p,7)}${rect(47,81,72,112,4,p.surface,p,3)}${rect(123,81,71,112,4,p.surface,p,3)}${line('M119 79 V200',p,5)}<circle cx="108" cy="142" r="5" fill="${p.mustard}"/><circle cx="136" cy="142" r="5" fill="${p.mustard}"/><path d="M48 184 H193 V200 H48 Z" fill="${pattern('halftoneMedium')}" opacity=".45"/>${line('M57 210 V219 M185 210 V219',p,7)}${rect(45,55,151,11,4,p.mustard,p,4)}`})}),
  define({ id:'floor-patch',family:'environment',face:undefined,actions:['mop','vacuum','wipe','wash','scrub'],environments:['kitchen','bathroom','hallway','living','generic-interior'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M20 152 L89 93 L213 126 L148 203 Z" fill="${p.primarySoft}" ${stroke(p,6)}/><path d="M89 93 L148 203 M153 110 L84 173 M190 120 L121 191" fill="none" ${stroke(p,4)} opacity=".45"/><path d="M30 148 L148 194 L206 129" fill="none" stroke="${p.surface}" stroke-width="6"/><path d="M84 145 L177 157 L163 186 L70 172 Z" fill="${pattern('halftoneFine')}" opacity=".6"/>`})}),
  define({ id:'mirror',family:'environment',face:{x:119,y:137},limbs:undefined,actions:['wipe','polish','wash'],environments:['bathroom','bedroom','hallway'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(57,24,126,186,26,p.mustard,p,7)}${rect(70,37,100,159,18,p.turquoise,p,4)}<path d="M83 109 L133 51 M84 161 L152 83" stroke="${p.surface}" stroke-width="10" stroke-linecap="round" fill="none" opacity=".65"/><path d="M74 175 H166 V190 H74 Z" fill="${pattern('halftoneFine')}" opacity=".35"/>`})}),

  // Cleaning tools and an intentional generic tool fallback.
  define({ id:'bucket',family:'tool',face:{x:120,y:150},limbs:{leftArm:{x:60,y:145},rightArm:{x:178,y:145}},actions:['mop','wash','scrub','refill'],environments:['bathroom','kitchen','utility','generic-interior'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M66 105 Q58 42 120 40 Q180 40 174 105',p,9)}<path d="M48 92 H193 L179 207 H63 Z" fill="${p.turquoise}" ${stroke(p,7)}/>${rect(42,82,157,22,9,p.surface,p,6)}<path d="M64 182 H176 V201 H64 Z" fill="${pattern('halftoneMedium')}" opacity=".6"/><path d="M80 113 H159" ${stroke(p,6)} fill="none" opacity=".35"/>`})}),
  define({ id:'duster',family:'tool',face:{x:114,y:105},limbs:{leftArm:{x:61,y:101},rightArm:{x:176,y:104}},actions:['dust','wipe','tidy'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M129 119 L170 216',p,14,p.primary)}<path d="M114 134 Q54 138 42 104 Q18 66 53 50 Q47 18 86 32 Q109 11 133 37 Q176 24 184 60 Q221 76 186 115 Q170 142 114 134 Z" fill="${p.mustard}" ${stroke(p,7)}/><path d="M69 70 L109 93 L94 44 M125 47 L126 105 M166 75 L138 103" fill="none" ${stroke(p,4)} opacity=".45"/><path d="M140 172 L164 227" ${stroke(p,8)} fill="none"/>`})}),
  define({ id:'scrub-brush',family:'tool',face:{x:120,y:120},limbs:{leftArm:{x:53,y:117},rightArm:{x:188,y:118}},actions:['scrub','degrease','wash'],environments:['bathroom','kitchen','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(47,91,148,82,26,p.primary,p,7)}${rect(78,43,85,52,18,p.mustard,p,7)}${line('M87 45 V35 H153 V45',p,5)}<path d="M53 166 H190 V194 H53 Z" fill="${p.surface}" ${stroke(p,4)}/>${[59,80,101,122,143,164,185].map(x=>line(`M${x} 192 l${x%2?4:-4} 20`,p,6,p.turquoise)).join('')}<path d="M62 143 H180 V163 H62 Z" fill="${pattern('halftoneFine')}" opacity=".5"/>`})}),
  define({ id:'broom',family:'tool',face:{x:116,y:170},limbs:{leftArm:{x:83,y:144},rightArm:{x:160,y:144}},actions:['tidy','dust','maintain'],environments:['hallway','living','outdoor','generic-interior'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M117 20 L119 153',p,13,p.primary)}${rect(85,147,70,27,8,p.mustard,p,5)}<path d="M81 171 H157 L179 210 Q120 226 59 210 Z" fill="${p.coral}" ${stroke(p,5)}/>${[80,99,120,142,164].map(x=>line(`M119 174 L${x} 212`,p,3)).join('')}<path d="M79 199 H163" ${stroke(p,5)} fill="none" opacity=".4"/>`})}),
  define({ id:'squeegee',family:'tool',face:{x:121,y:123},limbs:{leftArm:{x:71,y:112},rightArm:{x:167,y:112}},actions:['wipe','polish','wash'],environments:['bathroom','kitchen','generic-interior'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M119 94 L126 214',p,16,p.primary)}<path d="M117 97 L100 79 L137 79 L139 100" fill="${p.mustard}" ${stroke(p,5)}/>${rect(22,52,195,30,9,p.turquoise,p,7)}<path d="M27 82 H212" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/><path d="M43 60 H195" stroke="${p.surface}" stroke-width="5" stroke-linecap="round"/>`})}),
  define({ id:'generic-tool',family:'tool',face:{x:122,y:143},limbs:anchor,actions:['maintain','inspect','wipe','move'],environments:['generic-interior','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M56 164 L146 74 Q144 47 164 32 L175 60 L197 71 Q191 94 167 97 L89 194 Z" fill="${p.mustard}" ${stroke(p,7)}/><path d="M37 196 L70 156 L93 178 L63 215 Z" fill="${p.primary}" ${stroke(p,6)}/><path d="M118 89 L170 137" ${stroke(p,12)} fill="none"/><path d="M166 134 L197 102 Q215 101 213 123 L189 159 Z" fill="${p.turquoise}" ${stroke(p,6)}/><circle cx="187" cy="126" r="6" fill="${p.surface}"/>`})}),

  // Supply and environment props for future scenes.
  define({ id:'detergent-bottle',family:'supply',face:{x:119,y:151},limbs:anchor,actions:['wash','refill','disinfect','scrub'],environments:['kitchen','bathroom','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(91,27,64,47,10,p.mustard,p,5)}${rect(102,15,42,18,5,p.ink,p,3)}<path d="M88 72 H159 L185 112 L183 204 Q180 217 162 217 H74 Q57 217 57 203 V112 Z" fill="${p.coral}" ${stroke(p,7)}/>${rect(79,113,81,81,9,p.surface,p,4)}<path d="M84 173 H154 V186 H84 Z" fill="${pattern('halftoneFine')}" opacity=".6"/>${line('M108 85 H143',p,6)}`})}),
  define({ id:'tablet-pack',family:'supply',face:{x:119,y:154},limbs:anchor,actions:['wash','refill','maintain'],environments:['kitchen','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(39,58,162,148,12,p.primarySoft,p,7)}${rect(49,65,142,39,5,p.turquoise,p,3)}${rect(61,115,118,75,11,p.surface,p,4)}${[86,118,151].map((x,i)=>`<rect x="${x-11}" y="${i%2?141:129}" width="22" height="34" rx="6" fill="${i%2?p.coral:p.mustard}" ${stroke(p,3)}/>`).join('')}<path d="M46 195 H194 V205 H46 Z" fill="${pattern('halftoneFine')}" opacity=".5"/>`})}),
  define({ id:'paper-roll',family:'supply',face:{x:121,y:151},limbs:{leftArm:{x:56,y:156},rightArm:{x:186,y:156}},actions:['refill','wipe','tidy'],environments:['bathroom','kitchen','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M64 64 H178 V201 H64 Q46 197 46 172 V90 Q47 65 64 64 Z" fill="${p.surface}" ${stroke(p,7)}/><ellipse cx="121" cy="64" rx="56" ry="20" fill="${p.primarySoft}" ${stroke(p,6)}/><ellipse cx="122" cy="63" rx="20" ry="9" fill="${p.turquoise}" ${stroke(p,4)}/><path d="M60 110 H173 M59 169 H171" stroke="${p.turquoise}" stroke-width="4" stroke-dasharray="11 8"/><path d="M64 184 H172 V197 H64 Z" fill="${pattern('halftoneFine')}" opacity=".4"/>`})}),
  define({ id:'microfiber-stack',family:'supply',face:{x:121,y:146},limbs:{leftArm:{x:44,y:149},rightArm:{x:200,y:149}},actions:['wash','wipe','dust','polish','refill'],environments:['utility','kitchen','bathroom'],
    draw:({palette:p,pattern})=>({body:`${base(p)}${rect(37,155,166,54,10,p.primarySoft,p,5)}${rect(43,109,152,51,10,p.turquoise,p,5)}${rect(51,64,138,51,10,p.coral,p,5)}${line('M58 178 H188 M66 129 H181 M75 84 H175',p,4,p.surface)}<path d="M41 193 H200 V208 H41 Z" fill="${pattern('halftoneFine')}" opacity=".5"/>`})}),
  define({ id:'generic-supply',family:'supply',face:{x:122,y:144},limbs:anchor,actions:['wash','wipe','scrub','refill'],environments:['generic-interior','utility'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M55 66 L120 34 L185 66 V207 H55 Z" fill="${p.mustard}" ${stroke(p,7)}/><path d="M55 68 H185" ${stroke(p,7)} fill="none"/>${rect(76,100,89,78,9,p.surface,p,4)}<path d="M85 165 H158 V178 H85 Z" fill="${pattern('halftoneMedium')}" opacity=".4"/><path d="M120 36 V92" ${stroke(p,5)} fill="none"/><path d="M85 83 H155" ${stroke(p,5)} fill="none" opacity=".6"/>`})}),
  define({ id:'rug',family:'environment',face:undefined,actions:['vacuum','wash','tidy'],environments:['living','bedroom','dining','hallway'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M34 107 L165 65 L213 163 L82 203 Z" fill="${p.coral}" ${stroke(p,7)}/><path d="M62 111 L160 81 L190 159 L91 190 Z" fill="${p.primarySoft}" ${stroke(p,4)}/><path d="M83 118 L157 95 L173 147 L101 171 Z" fill="${pattern('halftoneMedium')}" opacity=".53"/>${[92,112,132,152,172].map(x=>line(`M${x-17} 198 l-7 12`,p,3,p.mustard)).join('')}`})}),
  define({ id:'shelf-prop',family:'environment',face:undefined,actions:['dust','tidy','inspect'],environments:living,
    draw:({palette:p,pattern})=>({body:`${base(p)}${line('M29 194 H212',p,13,p.mustard)}${line('M46 193 V216 M197 193 V216',p,7)}${rect(48,117,42,75,5,p.coral,p,4)}${rect(91,143,35,49,4,p.turquoise,p,4)}${rect(130,111,34,81,4,p.primarySoft,p,4)}<path d="M173 175 V141 Q168 121 182 118 Q201 126 190 149 V175 Z" fill="${p.mustard}" ${stroke(p,4)}/>${line('M65 125 H83 M146 123 V174',p,3)}`})}),
  define({ id:'room-window-fragment',family:'environment',face:undefined,actions:['wipe','dust','wash','inspect'],environments:['living','bedroom','kitchen','generic-interior'],
    draw:({palette:p,pattern})=>({body:`${base(p)}<path d="M25 45 H210 V207 H25 Z" fill="${p.surface}" ${stroke(p,7)}/><path d="M42 57 H193 V172 H42 Z" fill="${p.turquoise}" ${stroke(p,5)}/>${line('M117 58 V171 M43 116 H191',p,6)}<path d="M48 164 L112 81 M124 164 L183 89" stroke="${p.surface}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".7"/>${line('M29 194 H208',p,10,p.mustard)}<rect x="29" y="195" width="174" height="10" fill="${pattern('halftoneFine')}" opacity=".45"/>`})}),
])

export const EXPANDED_OBJECT_IDS: readonly string[] = Object.freeze(expandedObjectPrimitives.map((item) => item.metadata.id))
