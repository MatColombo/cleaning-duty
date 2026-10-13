import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sheet } from '../Sheet'
import { SceneDecorationMark } from './SceneDecorationMark'
import { SCENE_INKS, SCENE_LAYERS, SCENE_PROPS, validatedSceneDecorations, type SceneDecoration, type SceneInk, type SceneLayer, type SceneProp } from '../../lib/sceneDecorations'
import { newId } from '../../lib/id'
import type { LayoutElement, WorkspaceData } from '../../types/domain'
import { useI18n } from '../../contexts/I18nContext'

interface Props {
  data: WorkspaceData
  sceneId: string
  initial: SceneDecoration[]
  expectedRevision: number
  available: boolean
  onSave: (items: SceneDecoration[], revision: number) => Promise<void>
  onClose: () => void
}
const label = {
  en: {title:'Decorate Home',sub:'Built-in vector props only. Geometry and tasks are unchanged.',
    noCloud:'Cloud saving requires the Phase 19B migration. Your draft stays local until you close this sheet.',
    add:'Add decoration', item:'Decoration', kind:'Prop', ink:'Ink', layer:'Layer', anchor:'Attached placement', none:'Free in scene',
    x:'Horizontal', y:'Vertical', scale:'Scale', rotation:'Rotation', remove:'Remove', undo:'Undo', reset:'Reset to Auto',
    save:'Save scene artwork', cancel:'Cancel', preview:'Drag a decoration to position it, or use the sliders below.',
    empty:'No saved decorations — the illustrated scene is generated automatically.', count:'out of 16 props'},
  it: {title:'Decora la casa',sub:'Solo elementi vettoriali integrati. Geometrie e attività non cambiano.',
    noCloud:'Per salvare nel cloud serve la migrazione 19B. La bozza è locale finché non chiudi questo pannello.',
    add:'Aggiungi decorazione', item:'Decorazione', kind:'Oggetto', ink:'Inchiostro', layer:'Livello', anchor:'Elemento associato', none:'Libero nella scena',
    x:'Orizzontale', y:'Verticale', scale:'Scala', rotation:'Rotazione', remove:'Rimuovi', undo:'Annulla', reset:'Ripristina Auto',
    save:'Salva decorazioni', cancel:'Annulla', preview:'Trascina una decorazione, oppure usa i cursori qui sotto.',
    empty:'Nessuna decorazione salvata: la scena illustrata viene generata automaticamente.', count:'su 16 oggetti'},
}

/** All changes are local until an explicit Save. No onPointerMove ever calls onSave. */
export function SceneDecorationsSheet({ data, sceneId, initial, expectedRevision, available, onSave, onClose }: Props) {
  const { locale } = useI18n()
  const t = label[locale]
  const [draft, setDraft] = useState<SceneDecoration[]>(() => { try { return validatedSceneDecorations(initial) } catch { return [] } })
  const [history, setHistory] = useState<SceneDecoration[][]>([])
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dragRef = useRef<{pointerId:number; id:string} | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const elements = data.layoutElements.filter(item => item.sceneId === sceneId && !item.archivedAt)
  const elementById = new Map(elements.map(item => [item.id, item]))
  const selected = draft.find(item => item.id === selectedId)
  useEffect(() => { if (!elements.some(x => x.id === selected?.elementId) && selected?.elementId) setError(locale === 'it'
    ? 'Un elemento associato non è più disponibile. Scegli un altro elemento prima di salvare.'
    : 'An attached placement is no longer available. Choose another before saving.') }, [data.layoutElements, selected?.elementId, locale])
  function record(next: SceneDecoration[]) { setHistory(stack => [...stack.slice(-29), draft]); setDraft(next); setError('') }
  function update(id: string, patch: Partial<SceneDecoration>, snapshot = true) {
    const next = draft.map(x => x.id === id ? {...x, ...patch} : x)
    if (snapshot) record(next)
    else setDraft(next)
  }
  function add() {
    if (draft.length >= 16) return
    const id = newId()
    record([...draft, { id, kind:'plant', ink:'teal', layer:'above', x:500, y:350, scale:1, rotation:0 }])
    setSelectedId(id)
  }
  function point(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return null
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const value = svg.createSVGPoint()
    value.x = event.clientX; value.y = event.clientY
    return value.matrixTransform(matrix.inverse())
  }
  function beginDrag(event: ReactPointerEvent<SVGGElement>, id: string) {
    if (busy) return
    event.preventDefault(); event.stopPropagation()
    setSelectedId(id)
    setHistory(stack => [...stack.slice(-29), draft])
    dragRef.current = { pointerId:event.pointerId, id }
    svgRef.current?.setPointerCapture(event.pointerId)
  }
  function drag(event: ReactPointerEvent<SVGSVGElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const coords = point(event)
    if (!coords) return
    const item = draft.find(x => x.id === current.id)
    if (!item) return
    const anchor = item.elementId ? elementById.get(item.elementId) : undefined
    const x = anchor ? Math.round(Math.max(0, Math.min(1000, (coords.x-anchor.x)/Math.max(1,anchor.width)*1000)))
      : Math.round(Math.max(0, Math.min(1000, coords.x)))
    const y = anchor ? Math.round(Math.max(0, Math.min(700, (coords.y-anchor.y)/Math.max(1,anchor.height)*700)))
      : Math.round(Math.max(0, Math.min(700, coords.y)))
    setDraft(items => items.map(row => row.id === current.id ? {...row,x,y} : row))
  }
  function endDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
  }
  async function confirm() {
    if (busy || !available) return
    setBusy(true); setError('')
    try { await onSave(validatedSceneDecorations(draft), expectedRevision); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }
  const renderRows = draft.map(item => {
    const anchor = item.elementId ? elementById.get(item.elementId) : undefined
    if (item.elementId && !anchor) return null // orphan stays in draft for recovery, but never draws
    const x = anchor ? anchor.x + anchor.width*item.x/1000 : item.x
    const y = anchor ? anchor.y + anchor.height*item.y/700 : item.y
    return <g key={item.id} role="button" tabIndex={0} aria-label={`${item.kind} (${item.x}, ${item.y})`}
      aria-pressed={selectedId === item.id} onPointerDown={e => beginDrag(e,item.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();setSelectedId(item.id)} }}>
      <circle cx={x} cy={y} r={33} fill="transparent" stroke={selectedId === item.id ? 'var(--color-primary)' : 'transparent'} strokeDasharray="5 5" strokeWidth={3}/>
      <SceneDecorationMark item={item} anchor={anchor}/>
    </g>
  })
  const choices = <>
    <label>{t.item}<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
      {draft.map((x,i)=><option key={x.id} value={x.id}>{i+1}. {x.kind}</option>)}
    </select></label>
    {selected && <div className="v2-scene-studio-fields">
      <label>{t.kind}<select value={selected.kind} onChange={e=>update(selected.id,{kind:e.target.value as SceneProp})}>{SCENE_PROPS.map(k=><option key={k}>{k}</option>)}</select></label>
      <label>{t.ink}<select value={selected.ink} onChange={e=>update(selected.id,{ink:e.target.value as SceneInk})}>{SCENE_INKS.map(k=><option key={k}>{k}</option>)}</select></label>
      <label>{t.layer}<select value={selected.layer} onChange={e=>update(selected.id,{layer:e.target.value as SceneLayer})}>{SCENE_LAYERS.map(k=><option key={k}>{k}</option>)}</select></label>
      <label>{t.anchor}<select value={selected.elementId ?? ''} onChange={e=>update(selected.id,{elementId:e.target.value||undefined,x:500,y:350})}>
        <option value="">{t.none}</option>{elements.map(x=><option key={x.id} value={x.id}>{data.entities.find(e=>e.id===x.entityId)?.name ?? x.id}</option>)}
      </select></label>
      <label>{t.x}: {selected.x}<input type="range" min="0" max="1000" step="1" value={selected.x} onChange={e=>update(selected.id,{x:Number(e.target.value)},false)} onPointerDown={()=>setHistory(stack=>[...stack.slice(-29),draft])} /></label>
      <label>{t.y}: {selected.y}<input type="range" min="0" max="700" step="1" value={selected.y} onChange={e=>update(selected.id,{y:Number(e.target.value)},false)} onPointerDown={()=>setHistory(stack=>[...stack.slice(-29),draft])} /></label>
      <label>{t.scale}: {selected.scale.toFixed(1)}<input type="range" min="0.5" max="2" step="0.1" value={selected.scale} onChange={e=>update(selected.id,{scale:Number(e.target.value)},false)} onPointerDown={()=>setHistory(stack=>[...stack.slice(-29),draft])} /></label>
      <label>{t.rotation}: {selected.rotation}°<input type="range" min="-180" max="180" step="15" value={selected.rotation} onChange={e=>update(selected.id,{rotation:Number(e.target.value)},false)} onPointerDown={()=>setHistory(stack=>[...stack.slice(-29),draft])} /></label>
      <button className="button secondary small" onClick={()=>{record(draft.filter(x=>x.id!==selected.id));setSelectedId(draft.find(x=>x.id!==selected.id)?.id??'')}}>{t.remove}</button>
    </div>}
  </>
  return <Sheet title={t.title} onClose={onClose}>
    <div className="v2-scene-studio stack tight-stack">
      <p className="muted compact-text">{t.sub}</p>
      {!available && <p role="status" className="notice">{t.noCloud}</p>}
      <p className="muted compact-text">{t.preview}</p>
      <svg ref={svgRef} className="v2-scene-studio-preview" viewBox="0 0 1000 700" role="group" aria-label={t.title}
        onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <rect x="0" y="0" width="1000" height="700" rx="18" fill="var(--color-surface-soft)" stroke="var(--color-line)" strokeWidth="5"/>
        {elements.map(e=><rect key={e.id} x={e.x} y={e.y} width={e.width} height={e.height} rx="10" fill="none" stroke="var(--color-ink-muted)" strokeWidth="2" opacity=".35" pointerEvents="none"/>)}
        {renderRows}
      </svg>
      <div className="v2-scene-studio-toolbar">
        <span>{draft.length} {t.count}</span>
        <button type="button" className="button secondary small" disabled={draft.length>=16||busy} onClick={add}>+ {t.add}</button>
        <button type="button" className="button ghost small" disabled={!history.length||busy} onClick={()=>{const last=history.at(-1);if(last){setDraft(last);setHistory(x=>x.slice(0,-1))}}}>{t.undo}</button>
      </div>
      {draft.length ? choices : <p className="muted compact-text">{t.empty}</p>}
      {error && <p role="alert" className="error-banner">{error}</p>}
      <div className="v2-scene-studio-actions">
        <button className="button ghost" disabled={busy} onClick={()=>record([])}>{t.reset}</button>
        <button className="button secondary" disabled={busy} onClick={onClose}>{t.cancel}</button>
        <button className="button primary" disabled={busy||!available} onClick={()=>void confirm()}>{t.save}</button>
      </div>
    </div>
  </Sheet>
}
