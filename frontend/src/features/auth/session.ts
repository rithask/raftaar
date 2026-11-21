import { api } from '@/lib/api'

// ---- signing out --------------------------------------------------------------------------------------

/** Set on sign-out so the sign-in page doesn't go straight back to the identity provider. */
export const SIGNED_OUT = 'raftaar:signed-out'

export function wasSignedOut() {
  try {
    return sessionStorage.getItem(SIGNED_OUT) != null
  } catch {
    return false
  }
}

export function clearSignedOut() {
  try {
    sessionStorage.removeItem(SIGNED_OUT)
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Keeps the sign-in page from going straight to the provider (after signing out, or declining to link). */
export function markSignedOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT, '1')
  } catch {
    // storage unavailable: the sign-in page may go straight to the provider again
  }
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
  markSignedOut()
  // forget the data kept for opening offline (public/sw.js)
  navigator.serviceWorker?.controller?.postMessage('clear-data')
}
