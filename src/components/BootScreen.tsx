import { useEffect, useMemo, useState } from 'react'
import type { TranslationKey } from '../lib/translations'
import { useI18n } from '../contexts/I18nContext'

const phraseKeys = [
  'loadingPhrase01', 'loadingPhrase02', 'loadingPhrase03', 'loadingPhrase04', 'loadingPhrase05', 'loadingPhrase06',
  'loadingPhrase07', 'loadingPhrase08', 'loadingPhrase09', 'loadingPhrase10', 'loadingPhrase11', 'loadingPhrase12',
  'loadingPhrase13', 'loadingPhrase14', 'loadingPhrase15', 'loadingPhrase16', 'loadingPhrase17', 'loadingPhrase18',
] as const satisfies readonly TranslationKey[]

export function BootScreen({ exiting = false }: { exiting?: boolean }) {
  const { t } = useI18n()
  const phrases = useMemo(() => phraseKeys.map((key) => t(key)), [t])
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Date.now() / 1000) % phraseKeys.length)

  useEffect(() => {
    const timer = window.setInterval(() => setPhraseIndex((current) => (current + 1) % phrases.length), 1150)
    return () => window.clearInterval(timer)
  }, [phrases.length])

  return <div className={`boot-screen${exiting ? ' boot-exiting' : ''}`} role="status" aria-live="polite" aria-label={t('loadingApp')}>
    <div className="boot-ambient boot-ambient-one" aria-hidden="true" />
    <div className="boot-ambient boot-ambient-two" aria-hidden="true" />
    <div className="boot-content">
      <div className="boot-logo-stage" aria-hidden="true">
        <div className="boot-spinner" />
        <div className="boot-logo-shell"><img src="/icon.svg" alt="" /></div>
      </div>
      <div className="boot-wordmark" aria-hidden="true"><span>House</span><strong>Care</strong><i>✦</i></div>
      <div className="boot-phrase" key={`${phraseIndex}-${phrases[phraseIndex]}`}>
        <span className="boot-phrase-dot" aria-hidden="true">✦</span>
        <span>{phrases[phraseIndex]}</span>
      </div>
      <div className="boot-loading-label">{t('loadingApp')}</div>
    </div>
  </div>
}
