/**
 * This device and notifications by Web Push (see WebPush on the server), and installing the app.
 *
 * Push needs the app's service worker, which is only there in the app as built (not on the dev server). On an
 * iPhone or iPad it also needs the app added to the Home Screen and opened from there (iOS 16.4 and later).
 */

/** What this device can do about push notifications. */
export type PushSupport = 'ready' | 'add-to-home-screen' | 'unsupported' | 'no-service-worker'

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export async function pushSupport(): Promise<PushSupport> {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!('PushManager' in window) || !('Notification' in window)) return isIos() && !isInstalled() ? 'add-to-home-screen' : 'unsupported'
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? 'ready' : 'no-service-worker'
}

/** This browser's subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Asks to show notifications, then subscribes with the server's key; null when you say no. */
export async function subscribe(serverKey: string): Promise<PushSubscriptionJSON | null> {
  if ((await Notification.requestPermission()) !== 'granted') return null
  const registration = await navigator.serviceWorker.ready
  try {
    const subscription = (await registration.pushManager.getSubscription())
      ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(serverKey) })
    return subscription.toJSON()
  } catch (e) {
    // the browser's own words ("Registration failed - push service error") say little by themselves
    throw new Error(`This browser couldn't sign up for notifications (${e instanceof Error ? e.message : 'no reason given'}). Try again, or in another browser.`)
  }
}

export async function unsubscribe() {
  await (await currentSubscription())?.unsubscribe()
}

/** "iPhone · Safari", "Android · Chrome", "Mac · Firefox": which device this is, for the list of them. */
export function deviceLabel() {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || isIos() ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Browser'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null
  return browser ? `${device} · ${browser}` : device
}

function fromBase64Url(text: string) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

// ---- installing ------------------------------------------------------------------------------------------------

/** Chrome's install prompt, held from when it's offered (early, as the page loads) until the Install button is pressed. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installPrompt: InstallPrompt | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  installPrompt = e as InstallPrompt
  listeners.forEach((listener) => listener())
})
window.addEventListener('appinstalled', () => {
  installPrompt = null
  listeners.forEach((listener) => listener())
})

/** Whether the browser can install the app with one button (Chrome, Edge, Android). */
export const canInstall = () => installPrompt != null
export const onInstallChange = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Shows the browser's install prompt; true when you installed. */
export async function install() {
  if (!installPrompt) return false
  await installPrompt.prompt()
  const { outcome } = await installPrompt.userChoice
  installPrompt = null
  listeners.forEach((listener) => listener())
  return outcome === 'accepted'
}
