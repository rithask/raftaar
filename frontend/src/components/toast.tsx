import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useSyncExternalStore } from 'react'

type Toast = { id: number; text: string; tone: 'ok' | 'bad' }
let toasts: Toast[] = []
let next = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** A short confirmation at the bottom of the screen ("Fill-up saved"). */
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: next++, text, tone }
  toasts = [t] // only the newest: a pile of them covers what you're looking at
  emit()
  if (tone === 'ok' && 'vibrate' in navigator) navigator.vibrate?.(8) // a tiny tick on Android
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, tone === 'ok' ? 2200 : 4000)
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
      <AnimatePresence mode="popLayout">
      {list.map((t) => (
        <motion.div
          key={t.id}
          layout
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 520, damping: 30 } }}
          exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18 } }}
          className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          {t.tone === 'ok' ? <CheckCircle size={18} weight="fill" className="text-emerald-400 dark:text-emerald-600" /> : <WarningCircle size={18} weight="fill" className="text-red-400" />}
          {t.text}
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  )
}
