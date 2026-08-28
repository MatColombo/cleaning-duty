import type { AdvancedAssignmentPolicy, WorkspaceMember } from '../types/domain'
import { useI18n } from '../contexts/I18nContext'

export function defaultAdvancedAssignment(members: WorkspaceMember[]): AdvancedAssignmentPolicy {
  return { mode: 'advanced', strategy: 'round_robin', memberIds: members.filter((member) => member.status === 'active').map((member) => member.id), requiredMemberLabels: [], excludeUnavailable: true, weights: {} }
}

export function AdvancedAssignmentBuilder({ members, value, onChange }: { members: WorkspaceMember[]; value: AdvancedAssignmentPolicy; onChange: (value: AdvancedAssignmentPolicy) => void }) {
  const { t, locale } = useI18n()
  const active = members.filter((member) => member.status === 'active')
  const allLabels = [...new Set(active.flatMap((member) => member.labels))].sort((a, b) => a.localeCompare(b))
  const selectedIds = value.memberIds.length ? value.memberIds : active.map((member) => member.id)

  return <div className="advanced-rule-box stack">
    <p className="muted compact-text">{locale === 'it' ? 'Opzionale. Filtra prima le persone idonee, poi scegli come distribuire il lavoro.' : 'Optional. First filter eligible people, then choose how work is distributed.'}</p>
    <label className="field"><span>{t('assignmentStrategy')}</span><select value={value.strategy} onChange={(event) => onChange({ ...value, strategy: event.target.value as AdvancedAssignmentPolicy['strategy'] })}><option value="round_robin">{t('roundRobin')}</option><option value="least_recent">{t('leastRecent')}</option><option value="weighted">{t('weightedRotation')}</option><option value="workload">{t('workloadAware')}</option></select></label>
    <div><strong>{t('eligiblePeople')}</strong><div className="check-list compact">{active.map((member) => <label className="check-row" key={member.id}><input type="checkbox" checked={selectedIds.includes(member.id)} onChange={(event) => {
      const next = event.target.checked ? [...new Set([...selectedIds, member.id])] : selectedIds.filter((id) => id !== member.id)
      onChange({ ...value, memberIds: next })
    }} /><span>{member.displayName}</span>{member.unavailableUntil && <small>{t('unavailableUntil')} · {new Date(member.unavailableUntil).toLocaleString()}</small>}</label>)}</div></div>
    <label className="field"><span>{t('requiredLabels')}</span><input list="member-labels" value={value.requiredMemberLabels.join(', ')} placeholder={locale === 'it' ? 'es. bagno, pesante' : 'e.g. bathroom, heavy'} onChange={(event) => onChange({ ...value, requiredMemberLabels: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
    <datalist id="member-labels">{allLabels.map((label) => <option value={label} key={label} />)}</datalist>
    <label className="inline-check"><input type="checkbox" checked={value.excludeUnavailable} onChange={(event) => onChange({ ...value, excludeUnavailable: event.target.checked })} />{t('excludeUnavailable')}</label>
    {value.strategy === 'weighted' && <div className="weight-grid"><strong>{t('weights')}</strong>{active.filter((member) => selectedIds.includes(member.id)).map((member) => <label key={member.id}><span>{member.displayName}</span><input type="number" min={1} max={20} value={value.weights[member.id] ?? 1} onChange={(event) => onChange({ ...value, weights: { ...value.weights, [member.id]: Math.max(1, Number(event.target.value) || 1) } })} /></label>)}</div>}
  </div>
}
