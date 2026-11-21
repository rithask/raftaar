import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useSyncExternalStore } from 'react'
import { exitSoft, spring } from './motion'

type Action = { label: string; onClick: () => void }
type Toast = { id: number; text: string; tone: 'ok' | 'bad'; action?: Action }
let toasts: Toast[] = []
let next = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** A short confirmation at the bottom of the screen ("Fill-up saved"). */
export function toast(text: string, tone: Toast['tone'] = 'ok', opts: { action?: Action; duration?: number } = {}) {
  const shown = { id: next++, text, tone, action: opts.action }
  toasts = [shown] // only the newest: a pile of them covers what you're looking at
  emit()
  if (tone === 'ok' && 'vibrate' in navigator) navigator.vibrate?.(8) // a tiny tick on Android
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== shown.id)
    emit()
  }, opts.duration ?? (tone === 'ok' ? 2200 : 4000))
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
          className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          {shown.tone === 'ok' ? <CheckCircle size={18} weight="fill" className="text-emerald-400 dark:text-emerald-600" /> : <WarningCircle size={18} weight="fill" className="text-red-400" />}
          {shown.text}
          {shown.action && (
            <button type="button" onClick={() => { shown.action!.onClick(); toasts = toasts.filter((x) => x.id !== shown.id); emit() }}
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
