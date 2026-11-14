import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { toast } from './components/toast'

/**
 * Deleting without a "are you sure?": the thing disappears at once and a toast offers Undo for a few seconds.
 * Only then is the delete sent. Undo cancels it and brings the thing back. Leaving or closing the page sends any
 * pending delete straight away (the request is keepalive), so nothing waits forever.
 *
 * {@code hide} names what disappears meanwhile ("fuel:12"); lists skip anything {@link useHidden} reports.
 */
const WAIT = 5000
type Pending = { run: () => Promise<unknown>; hide?: string; timer: number; what: string }
const pending = new Map<number, Pending>()
let hidden = new Set<string>()
let next = 1
let client: QueryClient | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setUndoClient(qc: QueryClient) {
  client = qc
}

function setHidden(key: string | undefined, on: boolean) {
  if (!key) return
  hidden = new Set(hidden)
  if (on) hidden.add(key)
  else hidden.delete(key)
  emit()
}

export function deleteWithUndo({ text, what, hide, run }: { text: string; what: string; hide?: string; run: () => Promise<unknown> }) {
  const id = next++
  setHidden(hide, true)
  const timer = window.setTimeout(() => commit(id), WAIT)
  pending.set(id, { run, hide, timer, what })
  toast(text, 'ok', {
    duration: WAIT,
    action: {
      label: 'Undo',
      onClick: () => {
        const p = pending.get(id)
        if (!p) return
        window.clearTimeout(p.timer)
        pending.delete(id)
        setHidden(p.hide, false)
        toast('Restored')
      },
    },
  })
}

async function commit(id: number) {
  const p = pending.get(id)
  if (!p) return
  pending.delete(id)
  try {
    await p.run()
    await client?.invalidateQueries()
  } catch (e) {
    toast(`Couldn't delete ${p.what}: ${e instanceof Error ? e.message : 'try again'}`, 'bad')
  } finally {
    setHidden(p.hide, false)
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
