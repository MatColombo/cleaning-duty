import { useState, type FormEvent } from 'react'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { FormField } from '../components/FormField'

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

  return <main className="center-page setup-page">
    <div className="setup-cards">
      {archived.length > 0 && <section className="card auth-card stack">
        <div><div className="eyebrow">House Care</div><h1>{t('archivedHomes')}</h1></div>
        <div className="workspace-list archived-workspaces">{archived.map((workspace) => <div className="workspace-row archived" key={workspace.id}>
          <div className="workspace-open static"><span><strong>{workspace.name}</strong><small>{t('archived')}</small></span></div>
          {workspace.role === 'owner' && <div className="workspace-archive-actions">
            <button className="button secondary small" disabled={!online || busyId === workspace.id} onClick={() => void restore(workspace.id)}>{t('restore')}</button>
            <button className="button danger-outline small" disabled={!online || busyId === workspace.id} onClick={() => void remove(workspace.id, workspace.name)}>{t('deletePermanently')}</button>
          </div>}
        </div>)}</div>
      </section>}
      <form className="card auth-card stack" onSubmit={submit}>
        <div><div className="eyebrow">House Care</div><h1>{t('setupTitle')}</h1><p className="muted">{t('setupHint')}</p></div>
        <FormField label={t('householdName')}><input required value={name} onChange={(e) => setName(e.target.value)} /></FormField>
        <FormField label={t('yourName')}><input required autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></FormField>
        <button className="button primary">{t('createHousehold')}</button>
      </form>
    </div>
  </main>
}
