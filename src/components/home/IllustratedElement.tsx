import type { LayoutElement } from '../../types/domain'
import { homeIllustrationDetail, type IllustratedElementRecipe } from '../../lib/homeIllustration'

/** Uninteractive print ink inside an existing layout placement, not a new hit target. */
export function IllustratedElement({ element, recipe, zoom = 1 }: {
  element: LayoutElement; recipe: IllustratedElementRecipe; zoom?: number
}) {
  const { x, y, width: w, height: h } = element
  const detail = homeIllustrationDetail(zoom)
  const short = Math.min(w, h)
  const pad = Math.min(22, short * .15)
  const centerX = x + w * .5, centerY = y + h * .5
  const scale = Math.max(.35, Math.min(1.6, short / 155))
  const size = 52 * scale
  // For polygon rooms keep the ornament well within the center, not across edges.
  const x1 = x + pad, x2 = x + w - pad
  const y1 = y + pad, y2 = y + h - pad
  const motif = recipe.motif
  const area = element.role === 'area'
  const glyph = <>
      {recipe.silhouette === 'sink' && <><rect x="-33" y="-8" width="66" height="31" rx="11"/><ellipse cx="0" cy="7" rx="22" ry="10"/><path d="M-9-8 v-17 q0-13 14-13 q14 0 14 12 v10" /></>}
      {recipe.silhouette === 'oven' && <><rect x="-31" y="-34" width="62" height="67" rx="6"/><rect x="-23" y="-10" width="46" height="33" rx="3"/><path d="M-23-22h45"/><circle cx="-19" cy="-27" r="2"/><circle cx="-8" cy="-27" r="2"/></>}
      {recipe.silhouette === 'sofa' && <><rect x="-29" y="-18" width="58" height="41" rx="12"/><path d="M-33-1h66v27h-66z M-26 28v7 M26 28v7"/><path d="M0-15v15"/></>}
      {recipe.silhouette === 'bed' && <><rect x="-32" y="-23" width="64" height="52" rx="5"/><path d="M-32-5h64 M-30 31v5 M30 31v5"/><rect x="-21" y="-19" width="42" height="11" rx="4"/></>}
      {recipe.silhouette === 'table' && <><rect x="-32" y="-14" width="64" height="21" rx="6"/><path d="M-22 7v31 M22 7v31"/></>}
      {recipe.silhouette === 'shower' && <><path d="M-24 33v-52q0-20 24-20q24 0 24 18"/><path d="M9-20h31v9H9z"/><path d="M13-1l-3 6 M24-1l-3 6 M35-1l-3 6"/></>}
      {recipe.silhouette === 'plant' && <><path d="M-23 8h46l-6 30h-34z M0 8v-42 M0-5q-36-14-27-30q28 0 27 30 M0-16q31-34 37-15q-1 25-37 15"/></>}
      {recipe.silhouette === 'washer' && <><rect x="-31" y="-35" width="62" height="73" rx="6"/><circle cx="0" cy="7" r="23"/><path d="M-30-22h61"/><circle cx="-20" cy="-28" r="2"/></>}
      {recipe.silhouette === 'lamp' && <><path d="M0-12v48 M-21 36h42 M-34-14l13-30h42l13 30z"/></>}
      {recipe.silhouette === 'tool' && <><path d="M-10-32h20l6 22v42h-32v-42z"/><path d="M-13-32h26 M-23 32h46"/></>}
      {recipe.silhouette === 'generic' && <><rect x="-29" y="-23" width="58" height="49" rx="10"/><path d="M-15-8h30 M-15 5h20"/><circle cx="18" cy="16" r="3"/></>}
  </>
  const decorated = area ? <>
    <path d={`M${x1} ${y1 + 15} H${Math.min(x2, x1 + 52)} M${x1} ${y1 + 24} H${Math.min(x2, x1 + 39)}`} />
    {detail !== 'minimal' && short >= 145 && <>
      <path d={`M${x2-26} ${y2} L${x2} ${y2-26} M${x2-14} ${y2} L${x2} ${y2-14}`} />
      {motif === 'tiles' && <path d={`M${x1+11} ${y2-26} h34 v17 h-34 z M${x1+28} ${y2-26} v17`} />}
      {motif === 'parquet' && <path d={`M${x1+10} ${y2-26} l30 10 m-30 0 l30 10`} />}
      {motif === 'garden' && <path d={`M${x1+20} ${y2-8} q-15-25-6-36 M${x1+20} ${y2-8} q17-23 7-36`} />}
      {motif === 'rays' && <path d={`M${x1+39} ${y2-12} l0-15 m-12 3 l-10-7 m31 7 l10-7`} />}
      <g className="v2-room-hero-stamp" transform={`translate(${x2 - Math.min(88,w*.22)} ${y1 + Math.min(90,h*.29)}) rotate(${recipe.rotation}) scale(${Math.max(.55,Math.min(1.1,short/310))})`}>{glyph}</g>
    </>}
    {detail === 'rich' && short >= 145 && <path d={`M${x1+68} ${y2-29} q17-18 32 0 t32 0 M${x2-85} ${y1+24} q13-17 26 0 t26 0`} />}
  </> : <g transform={`translate(${centerX} ${centerY - Math.min(14,h*.1)}) scale(${size/80}) rotate(${recipe.rotation})`}>
    {glyph}
  </g>
  return <g aria-hidden="true" pointerEvents="none" className={`v2-home-illustration ${area ? 'v2-room-print' : 'v2-object-print'}`} data-home-motif={motif} data-home-silhouette={recipe.silhouette}>
    {area && <path d={`M${x+4} ${y+4} H${x+w-4} V${y+h-4} H${x+4} Z`} strokeDasharray="2 11" className="v2-room-engraving" />}
    {decorated}
  </g>
}
