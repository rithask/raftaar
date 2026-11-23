import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { toast } from '@/ui'

/**
 * Deleting without a "are you sure?": the thing disappears at once and a toast offers Undo for a few seconds.
 * Only then is the delete sent. Undo cancels it and brings the thing back. Leaving or closing the page sends any
 * pending delete straight away (the request is keepalive), so nothing waits forever.
 *
 * {@code hide} names what disappears meanwhile ("fuel:12"); lists skip anything {@link useHidden} reports.
 * {@code refresh} is what to fetch again once it's gone (see refresh in queries.ts).
 */
/** How long an Undo is offered for. */
export const UNDO_WAIT = 5000
type Pending = { run: () => Promise<unknown>; hide?: string; timer: number; what: string; refresh: readonly QueryKey[] }
const pending = new Map<number, Pending>()
let hidden = new Set<string>()
let next = 1
let client: QueryClient | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setUndoClient(queryClient: QueryClient) {
  client = queryClient
}

function setHidden(key: string | undefined, on: boolean) {
  if (!key) return
  hidden = new Set(hidden)
  if (on) hidden.add(key)
  else hidden.delete(key)
  emit()
}

export function deleteWithUndo({ text, what, hide, run, refresh = [] }: {
  text: string; what: string; hide?: string; run: () => Promise<unknown>; refresh?: readonly QueryKey[]
}) {
  const id = next++
  setHidden(hide, true)
  const timer = window.setTimeout(() => commit(id), UNDO_WAIT)
  pending.set(id, { run, hide, timer, what, refresh })
  toast(text, 'ok', {
    duration: UNDO_WAIT,
    action: {
      label: 'Undo',
      onClick: () => {
        const entry = pending.get(id)
        if (!entry) return
        window.clearTimeout(entry.timer)
        pending.delete(id)
        setHidden(entry.hide, false)
        toast('Restored')
      },
    },
  })
}

async function commit(id: number) {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  try {
    await entry.run()
    await Promise.all(entry.refresh.map((queryKey) => client?.invalidateQueries({ queryKey })))
  } catch (e) {
    toast(`Couldn't delete ${entry.what}: ${e instanceof Error ? e.message : 'try again'}`, 'bad')
  } finally {
    setHidden(entry.hide, false)
  }
}

// leaving the page: send what's pending now rather than lose it
window.addEventListener('pagehide', () => [...pending.keys()].forEach((id) => {
  window.clearTimeout(pending.get(id)!.timer)
  void commit(id)
}))

/** Whether {@code key} ("fuel:12") was just deleted and is waiting out its Undo. */
export function useHidden(): (key: string) => boolean {
  const set = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => hidden,
  )
  return (key) => set.has(key)
}
