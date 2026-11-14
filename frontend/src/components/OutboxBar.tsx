import { CloudArrowUp, Trash, WarningCircle } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { money } from '../format'
import { amounts, discard, flush, useOutbox } from '../outbox'
import { softSpring } from './ui'

/** Fill-ups saved on this phone and not sent yet: how many, a way to send them now, and any the server refused. */
export function OutboxBar() {
  const items = useOutbox()
  const qc = useQueryClient()
  const [online, setOnline] = useState(navigator.onLine)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  const waiting = items.filter((i) => !i.error)
  const refused = items.filter((i) => i.error)
  const send = async () => {
    setBusy(true)
    await flush(qc)
    setBusy(false)
  }
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div key="outbox" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={softSpring} className="overflow-hidden">
          <div className="mb-4 space-y-2">
            {waiting.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-500/20 dark:text-sky-200">
                <CloudArrowUp size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{waiting.length === 1 ? '1 fill-up' : `${waiting.length} fill-ups`} waiting to send.</b>{' '}
                  {online ? 'Sending shortly.' : "You're offline; they'll go when you're back."}
                </span>
                {online && (
                  <button type="button" onClick={send} disabled={busy} className="shrink-0 rounded-lg px-2 py-1 font-semibold transition active:scale-95 active:bg-sky-500/15 disabled:opacity-50">
                    {busy ? 'Sending…' : 'Send now'}
                  </button>
                )}
              </div>
            )}
            {refused.map((i) => (
              <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-800 ring-1 ring-red-500/20 dark:text-red-300">
                <WarningCircle size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">A fill-up for {i.vehicleName} couldn't be saved</b>
                  {amounts(i.body).total != null ? ` (${money(amounts(i.body).total!)})` : ''}: {i.error}
                </span>
                <button type="button" onClick={() => confirm('Discard this fill-up? It was never saved.') && discard(i.key)} aria-label="Discard"
                  className="shrink-0 rounded-lg p-2 transition active:scale-90 active:bg-red-500/15"><Trash size={16} /></button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
