import { useId, useMemo, useState } from 'react'
import { Sheet } from '../Sheet'
import { useI18n } from '../../contexts/I18nContext'
import { getCardVisualRecipe } from '../../visual/procedural/cache'
import type { CardVisualInput } from '../../visual/procedural/resolver'
import { CARD_PALETTE_VARIANTS, ENVIRONMENT_FAMILIES } from '../../visual/procedural/taxonomy'
import { EXPRESSION_IDS } from '../../visual/expressions'
import { POSE_IDS } from '../../visual/poses'
import { STUDIO_ANIMATIONS, STUDIO_GESTURES, STUDIO_OBJECT_IDS, STUDIO_PROPORTIONS, STUDIO_PROPS,
  sanitizeStudioOverrides, studioUndo, type StudioField, type StudioOverrides } from '../../visual/studio/draft'
import { renderStudioPreviewSvg } from '../../visual/studio/preview'
import { vectorPaletteFromTheme } from '../../visual/palette'
import { themePreset } from '../../lib/theme'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import { readableVisualOverride } from '../../lib/visualOverrides'

export interface StudioTarget {
  kind: 'routine' | 'action' | 'entity'
  id: string
  name: string
  input: CardVisualInput
}

type SelectField = Exclude<StudioField, 'scale'>
const labelFor = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())

/** Only explicit confirmation writes a small recipe via the Phase 16A outbox. */
export function CharacterStudioSheet({ target, onClose }: { target: StudioTarget; onClose: () => void }) {
  const { locale } = useI18n()
  const { data, commitVisualOverride } = useData()
  const { isCloud } = useAuth()
  const storedRow = data?.visualOverrides?.find((row) => row.subjectType === target.kind && row.subjectId === target.id)
  const saved = data ? readableVisualOverride(data, target.kind, target.id) : undefined
  const [openedRevision] = useState(storedRow?.revision ?? 0)
  const [savePending, setSavePending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const it = locale === 'it'
  const id = useId()
  const [history, setHistory] = useState<StudioOverrides[]>([saved ?? {}])
  const [theme, setTheme] = useState<'house-care-retro' | 'night-garden'>('house-care-retro')
  const [replay, setReplay] = useState(0)
  const current = history[history.length - 1] ?? {}
  const automatic = useMemo(() => getCardVisualRecipe(target.input), [target.input])
  const palette = useMemo(() => vectorPaletteFromTheme(themePreset(theme).palette), [theme])
  const svg = useMemo(() => renderStudioPreviewSvg(automatic, current, `studio-${id}`, palette), [automatic, current, id, palette])
  const customized = Object.keys(current).length > 0
  const hasFallback = automatic.semantics.level === 'generic' || automatic.semantics.level === 'entity-family'

  const labels = it ? {
    heading: 'Studio Personaggio', preview: 'Anteprima dal vivo', notice: 'Bozza locale. Solo Conferma salva le impostazioni; sul cloud saranno condivise al prossimo aggiornamento.',
    artwork: 'Illustrazione', auto: 'Auto', custom: 'Personalizzata · provvisoria', reset: 'Ripristina Auto', undo: 'Annulla ultima modifica',
    object: 'Personaggio / oggetto', expression: 'Espressione', eyes: 'Occhi', brows: 'Sopracciglia', mouth: 'Bocca', pose: 'Posa',
    gesture: 'Guanto / gesto', scale: 'Dimensione', proportion: 'Proporzioni', prop: 'Accessori', scene: 'Ambiente',
    palette: 'Palette inchiostri', animation: 'Micro-animazione', light: 'Chiaro', night: 'Notte',
    automatic: 'Automatico', fallback: 'Soggetto non riconosciuto: viene usata una sagoma generica intenzionale.',
    close: 'Chiudi anteprima', replay: 'Riproduci animazione', domain: 'Nessun effetto su attività, pulizia o scorte.',
    theme: 'Tema anteprima', confirm: 'Conferma illustrazione', unavailable: 'Salvataggio cloud non disponibile: serve la migrazione 18B.', pending: 'Modifica accodata in modo sicuro.',
  } : {
    heading: 'Character Studio', preview: 'Live preview', notice: 'Local draft. Only Confirm saves your artwork; cloud changes appear for other members on their next normal refresh.',
    artwork: 'Artwork', auto: 'Auto', custom: 'Custom · draft', reset: 'Reset to Auto', undo: 'Undo last change',
    object: 'Character / object', expression: 'Expression', eyes: 'Eyes', brows: 'Eyebrows', mouth: 'Mouth', pose: 'Pose',
    gesture: 'Glove / gesture', scale: 'Scale', proportion: 'Proportions', prop: 'Scene props', scene: 'Scene',
    palette: 'Ink palette', animation: 'Micro-animation', light: 'Light', night: 'Night',
    automatic: 'Automatic', fallback: 'Unrecognized subject: an intentional generic silhouette is shown.',
    close: 'Close preview', replay: 'Replay animation', domain: 'Does not affect tasks, cleanliness, recurrence or stock.',
    theme: 'Preview theme', confirm: 'Confirm artwork', unavailable: 'Cloud save unavailable until the Phase 18B migration is installed.', pending: 'Artwork safely queued.',
  }

  function push(candidate: unknown) {
    const clean = sanitizeStudioOverrides(candidate)
    if (JSON.stringify(current) === JSON.stringify(clean)) return
    setHistory((previous) => [...previous.slice(-29), clean])
    setReplay((value) => value + 1)
  }
  function choose(field: SelectField, value: string) {
    const next: Record<string, unknown> = { ...current }
    if (value === '') delete next[field]
    else next[field] = value
    push(next)
  }
  function selectField(field: SelectField, label: string, values: readonly string[]) {
    return <label className="hc-studio-field" key={field}><span>{label}</span>
      <select value={current[field] ?? ''} onChange={(event) => choose(field, event.target.value)}>
        <option value="">{labels.automatic}</option>
        {values.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
      </select>
    </label>
  }
  async function confirmArtwork() {
    setSaveError(null)
    setSavePending(true)
    try { await commitVisualOverride(target.kind, target.id, current, openedRevision); onClose() }
    catch (error) { setSaveError(error instanceof Error ? error.message : String(error)) }
    finally { setSavePending(false) }
  }
  const canSave = !savePending && Boolean(data && (!isCloud || data.visualOverridesAvailable))
  const animation = current.animation ?? 'none' 
  return <Sheet title={`${labels.heading} · ${target.name}`} onClose={onClose}>
    <div className="hc-studio" data-hc-studio="explicit-commit" data-studio-kind={target.kind}>
      <p className="hc-studio-notice" role="note">{labels.notice}</p>
      <div className="hc-studio-preview-head"><strong>{labels.preview}</strong><span className="hc-studio-mode" aria-live="polite">{labels.artwork}: {customized ? labels.custom : labels.auto}</span></div>
      <div className={`hc-studio-preview ${theme === 'night-garden' ? 'night' : 'light'}`}>
        <div role="img" aria-label={`${labels.preview}: ${target.name}`} className="hc-studio-art" data-studio-motion={animation} key={`${target.id}-${replay}-${animation}`}
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {hasFallback && !current.subjectId && <p className="hc-studio-fallback" role="status">{labels.fallback}</p>}
      <div className="hc-studio-toolbar">
        <label className="hc-studio-field"><span>{labels.theme}</span><select value={theme} onChange={(event) => setTheme(event.target.value === 'night-garden' ? 'night-garden' : 'house-care-retro')}>
          <option value="house-care-retro">{labels.light}</option><option value="night-garden">{labels.night}</option></select></label>
        <button className="button secondary small" type="button" disabled={history.length < 2} onClick={() => { setHistory(studioUndo(history).history); setReplay((n) => n + 1) }}>{labels.undo}</button>
        <button className="button secondary small" type="button" disabled={!customized} onClick={() => push({})}>{labels.reset}</button>
        <button className="button ghost small" type="button" disabled={animation === 'none'} onClick={() => setReplay((n) => n + 1)}>{labels.replay}</button>
      </div>
      <fieldset className="hc-studio-fieldset"><legend>{it ? 'Identità e composizione' : 'Identity and composition'}</legend><div className="hc-studio-controls">
        {selectField('subjectId', labels.object, STUDIO_OBJECT_IDS)}
        {selectField('expression', labels.expression, EXPRESSION_IDS)}
        {selectField('eyes', labels.eyes, EXPRESSION_IDS)}
        {selectField('mouth', labels.mouth, EXPRESSION_IDS)}
        {selectField('brows', labels.brows, EXPRESSION_IDS)}
        {selectField('pose', labels.pose, POSE_IDS)}
        {selectField('handGesture', labels.gesture, STUDIO_GESTURES)}
        <label className="hc-studio-field"><span>{labels.scale}: {Math.round((current.scale ?? 1) * 100)}%</span><input type="range" min="0.75" max="1.25" step="0.05"
          value={current.scale ?? 1} onChange={(event) => push({ ...current, scale: Number(event.target.value) })} /></label>
        {selectField('proportion', labels.proportion, STUDIO_PROPORTIONS)}
        {selectField('prop', labels.prop, STUDIO_PROPS)}
        {selectField('scene', labels.scene, ENVIRONMENT_FAMILIES)}
        {selectField('paletteVariant', labels.palette, CARD_PALETTE_VARIANTS)}
        {selectField('animation', labels.animation, STUDIO_ANIMATIONS)}
      </div></fieldset>
      <p className="hc-studio-disclaimer">{labels.domain}</p>
      {isCloud && !data?.visualOverridesAvailable && <p className="hc-studio-fallback" role="status">{labels.unavailable}</p>}
      {saveError && <p className="error-banner" role="alert">{saveError}</p>}
      <div className="hc-studio-commit-actions">
        <button type="button" className="button primary" disabled={!canSave} onClick={() => void confirmArtwork()}>{labels.confirm}</button>
        <button type="button" className="button secondary hc-studio-close" disabled={savePending} onClick={onClose}>{labels.close}</button>
      </div>
    </div>
  </Sheet>
}
