import { AdditionalActivitiesBuilder } from '../components/AdditionalActivitiesBuilder'
import { additionalActivityFromRoutine } from '../lib/linkedRoutines'
import type { AdditionalActivityInput } from '../types/domain'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { FormField } from '../components/FormField'
import { Sheet } from '../components/Sheet'
import { RoutineTargetPicker } from '../components/RoutineTargetPicker'
import { AdvancedTargetBuilder } from '../components/AdvancedTargetBuilder'
import { AdvancedAssignmentBuilder, defaultAdvancedAssignment } from '../components/AdvancedAssignmentBuilder'
import { RoutineSimulation } from '../components/RoutineSimulation'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { formatTaskDateTime, localDateInZone } from '../lib/date'
import { previewDueAts } from '../lib/scheduler'
import type { AdvancedAssignmentPolicy, AdvancedTargetSelector, AssignmentPolicy, CareLevel, RecurrenceRule, ReminderPolicy, Routine, ScheduleMode } from '../types/domain'
import { logClientError, normalizeError } from '../lib/errorLog'

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const ordinals = [1, 2, 3, 4, -1] as const

type BuilderKind = 'once' | 'interval' | 'weekdays' | 'monthlyNth'
type IntervalUnit = 'hour' | 'day' | 'week' | 'month'
type SupplyChoice = 'inherit' | 'custom' | 'none'
type ReminderChoice = 'none' | 'at_due' | '30' | '60' | 'custom' | 'previous_same' | 'previous_chosen'
type ReminderOffsetUnit = 'minute' | 'hour' | 'day'
type SimpleAssignmentMode = 'me' | 'member' | 'alternate' | 'everyone' | 'unassigned'

export function RoutinesPage() {
  const { data, currentMember, addRoutine, updateRoutine, archiveRoutine, setRoutineStatus } = useData()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Routine | null>(null)
  if (!data) return null
  const routines = data.routines.filter((item) => !item.archivedAt && !item.parentRoutineId)
  const actions = data.actions.filter((item) => !item.archivedAt)
  const entities = data.entities.filter((item) => !item.archivedAt)
  const supplies = data.supplies.filter((item) => !item.archivedAt)

  return <div className="stack page-stack">
    <header className="page-title-row"><div><div className="eyebrow">{t('routines')}</div><h1>{t('routines')}</h1><div className="inline-links"><Link className="text-link" to="/actions">{t('actions')}</Link><Link className="text-link" to="/supplies">{t('supplies')}</Link></div></div><button className="button primary small" disabled={!actions.length || !entities.length} onClick={() => { setEditing(null); setOpen(true) }}>+ {t('addRoutine')}</button></header>
    {(!actions.length || !entities.length) && <div className="notice">{locale === 'it' ? 'Crea almeno un’azione e un luogo/oggetto prima di creare una routine.' : 'Create at least one action and one place/item before creating a routine.'}</div>}
    {!routines.length ? <EmptyState>{t('noRoutines')}</EmptyState> : <div className="card-list">{routines.map((routine) => <RoutineCard key={routine.id} routine={routine} />)}</div>}
    {open && <RoutineSheet routine={editing} onClose={() => { setOpen(false); setEditing(null) }} />}
  </div>

  function RoutineCard({ routine }: { routine: Routine }) {
    const action = actions.find((item) => item.id === routine.actionId)
    const targetNames = routine.targetEntityIds.map((id) => { const name = entities.find((item) => item.id === id)?.name; return name ? `${name}${routine.includeDescendantTargetIds.includes(id) ? ' +' : ''}` : undefined }).filter(Boolean)
    const resolvedSupplyIds = routine.supplyIdsOverride ?? action?.defaultSupplyIds ?? []
    const supplyNames = resolvedSupplyIds.map((id) => supplies.find((item) => item.id === id)?.name).filter(Boolean)
    return <article className="card routine-card">
      <div className="routine-top"><div><div className="eyebrow">{action?.name}</div><h2>{routine.name}</h2></div><div className="row-actions"><span className={`status ${routine.status === 'paused' ? 'warn' : routine.status === 'ended' ? 'muted-status' : ''}`}>{routine.status === 'paused' ? t('paused') : routine.status === 'ended' ? t('ended') : t('active')}</span><button className="icon-button" onClick={() => { setEditing(routine); setOpen(true) }}>{t('edit')}</button>{routine.status === 'active' && <button className="icon-button" onClick={() => void setRoutineStatus(routine.id, 'paused')}>{t('pause')}</button>}{routine.status === 'paused' && <button className="icon-button" onClick={() => void setRoutineStatus(routine.id, 'active')}>{t('resume')}</button>}{routine.status !== 'ended' && <button className="icon-button" onClick={() => { if (confirm(t('endRoutineConfirm'))) void setRoutineStatus(routine.id, 'ended') }}>{t('endRoutine')}</button>}<button className="icon-button danger-text" onClick={() => void archiveRoutine(routine.id)}>{t('archive')}</button></div></div>
      <div className="routine-details"><span>{targetNames.join(', ')}{routine.advancedTargetSelector?.conditions.length ? `${targetNames.length ? ' · ' : ''}${t('dynamicTargets')}` : ''}</span><span>{scheduleText(routine.recurrence)} · {routine.timeOfDay}</span><span className={`care-level-tag ${routine.careLevel === 'deep' ? 'deep' : 'routine'}`}>{routine.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span><span>{routine.scheduleMode === 'after_completion' ? t('afterCompletion') : t('fixedCalendar')}</span><span>{assignmentText(routine.assignment)}</span>{supplyNames.length > 0 && <span>{supplyNames.join(', ')}</span>}</div>
      {routine.affectsCleanliness === false && <p className="muted compact-text">{t('cleanlinessExcluded')}</p>}
      {data!.routines.some((child) => child.parentRoutineId === routine.id && !child.archivedAt) && <div className="linked-routine-summary">{data!.routines.filter((child) => child.parentRoutineId === routine.id && !child.archivedAt).map((child) => <div key={child.id}><strong>{child.name}</strong><small>{t('everyParentTriggers')}: {child.triggerEvery} · {child.targetEntityIds.map((id) => entities.find((entity) => entity.id === id)?.name).filter(Boolean).join(', ')}</small></div>)}</div>}
    </article>
  }

  function RoutineSheet({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
    const today = localDateInZone(data!.workspace.timezone)
    const activeMembers = data!.members.filter((member) => member.status === 'active')
    const otherMembers = activeMembers.filter((member) => member.id !== currentMember?.id)
    const originalRule = routine?.recurrence
    const initialKind: BuilderKind = !originalRule ? 'weekdays' : originalRule.kind === 'daily' ? 'interval' : originalRule.kind
    const initialUnit: IntervalUnit = originalRule?.kind === 'daily' ? 'day' : originalRule?.kind === 'interval' ? originalRule.unit : 'day'
    const initialInterval = originalRule?.kind === 'daily' ? originalRule.interval : originalRule?.kind === 'interval' ? originalRule.interval : 1

    const [name, setName] = useState(routine?.name ?? '')
    const [actionId, setActionId] = useState(routine?.actionId ?? actions[0]?.id ?? '')
    const [careLevel, setCareLevel] = useState<CareLevel>(routine?.careLevel ?? 'routine')
    const [affectsCleanliness, setAffectsCleanliness] = useState(routine?.affectsCleanliness !== false)
    const [additionalActivities, setAdditionalActivities] = useState<AdditionalActivityInput[]>(() => data!.routines.filter((child) => child.parentRoutineId === routine?.id && !child.archivedAt && Boolean(routine)).map(additionalActivityFromRoutine))
    const [refreshLevelPct, setRefreshLevelPct] = useState(routine?.refreshLevelPct ?? 100)
    const [targets, setTargets] = useState<string[]>(routine?.targetEntityIds ?? [])
    const [includeDescendantTargetIds, setIncludeDescendantTargetIds] = useState<string[]>(routine?.includeDescendantTargetIds ?? [])
    const [kind, setKind] = useState<BuilderKind>(initialKind)
    const [onceDate, setOnceDate] = useState(originalRule?.kind === 'once' ? originalRule.date : today)
    const [anchorDate, setAnchorDate] = useState(originalRule && originalRule.kind !== 'once' ? originalRule.anchorDate : today)
    const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(initialUnit)
    const [intervalValue, setIntervalValue] = useState(initialInterval)
    const [weekInterval, setWeekInterval] = useState(originalRule?.kind === 'weekdays' ? originalRule.intervalWeeks : 1)
    const [weekdays, setWeekdays] = useState<number[]>(originalRule?.kind === 'weekdays' ? originalRule.weekdays : [1])
    const [nthWeekday, setNthWeekday] = useState(originalRule?.kind === 'monthlyNth' ? originalRule.weekday : 3)
    const [nthOrdinal, setNthOrdinal] = useState<1 | 2 | 3 | 4 | -1>(originalRule?.kind === 'monthlyNth' ? originalRule.ordinal : 3)
    const [monthInterval, setMonthInterval] = useState(originalRule?.kind === 'monthlyNth' ? originalRule.intervalMonths : 1)
    const [time, setTime] = useState(routine?.timeOfDay ?? '09:00')
    const [scheduleMode, setScheduleModeState] = useState<ScheduleMode>(routine?.scheduleMode ?? 'fixed')
    const initialMode: SimpleAssignmentMode = routine?.assignment.mode && routine.assignment.mode !== 'advanced' ? routine.assignment.mode : 'me'
    const [assignmentMode, setAssignmentMode] = useState<SimpleAssignmentMode>(initialMode)
    const [useAdvancedAssignment, setUseAdvancedAssignment] = useState(routine?.assignment.mode === 'advanced')
    const [advancedAssignment, setAdvancedAssignment] = useState<AdvancedAssignmentPolicy>(routine?.assignment.mode === 'advanced' ? routine.assignment : defaultAdvancedAssignment(activeMembers))
    const [advancedTargetSelector, setAdvancedTargetSelector] = useState<AdvancedTargetSelector | undefined>(routine?.advancedTargetSelector)
    const [memberId, setMemberId] = useState(routine?.assignment.mode === 'member' ? routine.assignment.memberId : otherMembers[0]?.id ?? '')
    const [excludedDates, setExcludedDates] = useState<string[]>(routine?.exceptions.excludedDates ?? [])
    const [includedDateTimes, setIncludedDateTimes] = useState<string[]>(routine?.exceptions.includedDateTimes ?? [])
    const [skipDateValue, setSkipDateValue] = useState('')
    const [extraDateTime, setExtraDateTime] = useState('')
    const [moveOriginalDate, setMoveOriginalDate] = useState('')
    const [moveNewDateTime, setMoveNewDateTime] = useState('')
    const existingOffset = routine?.reminder.mode === 'offset' ? routine.reminder.minutesBefore : 120
    const initialReminder: ReminderChoice = routine?.reminder.mode === 'at_due' ? 'at_due'
      : routine?.reminder.mode === 'offset' && routine.reminder.minutesBefore === 30 ? '30'
        : routine?.reminder.mode === 'offset' && routine.reminder.minutesBefore === 60 ? '60'
          : routine?.reminder.mode === 'offset' ? 'custom'
            : routine?.reminder.mode === 'previous_day' && routine.reminder.time ? 'previous_chosen'
              : routine?.reminder.mode === 'previous_day' ? 'previous_same' : 'none'
    const initialOffsetUnit: ReminderOffsetUnit = existingOffset >= 1440 && existingOffset % 1440 === 0 ? 'day' : existingOffset >= 60 && existingOffset % 60 === 0 ? 'hour' : 'minute'
    const initialOffsetAmount = initialOffsetUnit === 'day' ? existingOffset / 1440 : initialOffsetUnit === 'hour' ? existingOffset / 60 : existingOffset
    const [reminderChoice, setReminderChoice] = useState<ReminderChoice>(initialReminder)
    const [reminderTime, setReminderTime] = useState(routine?.reminder.mode === 'previous_day' && routine.reminder.time ? routine.reminder.time : '19:00')
    const [customReminderAmount, setCustomReminderAmount] = useState(Math.max(1, initialOffsetAmount))
    const [customReminderUnit, setCustomReminderUnit] = useState<ReminderOffsetUnit>(initialOffsetUnit)
    const initialSupplyChoice: SupplyChoice = routine?.supplyIdsOverride === undefined ? 'inherit' : routine.supplyIdsOverride.length ? 'custom' : 'none'
    const [supplyChoice, setSupplyChoice] = useState<SupplyChoice>(initialSupplyChoice)
    const [customSupplyIds, setCustomSupplyIds] = useState<string[]>(routine?.supplyIdsOverride ?? [])
    const [formError, setFormError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const submittingRef = useRef(false)

    const recurrence: RecurrenceRule = kind === 'once'
      ? { kind: 'once', date: onceDate }
      : kind === 'interval'
        ? { kind: 'interval', unit: intervalUnit, interval: Math.max(1, intervalValue), anchorDate }
        : kind === 'weekdays'
          ? { kind: 'weekdays', weekdays, intervalWeeks: Math.max(1, weekInterval), anchorDate }
          : { kind: 'monthlyNth', weekday: nthWeekday, ordinal: nthOrdinal, intervalMonths: Math.max(1, monthInterval), anchorDate }

    const assignment: AssignmentPolicy = useAdvancedAssignment ? advancedAssignment : assignmentMode === 'me'
      ? { mode: 'me', memberId: currentMember?.id ?? activeMembers[0]?.id ?? '' }
      : assignmentMode === 'member'
        ? { mode: 'member', memberId }
        : assignmentMode === 'alternate'
          ? { mode: 'alternate', memberIds: activeMembers.map((member) => member.id) }
          : assignmentMode === 'everyone'
            ? { mode: 'everyone' }
            : { mode: 'unassigned' }

    const normalizedCustomReminderAmount = Number.isFinite(customReminderAmount) ? Math.max(1, Math.round(customReminderAmount)) : 1
    const customReminderMinutes = normalizedCustomReminderAmount * (customReminderUnit === 'day' ? 1440 : customReminderUnit === 'hour' ? 60 : 1)
    const reminder: ReminderPolicy = reminderChoice === 'at_due' ? { mode: 'at_due' }
      : reminderChoice === '30' ? { mode: 'offset', minutesBefore: 30 }
        : reminderChoice === '60' ? { mode: 'offset', minutesBefore: 60 }
          : reminderChoice === 'custom' ? { mode: 'offset', minutesBefore: customReminderMinutes }
            : reminderChoice === 'previous_same' ? { mode: 'previous_day' }
              : reminderChoice === 'previous_chosen' ? { mode: 'previous_day', time: reminderTime }
                : { mode: 'none' }

    const supplyIdsOverride = supplyChoice === 'inherit' ? undefined : supplyChoice === 'none' ? [] : customSupplyIds
    const previewRoutine: Routine = {
      id: routine?.id ?? 'preview', workspaceId: data!.workspace.id, name: name || 'Routine', actionId,
      targetEntityIds: targets, includeDescendantTargetIds, advancedTargetSelector, recurrence, timeOfDay: time, scheduleMode, exceptions: { excludedDates, includedDateTimes },
      assignment, reminder, careLevel, cleanlinessChannel: careLevel === 'deep' ? 'deep' : 'regular', routineTimezone: routine?.routineTimezone ?? data!.workspace.timezone,
      refreshLevelPct: Math.max(10, Math.min(100, refreshLevelPct)), status: routine?.status ?? 'active',
      affectsCleanliness, supplyIdsOverride, revision: routine?.revision ?? 1, createdAt: routine?.createdAt ?? new Date().toISOString(),
    }
    const preview = previewDueAts(data!, previewRoutine, 5)

    function setScheduleMode(mode: ScheduleMode) {
      setScheduleModeState(mode)
      if (mode === 'after_completion' && kind !== 'interval') setKind('interval')
    }

    function addSkipDate() {
      if (!skipDateValue || excludedDates.includes(skipDateValue)) return
      setExcludedDates([...excludedDates, skipDateValue].sort()); setSkipDateValue('')
    }
    function addExtraDate() {
      if (!extraDateTime || includedDateTimes.includes(extraDateTime)) return
      setIncludedDateTimes([...includedDateTimes, extraDateTime].sort()); setExtraDateTime('')
    }
    function addMove() {
      if (!moveOriginalDate || !moveNewDateTime) return
      if (!excludedDates.includes(moveOriginalDate)) setExcludedDates((items) => [...items, moveOriginalDate].sort())
      if (!includedDateTimes.includes(moveNewDateTime)) setIncludedDateTimes((items) => [...items, moveNewDateTime].sort())
      setMoveOriginalDate(''); setMoveNewDateTime('')
    }

    async function submit(event: FormEvent) {
      event.preventDefault(); setFormError(null)
      if (submittingRef.current) return
      if (!actionId) return setFormError(t('chooseAction'))
      if (!targets.length && !advancedTargetSelector?.conditions.length) return setFormError(t('chooseTargets'))
      if (kind === 'weekdays' && !weekdays.length) return setFormError(locale === 'it' ? 'Scegli almeno un giorno della settimana.' : 'Choose at least one weekday.')
      if (scheduleMode === 'after_completion' && kind !== 'interval') return setFormError(locale === 'it' ? 'La modalità dopo il completamento richiede un intervallo.' : 'After-completion mode requires an interval schedule.')
      if (!useAdvancedAssignment && ((assignmentMode === 'me' && !currentMember?.id) || (assignmentMode === 'member' && !memberId))) return setFormError(locale === 'it' ? 'Scegli una persona.' : 'Choose a person.')
      if (useAdvancedAssignment && advancedAssignment.memberIds.length === 0) return setFormError(locale === 'it' ? 'Seleziona almeno una persona idonea.' : 'Select at least one eligible person.')
      if (kind === 'once' && additionalActivities.length) return setFormError(t('additionalRecurringOnly'))
      if (additionalActivities.some((item) => !item.name.trim() || !item.actionId || !item.targetEntityIds.length || !Number.isInteger(item.every) || item.every < 1 || item.every > 100)) return setFormError(t('additionalValidation'))
      const action = actions.find((item) => item.id === actionId)
      const target = entities.find((item) => item.id === targets[0])
      const input = {
        affectsCleanliness, additionalActivities,
        name: name.trim() || `${action?.name ?? 'Action'} · ${target?.name ?? 'Target'}`,
        actionId, targetEntityIds: targets, includeDescendantTargetIds, advancedTargetSelector, recurrence, timeOfDay: time, scheduleMode,
        exceptions: { excludedDates, includedDateTimes }, assignment, reminder, careLevel, refreshLevelPct: Math.max(10, Math.min(100, refreshLevelPct)), supplyIdsOverride,
      }
      submittingRef.current = true
      setSubmitting(true)
      try {
        if (routine) await updateRoutine(routine.id, input); else await addRoutine(input)
        onClose()
      } catch (error) {
        logClientError(error, { area: routine ? 'update routine' : 'create routine' })
        setFormError(normalizeError(error))
      } finally {
        submittingRef.current = false
        setSubmitting(false)
      }
    }

    const selectedAction = actions.find((item) => item.id === actionId)
    return <Sheet title={routine ? t('edit') : t('addRoutine')} onClose={onClose}><form className="stack routine-builder" onSubmit={submit}>
      <section className="builder-step"><div className="step-number">1</div><div className="step-content"><h3>{t('what')}</h3><FormField label={t('action')}><select required value={actionId} onChange={(e) => setActionId(e.target.value)}>{actions.map((action) => <option value={action.id} key={action.id}>{action.name}</option>)}</select></FormField><FormField label={t('cleaningLevel')}><div className="care-level-choice"><button type="button" className={careLevel === 'routine' ? 'choice-card selected' : 'choice-card'} onClick={() => setCareLevel('routine')}><strong>{t('routineCleaning')}</strong><small>{t('routineCleaningHint')}</small></button><button type="button" className={careLevel === 'deep' ? 'choice-card selected deep-choice' : 'choice-card deep-choice'} onClick={() => setCareLevel('deep')}><strong>{t('deepCleaning')}</strong><small>{t('deepCleaningHint')}</small></button></div></FormField><FormField label={t('activityTitle')} hint={locale === 'it' ? 'Opzionale' : 'Optional'}><input value={name} onChange={(e) => setName(e.target.value)} /></FormField><label className="check-row cleanliness-toggle"><input type="checkbox" checked={affectsCleanliness} onChange={(event) => setAffectsCleanliness(event.target.checked)} /><span><strong>{t('affectsCleanliness')}</strong><small>{t('affectsCleanlinessHint')}</small></span></label></div></section>

      <section className="builder-step"><div className="step-number">2</div><div className="step-content"><h3>{t('where')}</h3><RoutineTargetPicker data={data!} targets={targets} includeDescendantTargetIds={includeDescendantTargetIds} onChange={(nextTargets, nextScopes) => { setTargets(nextTargets); setIncludeDescendantTargetIds(nextScopes) }} /></div></section>

      <section className="builder-step"><div className="step-number">3</div><div className="step-content"><h3>{t('when')}</h3>
        <div className="segmented two"><button type="button" className={scheduleMode === 'fixed' ? 'selected' : ''} onClick={() => setScheduleMode('fixed')}>{t('fixedCalendar')}</button><button type="button" className={scheduleMode === 'after_completion' ? 'selected' : ''} onClick={() => setScheduleMode('after_completion')}>{t('afterCompletion')}</button></div>
        {scheduleMode === 'fixed' && <div className="schedule-kind-grid"><button type="button" className={kind === 'once' ? 'choice-card selected' : 'choice-card'} onClick={() => setKind('once')}>{t('once')}</button><button type="button" className={kind === 'interval' ? 'choice-card selected' : 'choice-card'} onClick={() => setKind('interval')}>{t('interval')}</button><button type="button" className={kind === 'weekdays' ? 'choice-card selected' : 'choice-card'} onClick={() => setKind('weekdays')}>{t('weekdays')}</button><button type="button" className={kind === 'monthlyNth' ? 'choice-card selected' : 'choice-card'} onClick={() => setKind('monthlyNth')}>{t('monthlyPattern')}</button></div>}
        {kind === 'once' && <FormField label={t('date')}><input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} /></FormField>}
        {kind === 'interval' && <><div className="interval-row"><FormField label={t('every')}><input type="number" min={1} max={999} value={intervalValue} onChange={(e) => setIntervalValue(Number(e.target.value))} /></FormField><FormField label=""><select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}><option value="hour">{t('hours')}</option><option value="day">{t('days')}</option><option value="week">{t('weeks')}</option><option value="month">{t('months')}</option></select></FormField></div><FormField label={t('starts')}><input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></FormField></>}
        {kind === 'weekdays' && <><div className="weekday-row">{weekdayOrder.map((day) => <button type="button" key={day} className={weekdays.includes(day) ? 'weekday selected' : 'weekday'} onClick={() => setWeekdays(weekdays.includes(day) ? weekdays.filter((item) => item !== day) : [...weekdays, day])}>{t(weekdayKeys[day])}</button>)}</div><div className="interval-row"><FormField label={t('every')}><input type="number" min={1} max={52} value={weekInterval} onChange={(e) => setWeekInterval(Number(e.target.value))} /></FormField><span className="inline-unit">{t('weeks')}</span></div><FormField label={t('starts')}><input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></FormField></>}
        {kind === 'monthlyNth' && <><div className="two-columns"><FormField label={t('nthWeekday')}><select value={nthOrdinal} onChange={(e) => setNthOrdinal(Number(e.target.value) as 1 | 2 | 3 | 4 | -1)}>{ordinals.map((ordinal) => <option value={ordinal} key={ordinal}>{ordinal === 1 ? t('first') : ordinal === 2 ? t('second') : ordinal === 3 ? t('third') : ordinal === 4 ? t('fourth') : t('last')}</option>)}</select></FormField><FormField label=""><select value={nthWeekday} onChange={(e) => setNthWeekday(Number(e.target.value))}>{weekdayOrder.map((day) => <option value={day} key={day}>{t(weekdayKeys[day])}</option>)}</select></FormField></div><div className="interval-row"><FormField label={t('every')}><input type="number" min={1} max={24} value={monthInterval} onChange={(e) => setMonthInterval(Number(e.target.value))} /></FormField><span className="inline-unit">{t('months')}</span></div><FormField label={t('starts')}><input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></FormField></>}
        <FormField label={t('time')}><input type="time" required value={time} onChange={(e) => setTime(e.target.value)} /></FormField>
        <section className="preview"><h3>{t('nextTasks')}</h3>{preview.length ? <ol>{preview.map((dueAt) => <li key={dueAt}>{formatTaskDateTime(dueAt, locale, data!.workspace.timezone)}</li>)}</ol> : <p className="muted">—</p>}</section>
      </div></section>

      <section className="builder-step"><div className="step-number">4</div><div className="step-content"><h3>{t('who')}</h3>{!useAdvancedAssignment && <><div className="assignment-grid"><button type="button" className={assignmentMode === 'me' ? 'choice-card selected' : 'choice-card'} onClick={() => setAssignmentMode('me')}>{t('me')}</button><button type="button" disabled={!otherMembers.length} className={assignmentMode === 'member' ? 'choice-card selected' : 'choice-card'} onClick={() => setAssignmentMode('member')}>{t('otherMember')}</button><button type="button" disabled={activeMembers.length < 2} className={assignmentMode === 'alternate' ? 'choice-card selected' : 'choice-card'} onClick={() => setAssignmentMode('alternate')}>{t('alternate')}</button><button type="button" className={assignmentMode === 'everyone' ? 'choice-card selected' : 'choice-card'} onClick={() => setAssignmentMode('everyone')}>{t('everyone')}</button><button type="button" className={assignmentMode === 'unassigned' ? 'choice-card selected' : 'choice-card'} onClick={() => setAssignmentMode('unassigned')}>{t('anyone')}</button></div>{assignmentMode === 'member' && <FormField label={t('selectMember')}><select value={memberId} onChange={(e) => setMemberId(e.target.value)}>{otherMembers.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></FormField>}{assignmentMode === 'everyone' && <p className="notice compact-text">{t('everyoneHint')}</p>}{assignmentMode === 'unassigned' && <p className="muted compact-text">{t('unassignedHint')}</p>}</>}{useAdvancedAssignment && <div className="notice compact-text">{t('advancedAssignmentActive')}</div>}</div></section>

      <section className="builder-step"><div className="step-number">5</div><div className="step-content"><h3>{t('reminder')}</h3><select value={reminderChoice} onChange={(e) => setReminderChoice(e.target.value as ReminderChoice)}><option value="none">{t('noReminder')}</option><option value="at_due">{t('atDueTime')}</option><option value="30">{t('thirtyBefore')}</option><option value="60">{t('hourBefore')}</option><option value="custom">{t('customOffset')}</option><option value="previous_same">{t('previousDaySame')}</option><option value="previous_chosen">{t('previousDayAt')}</option></select>{reminderChoice === 'custom' && <div className="interval-row"><FormField label={t('customOffset')}><input type="number" min={1} max={999} value={customReminderAmount} onChange={(e) => setCustomReminderAmount(Number(e.target.value))} /></FormField><FormField label=""><select value={customReminderUnit} onChange={(e) => setCustomReminderUnit(e.target.value as ReminderOffsetUnit)}><option value="minute">{t('minutes')}</option><option value="hour">{t('hours')}</option><option value="day">{t('days')}</option></select></FormField><span className="inline-unit">{t('before')}</span></div>}{reminderChoice === 'previous_chosen' && <FormField label={t('time')}><input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></FormField>}<p className="muted compact-text">{assignmentMode === 'everyone' && !useAdvancedAssignment ? t('everyoneHint') : assignmentMode === 'unassigned' && !useAdvancedAssignment ? t('unassignedHint') : locale === 'it' ? 'La notifica viene inviata sui dispositivi abilitati della persona assegnata.' : 'The reminder is delivered to the assigned person’s enabled devices.'}</p></div></section>

      <section className="builder-step"><div className="step-number">6</div><div className="step-content"><h3>{t('supplies')}</h3><div className="segmented"><button type="button" className={supplyChoice === 'inherit' ? 'selected' : ''} onClick={() => setSupplyChoice('inherit')}>{t('inheritActionSupplies')}</button><button type="button" className={supplyChoice === 'custom' ? 'selected' : ''} onClick={() => setSupplyChoice('custom')}>{t('customSupplies')}</button><button type="button" className={supplyChoice === 'none' ? 'selected' : ''} onClick={() => setSupplyChoice('none')}>{t('noSupplyOverride')}</button></div>{supplyChoice === 'inherit' && <p className="muted compact-text">{(selectedAction?.defaultSupplyIds ?? []).map((id) => supplies.find((supply) => supply.id === id)?.name).filter(Boolean).join(', ') || '—'}</p>}{supplyChoice === 'custom' && <div className="check-list">{supplies.map((supply) => <label className="check-row" key={supply.id}><input type="checkbox" checked={customSupplyIds.includes(supply.id)} onChange={(e) => setCustomSupplyIds(e.target.checked ? [...customSupplyIds, supply.id] : customSupplyIds.filter((id) => id !== supply.id))} /><span>{supply.name}</span><small>{supply.status === 'out_of_stock' ? t('outOfStock') : supply.status === 'reserve_only' ? t('reserveOnly') : supply.status === 'low' ? t('low') : t('available')}</small></label>)}</div>}</div></section>

      <section className="builder-step"><div className="step-number">7</div><div className="step-content"><h3>{t('additionalActivities')}</h3>{kind === 'once' ? <p className="notice">{t('additionalRecurringOnly')}</p> : <AdditionalActivitiesBuilder data={data!} value={additionalActivities} onChange={setAdditionalActivities} defaultTargets={targets} />}</div></section>

      <details className="advanced-details"><summary>8 · {t('moreOptions')}</summary><div className="stack detail-body">
        <section className="advanced-option-section refresh-option"><div className="section-header"><div><strong>{t('refreshTo')}</strong><small>{t('refreshToHint')}</small></div><strong>{Math.round(refreshLevelPct)}%</strong></div><input aria-label={t('refreshTo')} type="range" min={10} max={100} step={5} value={refreshLevelPct} onChange={(event) => setRefreshLevelPct(Number(event.target.value))} /><FormField label={t('refreshTo')} hint={t('refreshToExamples')}><input type="number" min={10} max={100} step={5} value={refreshLevelPct} onChange={(event) => setRefreshLevelPct(Number(event.target.value))} /></FormField></section>
        <section className="advanced-option-section"><div className="section-header"><div><strong>{t('advancedTargets')}</strong><small>{t('advancedTargetsHint')}</small></div></div><AdvancedTargetBuilder data={data!} value={advancedTargetSelector} onChange={setAdvancedTargetSelector} /></section>
        <section className="advanced-option-section"><div className="section-header"><div><strong>{t('advancedAssignment')}</strong><small>{t('advancedAssignmentHint')}</small></div><label className="switch-label"><input type="checkbox" checked={useAdvancedAssignment} onChange={(event) => setUseAdvancedAssignment(event.target.checked)} />{t('useAdvanced')}</label></div>{useAdvancedAssignment && <AdvancedAssignmentBuilder members={activeMembers} value={advancedAssignment} onChange={setAdvancedAssignment} />}</section>
        <section className="advanced-option-section"><RoutineSimulation data={data!} routine={previewRoutine} /></section>
        {scheduleMode === 'fixed' ? <><div className="exception-block"><strong>{t('skipDate')}</strong><div className="inline-form"><input type="date" value={skipDateValue} onChange={(e) => setSkipDateValue(e.target.value)} /><button type="button" className="button secondary small" onClick={addSkipDate}>+</button></div><div className="chip-list">{excludedDates.map((date) => <span className="chip" key={date}>{date}<button type="button" onClick={() => setExcludedDates(excludedDates.filter((item) => item !== date))}>×</button></span>)}</div></div>
        <div className="exception-block"><strong>{t('addDate')}</strong><div className="inline-form"><input type="datetime-local" value={extraDateTime} onChange={(e) => setExtraDateTime(e.target.value)} /><button type="button" className="button secondary small" onClick={addExtraDate}>+</button></div><div className="chip-list">{includedDateTimes.map((value) => <span className="chip" key={value}>{value.replace('T', ' ')}<button type="button" onClick={() => setIncludedDateTimes(includedDateTimes.filter((item) => item !== value))}>×</button></span>)}</div></div>
        <div className="exception-block"><strong>{t('moveDate')}</strong><div className="two-columns"><FormField label={t('originalDate')}><input type="date" value={moveOriginalDate} onChange={(e) => setMoveOriginalDate(e.target.value)} /></FormField><FormField label={t('newDateTime')}><input type="datetime-local" value={moveNewDateTime} onChange={(e) => setMoveNewDateTime(e.target.value)} /></FormField></div><button type="button" className="button secondary small align-start" onClick={addMove}>{t('moveDate')}</button></div></> : <p className="muted compact-text">{locale === 'it' ? 'Le eccezioni di calendario sono disponibili per le routine a calendario fisso.' : 'Calendar exceptions apply to fixed-calendar routines.'}</p>}
      </div></details>

      {formError && <div className="error-banner">{formError}</div>}
      <button className="button primary" disabled={submitting}>{submitting ? t('saving') : t('save')}</button>
    </form></Sheet>
  }

  function scheduleText(rule: RecurrenceRule) {
    if (rule.kind === 'once') return rule.date
    if (rule.kind === 'daily') return `${t('every')} ${rule.interval} ${t('days')}`
    if (rule.kind === 'interval') {
      const unit = rule.unit === 'hour' ? t('hours') : rule.unit === 'day' ? t('days') : rule.unit === 'week' ? t('weeks') : t('months')
      return `${t('every')} ${rule.interval} ${unit}`
    }
    if (rule.kind === 'weekdays') return `${rule.weekdays.map((day) => t(weekdayKeys[day])).join(', ')} · ${t('every')} ${rule.intervalWeeks} ${t('weeks')}`
    const ordinal = rule.ordinal === 1 ? t('first') : rule.ordinal === 2 ? t('second') : rule.ordinal === 3 ? t('third') : rule.ordinal === 4 ? t('fourth') : t('last')
    return `${ordinal} ${t(weekdayKeys[rule.weekday])} · ${t('every')} ${rule.intervalMonths} ${t('months')}`
  }

  function assignmentText(policy: AssignmentPolicy) {
    if (policy.mode === 'unassigned') return t('anyone')
    if (policy.mode === 'everyone') return t('everyone')
    if (policy.mode === 'alternate') return t('alternate')
    if (policy.mode === 'advanced') return `${t('advanced')} · ${t(policy.strategy === 'round_robin' ? 'roundRobin' : policy.strategy === 'least_recent' ? 'leastRecent' : policy.strategy === 'weighted' ? 'weightedRotation' : 'workloadAware')}`
    return data!.members.find((member) => member.id === policy.memberId)?.displayName ?? t('anyone')
  }
}
