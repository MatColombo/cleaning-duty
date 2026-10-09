import { useState, type FormEvent } from 'react'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { FormField } from '../components/FormField'
import { V2BrandLockup } from '../components/brand/V2BrandLockup'
import { SvgCharacter } from '../visual/SvgCharacter'

export function SetupPage() {
  const { createWorkspace, workspaces, online, restoreWorkspace, deleteWorkspace } = useData()
  const { t } = useI18n()
  const [name, setName] = useState('Home')
  const [ownerName, setOwnerName] = useState('')
  const [busyId, setBusyId] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'
  const archived = workspaces.filter((item) => item.archivedAt)

  async function submit(event: FormEvent) {
    event.preventDefault()
    await createWorkspace(name.trim(), ownerName.trim(), timezone)
  }

  async function restore(id: string) {
    setBusyId(id)
    try { await restoreWorkspace(id) } finally { setBusyId('') }
  }

  async function remove(id: string, workspaceName: string) {
    const typed = window.prompt(`${t('deleteHomeConfirm')}\n\n${t('typeHomeName')}: ${workspaceName}`)
    if (typed !== workspaceName) return
    setBusyId(id)
    try { await deleteWorkspace(id) } finally { setBusyId('') }
  }

  return <main className="center-page setup-page v2-entry-page">
    <div className="setup-cards">
      {archived.length > 0 && <section className="card auth-card stack v2-entry-card">
        <header className="v2-entry-head"><div><V2BrandLockup compact /><h1 className="hc-display">{t('archivedHomes')}</h1></div></header>
        <div className="workspace-list archived-workspaces">{archived.map((workspace) => <div className="workspace-row archived" key={workspace.id}>
          <div className="workspace-open static"><span><strong>{workspace.name}</strong><small>{t('archived')}</small></span></div>
          {workspace.role === 'owner' && <div className="workspace-archive-actions">
            <button className="button secondary small" disabled={!online || busyId === workspace.id} onClick={() => void restore(workspace.id)}>{t('restore')}</button>
            <button className="button danger-outline small" disabled={!online || busyId === workspace.id} onClick={() => void remove(workspace.id, workspace.name)}>{t('deletePermanently')}</button>
          </div>}
        </div>)}</div>
      </section>}
      <form className="card auth-card stack v2-entry-card" onSubmit={submit}>
        <header className="v2-entry-head"><div><V2BrandLockup /><h1 className="hc-display">{t('setupTitle')}</h1><p className="muted">{t('setupHint')}</p></div><span className="v2-entry-art" aria-hidden="true"><SvgCharacter id="house" expression="smile" decorative pose="wave" misregistration={false} /></span></header>
        <FormField label={t('householdName')}><input required value={name} onChange={(e) => setName(e.target.value)} /></FormField>
        <FormField label={t('yourName')}><input required autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></FormField>
        <button className="button primary">{t('createHousehold')}</button>
      </form>
    </div>
  </main>
}
