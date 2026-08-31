import { supabase } from './supabase'

export type PushCapability = 'unsupported' | 'cloud_required' | 'blocked' | 'prompt' | 'subscribed' | 'available'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let index = 0; index < rawData.length; index += 1) bytes[index] = rawData.charCodeAt(index)
  return bytes.buffer
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function activeServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing) return null
  if (existing.active) return existing
  return navigator.serviceWorker.ready
}

async function persistSubscription(workspaceId: string, memberId: string, subscription: PushSubscription): Promise<void> {
  if (!supabase) return
  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error('The browser did not provide usable push subscription keys.')
  const { error } = await supabase.from('push_subscriptions').upsert({
    workspace_id: workspaceId,
    member_id: memberId,
    endpoint: subscription.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
    disabled_at: null,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) throw error
}

/**
 * Keep the server-side subscription row aligned with the browser. A previous
 * push delivery may have disabled the database row while the browser still
 * reports an active subscription; without this repair Settings would continue
 * to show "enabled" even though send-push has no eligible endpoint.
 */
export async function syncPushSubscription(workspaceId: string, memberId: string): Promise<void> {
  if (!supabase || !pushSupported() || !vapidPublicKey || Notification.permission !== 'granted') return
  const registration = await activeServiceWorkerRegistration()
  if (!registration) return
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const { data: saved, error } = await supabase.from('push_subscriptions')
    .select('disabled_at')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle()
  if (error) throw error

  // A 404/410 from the push provider disables the server row. The browser can
  // still retain that dead endpoint, so replace it with a fresh subscription.
  if (saved?.disabled_at) {
    await subscription.unsubscribe().catch(() => false)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    })
  }
  await persistSubscription(workspaceId, memberId, subscription)
}

export async function currentPushCapability(isCloud: boolean): Promise<PushCapability> {
  if (!isCloud || !supabase) return 'cloud_required'
  if (!pushSupported() || !vapidPublicKey) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const registration = await activeServiceWorkerRegistration()
  if (!registration) return 'unsupported'
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) return 'subscribed'
  return Notification.permission === 'default' ? 'prompt' : 'available'
}

export async function enablePush(workspaceId: string, memberId: string): Promise<void> {
  if (!supabase || !pushSupported() || !vapidPublicKey) throw new Error('Push notifications are not configured.')
  const registration = await activeServiceWorkerRegistration()
  if (!registration) throw new Error('Install or enable the app service worker before enabling notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    })
  }
  try {
    await persistSubscription(workspaceId, memberId, subscription)
  } catch (error) {
    if (!await registration.pushManager.getSubscription()) return
    throw error
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await activeServiceWorkerRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  if (supabase) {
    await supabase.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('endpoint', subscription.endpoint)
  }
  await subscription.unsubscribe()
}
