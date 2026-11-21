import { Bell, GasPump, Gauge, Plus, Receipt, Scroll, Wrench } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx, spring } from '@/ui/ui'
import { type Open } from './open'

/**
 * The main actions on a phone, above the tab bar within reach of the thumb: Fuel (the common one), and a small
 * "+" beside it for everything else you might log.
 */
export function FuelFab({ onClick, onPick, hidden }: { onClick: () => void; onPick: (o: Open) => void; hidden: boolean }) {
  return createPortal(
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="fab"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { ...spring, delay: 0.15 } }}
          exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
          data-fab
          className="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 flex items-center gap-2 sm:hidden"
        >
          <QuickAddMenu onPick={onPick} look="fab" />
          <motion.button type="button" onClick={onClick} aria-label="Add fuel" whileTap={{ scale: 0.9 }}
            className="flex items-center gap-2 rounded-full bg-accent py-3.5 pr-5 pl-4 font-semibold text-on-accent shadow-lg shadow-black/25">
            <GasPump size={22} weight="bold" /> Fuel
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export const QUICK: { label: string; icon: ReactNode; open: Open }[] = [
  { label: 'Log service', icon: <Wrench size={18} />, open: { kind: 'service' } },
  { label: 'Add expense', icon: <Receipt size={18} />, open: { kind: 'expense' } },
  { label: 'Update odometer', icon: <Gauge size={18} />, open: { kind: 'odometer' } },
  { label: 'Add paper', icon: <Scroll size={18} />, open: { kind: 'doc' } },
  { label: 'Add reminder', icon: <Bell size={18} />, open: { kind: 'reminder' } },
]

/** A round "+" that opens the other things you can add for this vehicle. Closes on a pick, outside tap or Escape. */
export function QuickAddMenu({ onPick, look }: { onPick: (o: Open) => void; look: 'fab' | 'glass' | 'plain' }) {
  // over the photo the menu opens upwards: the photo's frame would clip it below
  const placement = look === 'plain' ? 'below' : 'above'
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={root} className="relative">
      <motion.button type="button" onClick={() => setOpen((o) => !o)} aria-label="Add something else" aria-expanded={open} aria-haspopup="menu"
        whileTap={{ scale: 0.9 }} animate={{ rotate: open ? 45 : 0 }} transition={spring}
        className={cx('flex items-center justify-center rounded-full',
          look === 'fab' && 'size-12 bg-white text-stone-900 shadow-lg shadow-black/20 ring-1 ring-stone-900/10 dark:bg-stone-800 dark:text-stone-100 dark:ring-white/10',
          look === 'glass' && 'size-10 bg-black/35 text-white backdrop-blur hover:bg-black/50',
          look === 'plain' && 'size-10 bg-stone-200 text-stone-800 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700')}>
        <Plus size={placement === 'above' ? 22 : 18} weight="bold" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" key="menu"
            initial={{ opacity: 0, scale: 0.92, y: placement === 'above' ? 8 : -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            transition={spring}
            className={cx('absolute right-0 z-50 w-52 overflow-hidden rounded-2xl bg-white p-1.5 text-stone-900 shadow-xl ring-1 ring-stone-900/10 dark:bg-stone-800 dark:text-stone-100 dark:ring-white/10',
              placement === 'above' ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right')}>
            {QUICK.map((q) => (
              <button key={q.label} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(q.open) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition active:scale-[0.98] hover:bg-stone-100 active:bg-stone-100 dark:hover:bg-stone-700 dark:active:bg-stone-700">
                <span className="text-stone-500 dark:text-stone-400">{q.icon}</span> {q.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
