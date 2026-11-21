import { ArrowLeft, GasPump, PencilSimple } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { fuelLabel, kindLabel } from '@/lib/format'
import { type Vehicle } from '@/lib/types'
import { Button, cx, spring } from '@/ui/ui'
import { QuickAddMenu } from './QuickAdd'
import { KindIcon, VehicleArt } from './VehicleArt'
import { type Open } from './open'
import { imageUrl } from './photo'

/** Whether the element is on screen; true until it's known. Re-checks once {@code ready} (the element exists). */
export function useInView(ref: React.RefObject<HTMLElement | null>, ready: boolean) {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, ready])
  return inView
}

/**
 * On a phone, once the header has scrolled away: a slim bar with back, the vehicle's name and edit, so you
 * always know where you are and can get back. The tabs stick right under it (--sticky-top on the page).
 */
export function CompactBar({ vehicle: v, visible, onEdit }: { vehicle: Vehicle; visible: boolean; onEdit: () => void }) {
  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div key="bar" initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -56, opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-x-0 top-0 z-30 flex h-[3.25rem] items-center gap-1 border-b border-stone-900/10 bg-stone-100/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:hidden dark:border-white/10 dark:bg-stone-950/90">
          <Link to="/" className="rounded-full p-2.5 text-stone-700 transition active:scale-90 active:bg-stone-200 dark:text-stone-200 dark:active:bg-stone-800" aria-label="Back to garage"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] leading-tight font-semibold">{v.name}</div>
            {v.registration && <div className="truncate font-mono text-[11px] leading-tight text-stone-500">{v.registration}</div>}
          </div>
          <button type="button" onClick={onEdit} className="rounded-full p-2.5 text-stone-700 transition active:scale-90 active:bg-stone-200 dark:text-stone-200 dark:active:bg-stone-800" aria-label="Edit vehicle"><PencilSimple size={20} /></button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export const glass = 'rounded-full p-2.5 backdrop-blur transition active:scale-90'

export function Header({ vehicle: v, onEdit, onFuel, onPick }: { vehicle: Vehicle; onEdit: () => void; onFuel: () => void; onPick: (o: Open) => void }) {
  const subtitle = [v.make, v.model, v.year].filter(Boolean).join(' ')
  const facts = [kindLabel[v.kind], fuelLabel[v.fuelType]].join(' · ')
  const plate = v.registration && (
    <span className="inline-block whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-stone-900 ring-1 ring-stone-900/15">
      {v.registration}
    </span>
  )
  const desktopFuel = (look: 'glass' | 'plain') => (
    <div className="hidden shrink-0 items-center gap-2 sm:flex">
      <Button variant="primary" onClick={onFuel}><GasPump size={16} /> Add fuel</Button>
      <QuickAddMenu onPick={onPick} look={look} />
    </div>
  )

  // With a photo: the photo leads, the name sits on it.
  if (imageUrl(v)) {
    return (
      <div className="-mx-4 -mt-4 sm:mx-0 sm:mt-0">
        <div className="relative overflow-hidden sm:rounded-3xl">
          <VehicleArt vehicle={v} className="h-44 w-full sm:h-72" />
          <div className="absolute inset-x-0 top-0 flex justify-between p-3">
            <Link to="/" className={cx(glass, 'bg-black/35 text-white active:bg-black/55')} aria-label="Back to garage"><ArrowLeft size={20} /></Link>
            <button onClick={onEdit} className={cx(glass, 'bg-black/35 text-white active:bg-black/55')} aria-label="Edit vehicle"><PencilSimple size={20} /></button>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-14 pb-3.5 text-white sm:pt-20 sm:pb-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl leading-tight font-bold tracking-tight sm:text-[26px]">{v.name}</h1>
              <p className="truncate text-sm text-white/75">{subtitle || facts}</p>
              {plate && <div className="mt-1.5">{plate}</div>}
            </div>
            {desktopFuel('glass')}
          </div>
        </div>
      </div>
    )
  }

  // No photo: a calm profile-style header instead of a big grey block.
  return (
    <div>
      <div className="-mx-1 mb-3 flex items-center justify-between">
        <Link to="/" className={cx(glass, 'text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800')} aria-label="Back to garage"><ArrowLeft size={22} /></Link>
        <button onClick={onEdit} className={cx(glass, 'text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800')} aria-label="Edit vehicle"><PencilSimple size={22} /></button>
      </div>
      <div className="flex items-center gap-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong ring-1 ring-accent-strong/15">
          <KindIcon kind={v.kind} size={34} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-bold tracking-tight">{v.name}</h1>
          <p className="truncate text-sm text-stone-500">{subtitle ? `${subtitle} · ${fuelLabel[v.fuelType]}` : facts}</p>
          {plate && <div className="mt-1.5">{plate}</div>}
        </div>
        {desktopFuel('plain')}
      </div>
    </div>
  )
}

export function Figure({ label, value, unit, edit }: { label: string; value: string; unit?: string; edit?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
        {label}
        {edit && <PencilSimple size={11} className="text-stone-400" aria-label="update" />}
      </div>
      <div className="num mt-0.5 truncate text-xl leading-tight font-semibold tracking-tight">{value}</div>
      {unit && <div className="text-xs text-stone-500">{unit}</div>}
    </div>
  )
}

export function AttentionChip({ bad, icon, title, detail, onClick }: { bad: boolean; icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-sm ring-1 transition active:scale-95 xl:rounded-2xl xl:py-2',
        bad ? 'bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400' : 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300')}>
      <span className={cx('flex size-6 items-center justify-center rounded-full', bad ? 'bg-red-500/15' : 'bg-amber-500/20')}>{icon}</span>
      <span className="max-w-[11rem] truncate font-medium xl:max-w-none xl:flex-1 xl:text-left">{title}</span>
      <span className="num whitespace-nowrap opacity-80">· {detail}</span>
    </button>
  )
}
