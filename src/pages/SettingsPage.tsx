import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { FormField } from '../components/FormField'
import { Sheet } from '../components/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { createHouseholdBackup, parseHouseholdBackup } from '../lib/backup'
import { currentPushCapability, disablePush, enablePush, type PushCapability } from '../lib/push'
import { isStandalone, promptInstall } from '../lib/pwa'
import type { CareSensitivity, MetadataFieldDefinition, MetadataFieldType, MetadataTarget, WorkspaceMember } from '../types/domain'
import { dateTimeLocalValue, localInputToUtc } from '../lib/date'
import { ErrorLogPanel } from '../components/ErrorLogPanel'
import { logClientError, normalizeError } from '../lib/errorLog'

export function SettingsPage() {
  const { data, currentMember, addMember, updateMemberAssignmentProfile, updateWorkspace, applyStarterPack, addFieldDefinition, updateFieldDefinition, archiveFieldDefinition, importBackup, resetLocal } = useData()
  const location = useLocation()
  const { isCloud, signOut } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [memberOpen, setMemberOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null)
  const [editingField, setEditingField] = useState<MetadataFieldDefinition | null>(null)
  const [houseName, setHouseName] = useState(data?.workspace.name ?? '')
  const [timezone, setTimezone] = useState(data?.workspace.timezone ?? 'Europe/Rome')
  const [careSensitivity, setCareSensitivity] = useState<CareSensitivity>(data?.workspace.careSensitivity ?? 'balanced')
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [pushCapability, setPushCapability] = useState<PushCapability>('unsupported')
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [installAvailable, setInstallAvailable] = useState(() => Boolean(window.__houseCareInstallPrompt))
  const [standalone, setStandalone] = useState(() => isStandalone())
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refreshPush = () => { void currentPushCapability(isCloud).then(setPushCapability) }
    refreshPush()
    const refreshInstall = () => { setInstallAvailable(Boolean(window.__houseCareInstallPrompt)); setStandalone(isStandalone()) }
    window.addEventListener('housecare:install-available', refreshInstall)
    window.addEventListener('housecare:installed', refreshInstall)
    window.addEventListener('housecare:sw-ready', refreshPush)
    return () => { window.removeEventListener('housecare:install-available', refreshInstall); window.removeEventListener('housecare:installed', refreshInstall); window.removeEventListener('housecare:sw-ready', refreshPush) }
  }, [isCloud])

  if (!data) return null
  const canManageHousehold = currentMember?.role === 'owner'
  const fields = data.fieldDefinitions.filter((item) => !item.archivedAt)

  async function togglePush() {
    if (!currentMember) return
    setPushMessage(null)
    try {
      if (pushCapability === 'subscribed') await disablePush()
      else await enablePush(data!.workspace.id, currentMember.id)
      setPushCapability(await currentPushCapability(isCloud))
    } catch (err) { logClientError(err, { area: 'notification settings' }); setPushMessage(normalizeError(err)); setPushCapability(await currentPushCapability(isCloud)) }
  }

  async function installApp() {
    const installed = await promptInstall()
    setStandalone(installed || isStandalone())
    setInstallAvailable(Boolean(window.__houseCareInstallPrompt))
  }

  async function saveHousehold(event: FormEvent) {
    event.preventDefault()
    await updateWorkspace({ name: houseName.trim(), timezone: timezone.trim(), careSensitivity })
  }

  function exportBackup() {
    const backup = createHouseholdBackup(data!)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `house-care-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href)
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canManageHousehold) return
    setBackupMessage(null)
    try {
      const backup = parseHouseholdBackup(await file.text())
      if (!confirm(t('importWarning'))) return
      await importBackup(backup)
      setHouseName(backup.data.workspace.name)
      setTimezone(backup.data.workspace.timezone)
      setCareSensitivity(backup.data.workspace.careSensitivity ?? 'balanced')
      setBackupMessage(t('importSuccess'))
    } catch (err) {
      logClientError(err, { area: 'import backup file' })
      setBackupMessage(normalizeError(err))
    }
  }

  function targetLabel(target: MetadataTarget) {
    return target === 'entity' ? t('entitiesTarget') : target === 'action' ? t('actionsTarget') : t('suppliesTarget')
  }

  return <div className="stack page-stack">
    <header className="page-title-row"><div><div className="eyebrow">{t('settings')}</div><h1>{t('settings')}</h1></div></header>
    <section className="card section-card"><div className="section-header"><h2>{t('household')}</h2></div><form className="stack" onSubmit={saveHousehold}><FormField label={t('householdName')}><input disabled={!canManageHousehold} value={houseName} onChange={(e) => setHouseName(e.target.value)} /></FormField><FormField label={t('timezone')} hint="IANA · Europe/Rome"><input disabled={!canManageHousehold} value={timezone} onChange={(e) => setTimezone(e.target.value)} /></FormField><FormField label={t('careSensitivity')} hint={t('careSensitivityHint')}><select disabled={!canManageHousehold} value={careSensitivity} onChange={(event) => setCareSensitivity(event.target.value as CareSensitivity)}><option value="relaxed">{t('relaxed')}</option><option value="balanced">{t('balanced')}</option><option value="strict">{t('strict')}</option></select></FormField><button disabled={!canManageHousehold} className="button secondary align-start">{t('save')}</button></form></section>

    <section className="card section-card"><div className="section-header"><h2>{t('people')}</h2><button disabled={!canManageHousehold} className="button secondary small" onClick={() => setMemberOpen(true)}>+ {t('addPerson')}</button></div><div className="people-list">{data.members.map((member) => <div className="person-row" key={member.id}><div><strong>{member.displayName}</strong><small>{member.email || '—'}{member.labels.length ? ` · ${member.labels.join(', ')}` : ''}</small>{member.unavailableUntil && <small>{t('unavailableUntil')} · {new Date(member.unavailableUntil).toLocaleString()}</small>}</div><div className="person-tags"><span className="status">{t(member.role)}</span>{member.status === 'invited' && <span className="status warn">invited</span>}{canManageHousehold && <button className="icon-button" onClick={() => setEditingMember(member)}>{t('assignmentProfile')}</button>}</div></div>)}</div>{isCloud && <p className="muted compact-text">{locale === 'it' ? 'Per collegare il secondo account, usa qui la sua email esatta.' : 'For a linked second account, add their exact email here.'}</p>}</section>

    <section className="card section-card"><div className="section-header"><h2>{t('customFields')}</h2><button className="button secondary small" onClick={() => { setEditingField(null); setFieldOpen(true) }}>+ {t('addField')}</button></div>{fields.length === 0 ? <p className="muted compact-text">{locale === 'it' ? 'Opzionale. Aggiungi campi solo quando servono.' : 'Optional. Add fields only when you need them.'}</p> : <div className="field-definition-list">{fields.map((field) => <div className="definition-row" key={field.id}><div><strong>{field.name}</strong><small>{targetLabel(field.target)} · {t(field.fieldType === 'multi_choice' ? 'multiChoice' : field.fieldType as 'text' | 'number' | 'boolean' | 'choice')}</small></div><div className="row-actions"><button className="icon-button" onClick={() => { setEditingField(field); setFieldOpen(true) }}>{t('edit')}</button><button className="icon-button danger-text" onClick={() => void archiveFieldDefinition(field.id)}>{t('archive')}</button></div></div>)}</div>}</section>

    <section className="card section-card"><div className="section-header"><h2>{t('starterPack')}</h2></div><p className="muted compact-text">{t('starterPackHint')}</p><button className="button secondary" disabled={!canManageHousehold || data.entityTypes.some((item) => !item.archivedAt) || data.entities.some((item) => !item.archivedAt) || data.actions.some((item) => !item.archivedAt) || data.supplies.some((item) => !item.archivedAt) || data.layoutScenes.some((item) => !item.archivedAt)} onClick={() => { if (confirm(t('starterPackConfirm'))) void applyStarterPack(locale) }}>{t('loadStarterPack')}</button></section>

    <section className="card section-card"><h2>{t('language')}</h2><div className="segmented two"><button className={locale === 'en' ? 'selected' : ''} onClick={() => setLocale('en')}>{t('english')}</button><button className={locale === 'it' ? 'selected' : ''} onClick={() => setLocale('it')}>{t('italian')}</button></div></section>

    <section className="card section-card"><div className="section-header"><h2>{t('notifications')}</h2></div><p className="muted compact-text">{pushCapability === 'cloud_required' ? t('pushNeedsCloud') : pushCapability === 'unsupported' ? t('pushUnsupported') : pushCapability === 'blocked' ? t('pushBlocked') : t('pushHint')}</p>{pushCapability !== 'cloud_required' && pushCapability !== 'unsupported' && pushCapability !== 'blocked' && <button className="button secondary" onClick={() => void togglePush()}>{pushCapability === 'subscribed' ? t('disableOnDevice') : t('enableOnDevice')}</button>}{pushMessage && <div className="error-banner">{pushMessage}</div>}</section>

    <section className="card section-card"><div className="section-header"><h2>{t('installApp')}</h2></div><p className="muted compact-text">{standalone ? t('appInstalled') : installAvailable ? t('installHint') : t('installManualHint')}</p>{!standalone && installAvailable && <button className="button secondary" onClick={() => void installApp()}>{t('installApp')}</button>}</section>

    <section className="card section-card"><div className="section-header"><h2>{t('backup')}</h2></div><p className="muted compact-text">{t('importWarning')}</p><div className="backup-actions"><button className="button secondary" onClick={exportBackup}>{t('exportJson')}</button><button className="button secondary" disabled={!canManageHousehold} onClick={() => importRef.current?.click()}>{t('importJson')}</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event)} /></div>{backupMessage && <div className={backupMessage === t('importSuccess') ? 'notice' : 'error-banner'}>{backupMessage}</div>}</section>

    <ErrorLogPanel autoOpen={new URLSearchParams(location.search).get('errors') === '1'} />

    <section className="card section-card"><h2>{isCloud ? t('cloudMode') : t('localMode')}</h2>{isCloud ? <button className="button secondary" onClick={() => void signOut()}>{t('signOut')}</button> : <button className="button danger-outline" onClick={() => { if (confirm(t('confirmReset'))) resetLocal() }}>{t('resetLocal')}</button>}</section>
    {memberOpen && <MemberSheet onClose={() => setMemberOpen(false)} />}
    {editingMember && <MemberAssignmentSheet member={editingMember} onClose={() => setEditingMember(null)} />}
    {fieldOpen && <FieldSheet field={editingField} onClose={() => { setFieldOpen(false); setEditingField(null) }} />}
  </div>

  function MemberSheet({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    async function submit(event: FormEvent) { event.preventDefault(); await addMember(name.trim(), email.trim() || undefined); onClose() }
    return <Sheet title={t('addPerson')} onClose={onClose}><form className="stack" onSubmit={submit}><FormField label={t('name')}><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></FormField><FormField label={t('emailOptional')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField><button className="button primary">{t('save')}</button></form></Sheet>
  }

  function MemberAssignmentSheet({ member, onClose }: { member: WorkspaceMember; onClose: () => void }) {
    const [labels, setLabels] = useState(member.labels.join(', '))
    const [unavailableUntil, setUnavailableUntil] = useState(member.unavailableUntil ? dateTimeLocalValue(member.unavailableUntil, data!.workspace.timezone) : '')
    async function submit(event: FormEvent) {
      event.preventDefault()
      await updateMemberAssignmentProfile(member.id, labels.split(',').map((item) => item.trim()).filter(Boolean), unavailableUntil ? localInputToUtc(unavailableUntil, data!.workspace.timezone) : undefined)
      onClose()
    }
    return <Sheet title={t('assignmentProfile')} onClose={onClose}><form className="stack" onSubmit={submit}><p className="muted compact-text">{t('assignmentProfileHint')}</p><FormField label={t('memberLabels')} hint={t('commaSeparated')}><input value={labels} onChange={(event) => setLabels(event.target.value)} /></FormField><FormField label={t('unavailableUntil')}><input type="datetime-local" value={unavailableUntil} onChange={(event) => setUnavailableUntil(event.target.value)} /></FormField><button className="button primary">{t('save')}</button></form></Sheet>
  }

  function FieldSheet({ field, onClose }: { field: MetadataFieldDefinition | null; onClose: () => void }) {
    const [name, setName] = useState(field?.name ?? '')
    const [target, setTarget] = useState<MetadataTarget>(field?.target ?? 'entity')
    const [fieldType, setFieldType] = useState<MetadataFieldType>(field?.fieldType ?? 'text')
    const [options, setOptions] = useState(field?.options.join(', ') ?? '')
    async function submit(event: FormEvent) {
      event.preventDefault()
      const input = { target, name: name.trim(), fieldType, options: (fieldType === 'choice' || fieldType === 'multi_choice') ? options.split(',').map((item) => item.trim()).filter(Boolean) : [] }
      if (field) await updateFieldDefinition(field.id, input); else await addFieldDefinition(input)
      onClose()
    }
    return <Sheet title={field ? t('edit') : t('addField')} onClose={onClose}><form className="stack" onSubmit={submit}><FormField label={t('name')}><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></FormField><FormField label={t('fieldTarget')}><select value={target} onChange={(event) => setTarget(event.target.value as MetadataTarget)}><option value="entity">{t('entitiesTarget')}</option><option value="action">{t('actionsTarget')}</option><option value="supply">{t('suppliesTarget')}</option></select></FormField><FormField label={t('fieldType')}><select value={fieldType} onChange={(event) => setFieldType(event.target.value as MetadataFieldType)}><option value="text">{t('text')}</option><option value="number">{t('number')}</option><option value="boolean">{t('boolean')}</option><option value="choice">{t('choice')}</option><option value="multi_choice">{t('multiChoice')}</option></select></FormField>{(fieldType === 'choice' || fieldType === 'multi_choice') && <FormField label={t('options')} hint={locale === 'it' ? 'Separate da virgole' : 'Comma separated'}><input value={options} onChange={(event) => setOptions(event.target.value)} /></FormField>}<button className="button primary">{t('save')}</button></form></Sheet>
  }
}
