import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { exitSoft, spring } from './motion'

type Action = { label: string; onClick: () => void }
type Toast = { id: number; text: string; tone: 'ok' | 'bad'; action?: Action; duration: number }
let toasts: Toast[] = []
let next = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** The most toasts with an action shown at once; past it, the oldest goes early. More would cover the page. */
const MAX_WITH_ACTION = 3

/**
 * A short confirmation at the bottom of the screen ("Fill-up saved"). Ones with an action (Undo) stack up, newest at
 * the bottom, each staying for its own time, so two things done in a row can each still be undone; one without
 * replaces the others without.
 */
export function toast(text: string, tone: Toast['tone'] = 'ok', opts: { action?: Action; duration?: number } = {}) {
  const duration = opts.duration ?? (tone === 'ok' ? 2200 : 4000)
  const shown = { id: next++, text, tone, action: opts.action, duration }
  const withAction = toasts.filter((other) => other.action)
  toasts = [...(shown.action ? withAction.slice(1 - MAX_WITH_ACTION) : withAction), shown]
  emit()
  if (tone === 'ok' && 'vibrate' in navigator) navigator.vibrate?.(8) // a tiny tick on Android
  setTimeout(() => remove(shown.id), duration)
}

function remove(id: number) {
  if (!toasts.some((shown) => shown.id === id)) return
  toasts = toasts.filter((shown) => shown.id !== id)
  emit()
}

/** How long Undo is offered for. */
export const UNDO_WAIT = 5000

/**
 * A confirmation with Undo, offered for {@link UNDO_WAIT} with the time left shown counting down. {@code onUndo} runs
 * when it's tapped, and the toast goes.
 */
export function undoToast(text: string, onUndo: () => void) {
  toast(text, 'ok', { duration: UNDO_WAIT, action: { label: 'Undo', onClick: onUndo } })
}

export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
  // iOS only shows :active styles when a touch listener exists somewhere on the page
  useEffect(() => {
    const noop = () => {}
    document.addEventListener('touchstart', noop, { passive: true })
    return () => document.removeEventListener('touchstart', noop)
  }, [])
  return (
    // above the tab bar, and above the floating Fuel button when a page shows one ([data-fab])
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 max-sm:[:root:has([data-fab])_&]:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9rem)]" aria-live="polite">
      <AnimatePresence mode="popLayout">
      {list.map((shown) => (
        <motion.div
          key={shown.id}
          layout
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
          exit={{ opacity: 0, y: 8, scale: 0.96, transition: exitSoft }}
          className="flex max-w-full items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          {shown.tone === 'ok' ? <CheckCircle size={18} weight="fill" className="text-emerald-400 dark:text-emerald-600" /> : <WarningCircle size={18} weight="fill" className="text-red-400" />}
          <span className="min-w-0 truncate">{shown.text}</span>
          {shown.action && <Countdown ms={shown.duration} />}
          {shown.action && (
            <button type="button" onClick={() => { remove(shown.id); shown.action!.onClick() }}
              className="pointer-events-auto -my-1 ml-1 rounded-full px-3 py-1 font-semibold text-sky-300 transition active:scale-95 active:bg-white/10 dark:text-sky-700 dark:active:bg-black/10">
              {shown.action.label}
            </button>
          )}
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  )
}

/** The time left to act on a toast: a ring that empties, around the seconds left. */
function Countdown({ ms }: { ms: number }) {
  const [left, setLeft] = useState(Math.ceil(ms / 1000))
  useEffect(() => {
    const ends = Date.now() + ms
    const timer = window.setInterval(() => setLeft(Math.max(0, Math.ceil((ends - Date.now()) / 1000))), 250)
    return () => window.clearInterval(timer)
  }, [ms])
  return (
    <span className="relative -my-1 ml-1 flex size-6 shrink-0 items-center justify-center" aria-label={`${left} seconds left to undo`}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" className="stroke-white/20 dark:stroke-black/15" />
        <motion.circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-sky-300 dark:stroke-sky-700"
          initial={{ pathLength: 1 }} animate={{ pathLength: 0 }} transition={{ duration: ms / 1000, ease: 'linear' }} />
      </svg>
      <span className="num text-[11px] font-semibold tabular-nums">{left}</span>
    </span>
  )
}
