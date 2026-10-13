import type { SceneDecoration } from '../../lib/sceneDecorations'
import type { LayoutElement } from '../../types/domain'

/** Tiny, locally-rendered symbol; all shape data is authored, not loaded from the network. */
export function SceneDecorationMark({ item, anchor, preview = false }: { item: SceneDecoration; anchor?: LayoutElement; preview?: boolean }) {
  const x = anchor ? anchor.x + anchor.width * item.x / 1000 : item.x
  const y = anchor ? anchor.y + anchor.height * item.y / 700 : item.y
  const s = item.scale * (preview ? .85 : 1)
  const pen = 'currentColor'
  return <g aria-hidden="true" pointerEvents="none" className={`v2-scene-decoration v2-scene-ink-${item.ink}`}
    data-decoration-id={item.id} data-decoration-kind={item.kind} transform={`translate(${x} ${y}) rotate(${item.rotation}) scale(${s})`}
    fill="none" stroke={pen} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round">
    {item.kind === 'plant' && <><path d="M-18 12h36l-5 30h-26z M0 12v-49 M0-8q-33-16-28-31q26 0 28 31 M0-15q26-31 33-19q2 21-33 19"/></>}
    {item.kind === 'rug' && <><rect x="-42" y="-26" width="84" height="52" rx="12"/><rect x="-30" y="-16" width="60" height="32" rx="7" strokeDasharray="3 6"/><path d="M-46-19h-8 M-46 0h-8 M-46 19h-8 M46-19h8 M46 0h8 M46 19h8"/></>}
    {item.kind === 'lamp' && <><path d="M0-8v45 M-26 37h52 M-32-9l11-28h42l11 28z"/></>}
    {item.kind === 'shelf' && <><path d="M-39 25h78 M-34 25v12 M34 25v12 M-23 20v-35h20v35 M6 20v-46h18v46"/></>}
    {item.kind === 'starburst' && <><path d="M0-39v18 M0 21v18 M-39 0h18 M21 0h18 M-28-28l13 13 M15 15l13 13 M28-28L15-15 M-15 15l-13 13"/><path d="M0-11L4-4L11 0L4 4L0 11L-4 4L-11 0L-4-4z"/></>}
    {item.kind === 'tiles' && <><rect x="-39" y="-27" width="78" height="54" rx="4"/><path d="M-13-27v54 M13-27v54 M-39-9h78 M-39 9h78"/></>}
    {item.kind === 'sofa' && <><rect x="-37" y="-25" width="74" height="42" rx="12"/><rect x="-41" y="-3" width="82" height="24" rx="6"/><path d="M-29 22v12 M29 22v12 M0-23v19"/></>}
    {item.kind === 'counter' && <><rect x="-41" y="-19" width="82" height="14" rx="5"/><path d="M-33-5v40 M33-5v40 M-31 17h62"/></>}
    {item.kind === 'picture' && <><rect x="-35" y="-29" width="70" height="58" rx="5"/><path d="M-22 14L-6-5L7 7L18-11L27 14z"/><circle cx="-16" cy="-15" r="5"/></>}
  </g>
}
