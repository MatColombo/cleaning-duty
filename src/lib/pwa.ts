export interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __houseCareInstallPrompt?: DeferredInstallPrompt
  }
}

export function registerInstallPromptCapture() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    window.__houseCareInstallPrompt = event as DeferredInstallPrompt
    window.dispatchEvent(new Event('housecare:install-available'))
  })
  window.addEventListener('appinstalled', () => {
    window.__houseCareInstallPrompt = undefined
    window.dispatchEvent(new Event('housecare:installed'))
  })
}

export async function promptInstall(): Promise<boolean> {
  const prompt = window.__houseCareInstallPrompt
  if (!prompt) return false
  await prompt.prompt()
  const choice = await prompt.userChoice
  if (choice.outcome === 'accepted') window.__houseCareInstallPrompt = undefined
  return choice.outcome === 'accepted'
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
