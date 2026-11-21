import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { api, ApiError } from './api'
import { refresh } from './queries'
import { toast } from '@/ui'

/**
 * Fill-ups saved without a connection (at a pump with no signal), kept on this phone until they can be sent.
 * They're sent when the connection comes back, when the app opens, and every 30 seconds while any are waiting.
 * The server recognises a fill-up it already has (same vehicle, time and odometer), so sending one twice is safe.
 */
export interface Waiting {
  key: string
  vehicleId: number
  vehicleName: string
  body: Record<string, unknown> & { filledAt: string; odometer: number | null; totalCost: number | null; volume: number | null; pricePerUnit: number | null }
  queuedAt: string
  /** Why the server refused it (it stays until you discard it); null while it's just waiting for a connection. */
  error: string | null
}

const STORE = 'raftaar:outbox'
let items: Waiting[] = read()
const listeners = new Set<() => void>()

function read(): Waiting[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]') as Waiting[]
  } catch {
    return []
  }
}

function write(next: Waiting[]) {
  items = next
  try {
    localStorage.setItem(STORE, JSON.stringify(items))
  } catch {
    // storage full or blocked: still kept in memory for this visit
  }
  listeners.forEach((l) => l())
}

/** The request never reached the server (offline, server unreachable): worth keeping and sending later. */
export const unreachable = (e: unknown) => e instanceof ApiError && e.status === 0

export function queueFill(vehicleId: number, vehicleName: string, body: Waiting['body']) {
  write([...items, { key: crypto.randomUUID?.() ?? String(Date.now()), vehicleId, vehicleName, body, queuedAt: new Date().toISOString(), error: null }])
}

/** Its three numbers, the missing one worked out (the form sends only the two you typed). */
export function amounts(body: Waiting['body']) {
  const volume = body.volume, price = body.pricePerUnit, total = body.totalCost
  return {
    volume: volume ?? (total != null && price ? total / price : null),
    total: total ?? (volume != null && price != null ? volume * price : null),
  }
}

export function discard(key: string) {
  write(items.filter((i) => i.key !== key))
}

export function useOutbox(): Waiting[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}

let sending = false

/** Sends what's waiting, oldest first. Stops at the first one that can't get through (still offline, signed out). */
export async function flush(queryClient: QueryClient) {
  if (sending || !items.some((i) => !i.error)) return
  sending = true
  let sent = 0
  try {
    for (const item of items.filter((i) => !i.error)) {
      try {
        await api(`/vehicles/${item.vehicleId}/fuel`, { body: item.body })
        discard(item.key)
        sent++
      } catch (e) {
        if (unreachable(e) || (e instanceof ApiError && (e.status === 401 || e.status >= 500))) break // try again later
        // refused (e.g. the vehicle was deleted): keep it, with why, until it's discarded
        write(items.map((i) => (i.key === item.key ? { ...i, error: e instanceof Error ? e.message : 'Refused' } : i)))
      }
    }
  } finally {
    sending = false
  }
  if (sent > 0) {
    for (const queryKey of refresh.vehicleRecords) void queryClient.invalidateQueries({ queryKey })
    toast(sent === 1 ? 'Fill-up sent' : `${sent} fill-ups sent`)
  }
}

/** Sends waiting fill-ups now, when the connection comes back, and every 30 seconds while any are waiting. */
export function startOutbox(queryClient: QueryClient) {
  const go = () => void flush(queryClient)
  window.addEventListener('online', go)
  const timer = window.setInterval(() => items.some((i) => !i.error) && go(), 30_000)
  go()
  return () => {
    window.removeEventListener('online', go)
    window.clearInterval(timer)
  }
}
