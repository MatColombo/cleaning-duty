import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { Sheet } from './Sheet'
import { FormField } from './FormField'
import { logClientError, normalizeError } from '../lib/errorLog'

export function WorkspaceSwitcher() {
  const { isCloud, user } = useAuth()
  const { data, workspaces, online, saving, switchWorkspace, archiveWorkspace, restoreWorkspace, deleteWorkspace, createWorkspace } = useData()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState('')

  const active = useMemo(() => workspaces.filter((item) => !item.archivedAt), [workspaces])
  const archived = useMemo(() => workspaces.filter((item) => item.archivedAt), [workspaces])

  if (!isCloud) return <strong>{data?.workspace.name ?? 'House Care'}</strong>

  async function run(workspaceId: string, action: () => Promise<void>, closeAfter = false) {
    setBusyId(workspaceId)
    try {
      await action()
      if (closeAfter) setOpen(false)
    } catch (err) {
      logClientError(err, { area: 'home management' })
      window.alert(normalizeError(err))
    } finally { setBusyId('') }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name || !user) return
    setCreating(true)
    try {
      await createWorkspace(name, user.displayName, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome')
      setNewName('')
      setOpen(false)
    } catch (err) {
      logClientError(err, { area: 'create home' })
      window.alert(normalizeError(err))
    } finally { setCreating(false) }
  }

  async function archive(id: string, name: string) {
    if (!window.confirm(`${t('archiveHomeConfirm')} “${name}”?`)) return
    await run(id, () => archiveWorkspace(id), true)
  }

  async function removePermanently(id: string, name: string) {
    const typed = window.prompt(`${t('deleteHomeConfirm')}\n\n${t('typeHomeName')}: ${name}`)
    if (typed !== name) return
    await run(id, () => deleteWorkspace(id))
  }

  return <>
    <button className="workspace-trigger" type="button" onClick={() => setOpen(true)} aria-label={t('switchHome')}>
      <strong>{data?.workspace.name ?? t('chooseHome')}</strong><span aria-hidden="true">⌄</span>
    </button>
    {open && <Sheet title={t('homes')} onClose={() => setOpen(false)}>
      <div className="stack workspace-switcher-sheet">
        <section>
          <div className="section-header"><h3>{t('activeHomes')}</h3><span className="count-pill small-pill">{active.length}</span></div>
          <div className="workspace-list">
            {active.map((workspace) => {
              const current = workspace.id === data?.workspace.id
              const owner = workspace.role === 'owner'
              return <div className={`workspace-row${current ? ' current' : ''}`} key={workspace.id}>
                <button className="workspace-open" type="button" disabled={current || busyId === workspace.id || saving} onClick={() => void run(workspace.id, () => switchWorkspace(workspace.id), true)}>
                  <span><strong>{workspace.name}</strong><small>{current ? t('currentHome') : workspace.role === 'owner' ? t('owner') : t('member')}</small></span>
                  {!current && <span aria-hidden="true">›</span>}
                </button>
                {owner && <button className="icon-button danger-text workspace-row-action" type="button" disabled={!online || busyId === workspace.id || saving} onClick={() => void archive(workspace.id, workspace.name)}>{t('archive')}</button>}
              </div>
            })}
          </div>
        </section>

        {archived.length > 0 && <section>
          <button className="archived-toggle" type="button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? '▾' : '▸'} {t('archivedHomes')} ({archived.length})</button>
          {showArchived && <div className="workspace-list archived-workspaces">{archived.map((workspace) => <div className="workspace-row archived" key={workspace.id}>
            <div className="workspace-open static"><span><strong>{workspace.name}</strong><small>{t('archived')}</small></span></div>
            {workspace.role === 'owner' && <div className="workspace-archive-actions">
              <button className="button secondary small" type="button" disabled={!online || busyId === workspace.id} onClick={() => void run(workspace.id, () => restoreWorkspace(workspace.id))}>{t('restore')}</button>
              <button className="button danger-outline small" type="button" disabled={!online || busyId === workspace.id} onClick={() => void removePermanently(workspace.id, workspace.name)}>{t('deletePermanently')}</button>
            </div>}
          </div>)}</div>}
        </section>}

        <details className="advanced-details create-home-details">
          <summary>+ {t('createAnotherHome')}</summary>
          <form className="stack detail-body" onSubmit={create}>
            <FormField label={t('householdName')}><input required value={newName} onChange={(event) => setNewName(event.target.value)} /></FormField>
            <button className="button primary" disabled={!online || creating}>{creating ? t('saving') : t('createHousehold')}</button>
          </form>
        </details>
        {!online && <p className="muted compact-text">{t('homeManagementOnline')}</p>}
      </div>
    </Sheet>}
  </>
}
