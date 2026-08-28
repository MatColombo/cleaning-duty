import { useState, type FormEvent } from 'react'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { FormField } from '../components/FormField'

export function SetupPage() {
  const { createWorkspace } = useData()
  const { t } = useI18n()
  const [name, setName] = useState('Home')
  const [ownerName, setOwnerName] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'
  async function submit(event: FormEvent) {
    event.preventDefault()
    await createWorkspace(name.trim(), ownerName.trim(), timezone)
  }
  return <main className="center-page">
    <form className="card auth-card stack" onSubmit={submit}>
      <div><div className="eyebrow">House Care</div><h1>{t('setupTitle')}</h1><p className="muted">{t('setupHint')}</p></div>
      <FormField label={t('householdName')}><input required value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label={t('yourName')}><input required autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></FormField>
      <button className="button primary">{t('createHousehold')}</button>
    </form>
  </main>
}
