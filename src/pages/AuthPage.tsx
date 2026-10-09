import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { FormField } from '../components/FormField'
import { V2BrandLockup } from '../components/brand/V2BrandLockup'
import { SvgCharacter } from '../visual/SvgCharacter'
import { logClientError, normalizeError } from '../lib/errorLog'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage(null)
    try {
      if (mode === 'signin') await signIn(email, password)
      else setMessage(await signUp(email, password))
    } catch (error) { logClientError(error, { area: mode === 'signin' ? 'sign in' : 'sign up' }); setMessage(normalizeError(error)) }
    finally { setBusy(false) }
  }

  return <main className="center-page v2-entry-page">
    <form className="card auth-card stack v2-entry-card" onSubmit={submit}>
      <header className="v2-entry-head"><div><V2BrandLockup /><h1 className="hc-display">{mode === 'signin' ? t('signIn') : t('signUp')}</h1></div><span className="v2-entry-art" aria-hidden="true"><SvgCharacter id="house" expression="smile" decorative pose="wave" misregistration={false} /></span></header>
      <FormField label={t('email')}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></FormField>
      <FormField label={t('password')}><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></FormField>
      {message && <div className="notice">{message}</div>}
      <button className="button primary" disabled={busy}>{mode === 'signin' ? t('signIn') : t('signUp')}</button>
      <button type="button" className="button ghost" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? t('signUp') : t('signIn')}</button>
    </form>
  </main>
}
