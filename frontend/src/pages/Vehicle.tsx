import { ArrowLeft, Bell, GasPump, Gauge, Plus, Path, PencilSimple, Receipt, Scroll, Warning, Wrench } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, Line, LineChart, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { api, imageUrl, type DocView, type Expense, type FuelRow, type ReminderView, type ServiceRow, type Summary, type Trip, type Vehicle } from '../api'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { FuelForm } from '../components/FuelForm'
import { axis, ChartCard, grid, margin, monthLabel, short, Swatch, tooltipStyle, usualRange } from '../components/charts'
import { DocumentForm, ExpenseForm, OdometerForm, ReminderForm, ServiceForm } from '../components/Forms'
import { AddLink, Badge, Button, cx, Empty, ErrorText, listItem, listParent, Loading, rowPress, SectionHeader, softSpring, spring, Tabs } from '../components/ui'
import { KindIcon, VehicleArt } from '../components/VehicleArt'
import { VehicleForm } from '../components/VehicleForm'
import { date, dateTime, docLabel, economyUnit, expenseLabel, fuelLabel, kindLabel, km, money, money2, n1, n2 } from '../format'
import { useSave } from '../hooks'

type Tab = 'fuel' | 'upkeep' | 'papers' | 'spend' | 'trips'
const TABS: Tab[] = ['fuel', 'upkeep', 'papers', 'spend', 'trips']
const SOURCE = { MANUAL: '', HISAAB: 'Hisaab', GEOPULSE: 'GeoPulse', HISAAB_GEOPULSE: 'Hisaab + GeoPulse' } as const
type Open =
  | { kind: 'vehicle' } | { kind: 'fuel'; row?: FuelRow } | { kind: 'service'; row?: ServiceRow } | { kind: 'reminder'; r?: ReminderView }
  | { kind: 'doc'; d?: DocView } | { kind: 'expense'; e?: Expense } | { kind: 'odometer' } | null

export function VehiclePage() {
  const id = Number(useParams().id)
  const summary = useQuery({ queryKey: ['vehicle', id], queryFn: () => api<Summary>(`/vehicles/${id}`) })
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api<Vehicle[]>('/vehicles') })
  const [tab, setTab] = useState<Tab>('fuel')
  // tab content slides in from the side you moved towards
  const tabDir = useRef(0)
  const pickTab = (t: Tab) => {
    tabDir.current = TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1
    setTab(t)
  }
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const headRef = useRef<HTMLDivElement>(null)
  const headInView = useInView(headRef, !summary.isLoading)

  if (summary.isLoading) return <Loading />
  if (summary.error) return <ErrorText error={summary.error} />
  const s = summary.data!
  const v = s.vehicle
  const odo = s.odometer.estimated ?? s.odometer.known
  const activeVehicles = (vehicles.data ?? [v]).filter((x) => !x.archived || x.id === v.id)
  const due = s.reminders.filter((r) => r.status.state === 'OVERDUE' || r.status.state === 'DUE_SOON')
  const papers = s.documents.filter((d) => d.state === 'EXPIRED' || d.state === 'EXPIRING')
  const worst = (bad: boolean, any: boolean) => (bad ? 'bad' : any ? 'warn' : undefined)

  return (
    <div className="space-y-5 pb-20 [--sticky-top:3.25rem] sm:pb-0 sm:[--sticky-top:0px]">
      <div ref={headRef}>
        <Header vehicle={v} onEdit={() => setOpen({ kind: 'vehicle' })} onFuel={() => setOpen({ kind: 'fuel' })} onPick={setOpen} />
      </div>
      <CompactBar vehicle={v} visible={!headInView} onEdit={() => setOpen({ kind: 'vehicle' })} />

      {/* phones and tablets: one column. Wide screens: tabs on the left, the numbers and what's due in a column on the right. */}
      <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-6 xl:space-y-0">
      <aside className="space-y-5 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1">
      {/* the three numbers that matter, and one quiet line under them */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
        <div className="grid grid-cols-3 divide-x divide-stone-900/5 dark:divide-white/10">
          <div className="min-w-0 pr-2">
            <button type="button" onClick={() => setOpen({ kind: 'odometer' })} aria-label="Update odometer"
              className="-m-2 w-[calc(100%+1rem)] rounded-xl p-2 text-left transition active:scale-[0.97] active:bg-stone-100 dark:active:bg-stone-800">
              <Figure label="Odometer" value={odo != null ? `${s.odometer.estimated != null ? '≈' : ''}${Math.round(odo).toLocaleString('en-IN')}` : '—'} unit="km" edit />
            </button>
          </div>
          <div className="min-w-0 px-3">
            <Figure label="Mileage" value={s.averageEconomy != null ? n1(s.averageEconomy) : '—'} unit={s.averageEconomy != null ? economyUnit(s.unit) : undefined} />
          </div>
          <div className="min-w-0 pl-3">
            <Figure label="Per km" value={s.costs.perKm != null ? money2(s.costs.perKm) : '—'} />
          </div>
        </div>
        <p className="num mt-3 border-t border-stone-900/5 pt-3 text-xs text-stone-500 dark:border-white/10">
          {[
            s.odometer.kmPerDay != null ? `${n1(s.odometer.kmPerDay)} km a day` : null,
            `${money(s.costs.thisMonth)} this month`,
            s.lastEconomy != null && s.averageEconomy != null && s.lastEconomy !== s.averageEconomy ? `last tank ${n1(s.lastEconomy)}` : null,
            s.averageEconomy == null ? 'mileage after two full tanks' : null,
          ].filter(Boolean).join('  ·  ')}
        </p>
      </div>

      {(due.length > 0 || papers.length > 0) && (
        // what needs doing soon, as one row of chips (the tabs below have the details)
        <section aria-label="Coming up" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 xl:flex-col xl:items-stretch">
          {due.map((r) => (
            <AttentionChip key={`r${r.reminder.id}`} bad={r.status.state === 'OVERDUE'} icon={<Wrench size={14} />} title={r.reminder.title}
              detail={r.status.summary.replace(/^Due /, '')} onClick={() => setOpen({ kind: 'service' })} />
          ))}
          {papers.map((d) => (
            <AttentionChip key={`d${d.document.id}`} bad={d.state === 'EXPIRED'} icon={<Scroll size={14} />} title={d.document.title}
              detail={d.state === 'EXPIRED' ? 'expired' : d.daysLeft === 0 ? 'today' : `${d.daysLeft} days`}
              onClick={() => setOpen({ kind: 'doc', d })} />
          ))}
        </section>
      )}
      </aside>

      <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
      <Tabs value={tab} onChange={pickTab} options={[
        { value: 'fuel', label: 'Fuel' },
        { value: 'upkeep', label: 'Upkeep', dot: worst(due.some((r) => r.status.state === 'OVERDUE'), due.length > 0) },
        { value: 'papers', label: 'Papers', dot: worst(papers.some((d) => d.state === 'EXPIRED'), papers.length > 0) },
        { value: 'spend', label: 'Spend' },
        { value: 'trips', label: 'Trips' },
      ]} />

      <AnimatePresence mode="popLayout" initial={false} custom={tabDir.current}>
        <motion.div
          key={tab}
          custom={tabDir.current}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 32 }),
            show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 38 } },
            leave: (d: number) => ({ opacity: 0, x: d * -24, transition: { duration: 0.12 } }),
          }}
          initial="enter"
          animate="show"
          exit="leave"
          className="space-y-6"
        >
          <ErrorBoundary resetKey={tab} fallback="section">
          {tab === 'fuel' && <FuelTab id={id} summary={s} onOpen={(row) => setOpen({ kind: 'fuel', row })} />}
          {tab === 'upkeep' && (
            <>
              <RemindersSection id={id} onOpen={(r) => setOpen({ kind: 'reminder', r })} onAdd={() => setOpen({ kind: 'reminder' })} />
              <ServicesSection id={id} onOpen={(row) => setOpen({ kind: 'service', row })} onAdd={() => setOpen({ kind: 'service' })} />
            </>
          )}
          {tab === 'papers' && <PapersSection docs={s.documents} onOpen={(d) => setOpen({ kind: 'doc', d })} onAdd={() => setOpen({ kind: 'doc' })} />}
          {tab === 'spend' && <SpendTab id={id} summary={s} onOpen={(e) => setOpen({ kind: 'expense', e })} onAdd={() => setOpen({ kind: 'expense' })} />}
          {tab === 'trips' && <TripsTab id={id} />}
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
      </div>
      </div>

      <FuelFab onClick={() => setOpen({ kind: 'fuel' })} onPick={setOpen} hidden={open !== null} />

      <AnimatePresence>
        {open?.kind === 'vehicle' && <VehicleForm key="vehicle" open onClose={close} vehicle={v} />}
        {open?.kind === 'fuel' && <FuelForm key="fuel" open onClose={close} vehicles={activeVehicles} vehicleId={id} entry={open.row?.entry} lastOdometer={s.odometer.known} estimatedOdometer={s.odometer.estimated} />}
        {open?.kind === 'service' && <ServiceForm key="service" open onClose={close} vehicleId={id} row={open.row} reminders={s.reminders} odometer={odo} />}
        {open?.kind === 'reminder' && <ReminderForm key="reminder" open onClose={close} vehicleId={id} reminder={open.r?.reminder} odometer={odo} />}
        {open?.kind === 'doc' && <DocumentForm key="doc" open onClose={close} vehicles={activeVehicles} vehicleId={id} doc={open.d?.document} />}
        {open?.kind === 'expense' && <ExpenseForm key="expense" open onClose={close} vehicles={activeVehicles} vehicleId={id} expense={open.e} />}
        {open?.kind === 'odometer' && <OdometerForm key="odometer" open onClose={close} vehicleId={id} current={s.odometer.known} odometer={s.odometer} />}
      </AnimatePresence>
    </div>
  )
}

// ---- header -----------------------------------------------------------------------------------------------

/** Whether the element is on screen; true until it's known. Re-checks once {@code ready} (the element exists). */
function useInView(ref: React.RefObject<HTMLElement | null>, ready: boolean) {
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
function CompactBar({ vehicle: v, visible, onEdit }: { vehicle: Vehicle; visible: boolean; onEdit: () => void }) {
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

const glass = 'rounded-full p-2.5 backdrop-blur transition active:scale-90'

function Header({ vehicle: v, onEdit, onFuel, onPick }: { vehicle: Vehicle; onEdit: () => void; onFuel: () => void; onPick: (o: Open) => void }) {
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

function Figure({ label, value, unit, edit }: { label: string; value: string; unit?: string; edit?: boolean }) {
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

function AttentionChip({ bad, icon, title, detail, onClick }: { bad: boolean; icon: ReactNode; title: string; detail: string; onClick: () => void }) {
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

/**
 * The main actions on a phone, above the tab bar within reach of the thumb: Fuel (the common one), and a small
 * "+" beside it for everything else you might log.
 */
function FuelFab({ onClick, onPick, hidden }: { onClick: () => void; onPick: (o: Open) => void; hidden: boolean }) {
  return createPortal(
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="fab"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { ...spring, delay: 0.15 } }}
          exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
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

const QUICK: { label: string; icon: ReactNode; open: Open }[] = [
  { label: 'Log service', icon: <Wrench size={18} />, open: { kind: 'service' } },
  { label: 'Add expense', icon: <Receipt size={18} />, open: { kind: 'expense' } },
  { label: 'Update odometer', icon: <Gauge size={18} />, open: { kind: 'odometer' } },
  { label: 'Add paper', icon: <Scroll size={18} />, open: { kind: 'doc' } },
  { label: 'Add reminder', icon: <Bell size={18} />, open: { kind: 'reminder' } },
]

/** A round "+" that opens the other things you can add for this vehicle. Closes on a pick, outside tap or Escape. */
function QuickAddMenu({ onPick, look }: { onPick: (o: Open) => void; look: 'fab' | 'glass' | 'plain' }) {
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

// ---- lists ------------------------------------------------------------------------------------------------

function List({ children }: { children: ReactNode }) {
  return <motion.div variants={listParent} initial="hidden" animate="show" className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">{children}</motion.div>
}

function Row({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return <motion.button variants={listItem} onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${rowPress}`}>{children}</motion.button>
}

function Small({ children }: { children: ReactNode }) {
  return <div className="num mt-0.5 truncate text-[13px] text-stone-500">{children}</div>
}

function FuelTab({ id, summary, onOpen }: { id: number; summary: Summary; onOpen: (r: FuelRow) => void }) {
  const rows = useQuery({ queryKey: ['fuel', id], queryFn: () => api<FuelRow[]>(`/vehicles/${id}/fuel`) })
  const resolve = useSave((fid: number) => api(`/fuel/${fid}/resolve`, { method: 'POST' }), undefined, 'Marked as checked')
  if (rows.isLoading) return <Loading />
  const list = rows.data ?? []
  if (!list.length) return <Empty icon={<GasPump size={40} />} title="No fill-ups yet">Add each fill-up with the odometer reading. Mileage shows after two full tanks.</Empty>
  const byId = new Map(list.map((r) => [r.entry.id, r.entry]))
  const chart = summary.economyHistory.map((st) => ({ when: date(byId.get(st.endId)?.filledAt, false), kmpl: st.kmPerUnit }))
  const unit = summary.unit
  const usual = usualRange(chart.map((c) => c.kmpl))
  const prices = [...list].reverse().map((r) => ({ when: date(r.entry.filledAt, false), paid: r.entry.pricePerUnit, published: r.publishedPrice }))
  const hasPublished = prices.some((p) => p.published != null)
  const spent = list.reduce((t, r) => t + r.entry.totalCost, 0)
  return (
    <>
      {chart.length >= 2 && (
        <section className="space-y-2">
          <SectionHeader title="Mileage per tank" meta={usual ? `${economyUnit(unit)} · usually ${n1(usual.low)}–${n1(usual.high)}` : economyUnit(unit)} />
          <ChartCard>
            <LineChart data={chart} margin={margin}>
              {grid}
              {usual && <ReferenceArea y1={usual.low} y2={usual.high} fill="var(--color-accent-strong)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />}
              <XAxis dataKey="when" {...axis} />
              <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.max(0, Math.floor(min - 2)), (max: number) => Math.ceil(max + 2)]} />
              <Tooltip formatter={(val) => [`${n1(Number(val))} ${economyUnit(unit)}`, 'Mileage']} {...tooltipStyle} />
              <Line type="monotone" dataKey="kmpl" stroke="var(--color-accent-strong)" strokeWidth={2.5} isAnimationActive={false}
                dot={({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: { kmpl: number }; index?: number }) => {
                  const low = usual != null && payload != null && payload.kmpl < usual.poor
                  return <circle key={index} cx={cx} cy={cy} r={low ? 4 : 3} fill={low ? 'var(--color-amber-500, #f59e0b)' : 'var(--color-accent-strong)'} stroke="none" />
                }} />
            </LineChart>
          </ChartCard>
        </section>
      )}
      {prices.length >= 2 && (
        <section className="space-y-2">
          <SectionHeader title="Price paid" meta={hasPublished ? (
            <span className="inline-flex items-center gap-3">
              <span>₹/{unit}</span>
              <span className="inline-flex items-center gap-1"><Swatch color="var(--color-accent-strong)" /> you</span>
              <span className="inline-flex items-center gap-1"><Swatch color="var(--color-stone-400, #a8a29e)" dashed /> published</span>
            </span>
          ) : `₹/${unit}`} />
          <ChartCard>
            <LineChart data={prices} margin={margin}>
              {grid}
              <XAxis dataKey="when" {...axis} />
              <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} />
              <Tooltip formatter={(val, name) => [money2(Number(val)), name === 'paid' ? 'You paid' : 'Published']} {...tooltipStyle} />
              {hasPublished && <Line type="monotone" dataKey="published" stroke="var(--color-stone-400, #a8a29e)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />}
              <Line type="monotone" dataKey="paid" stroke="var(--color-accent-strong)" strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          </ChartCard>
        </section>
      )}
      <section className="space-y-2">
        <SectionHeader title="Fill-ups" meta={`${list.length} · ${money(spent)}`} />
        <List>
          {list.map((r) => (
            <div key={r.entry.id}>
              <Row onClick={() => onOpen(r)}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong"><GasPump size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{dateTime(r.entry.filledAt)}</div>
                  <Small>
                    {km(r.entry.odometer)} · {n2(r.entry.volume)} {unit}
                    {!r.entry.fullTank ? ' · partial' : ''}
                    {r.entry.missedPrevious ? ' · after a skipped one' : ''}
                    {r.entry.source !== 'MANUAL' ? ` · ${SOURCE[r.entry.source]}` : r.entry.stationName ? ` · ${r.entry.stationName}` : ''}
                  </Small>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num font-semibold">{money(r.entry.totalCost)}</div>
                  <div className="num mt-0.5 text-[13px] text-stone-500">{r.kmPerUnit != null ? `${n1(r.kmPerUnit)} ${economyUnit(unit)}` : `@ ${money2(r.entry.pricePerUnit)}`}</div>
                </div>
              </Row>
              {r.entry.sourceIssue && (
                <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
                  <Warning size={16} /> <span className="flex-1">{r.entry.sourceIssue}</span>
                  <Button variant="ghost" className="!py-1" onClick={() => resolve.mutate(r.entry.id)}>Checked</Button>
                </div>
              )}
            </div>
          ))}
        </List>
      </section>
    </>
  )
}

/** When a reminder is due, compactly: km left on top, days below (whichever exist), coloured by urgency. */
function DueSoonest({ status: st }: { status: ReminderView['status'] }) {
  const kmLine = st.kmLeft == null ? null : st.kmLeft >= 0 ? `${km(st.kmLeft)} left` : `${km(-st.kmLeft)} over`
  const dayLine = st.daysLeft == null ? null
    : st.daysLeft > 1 ? `${st.daysLeft} days` : st.daysLeft === 1 ? 'tomorrow' : st.daysLeft === 0 ? 'today' : `${-st.daysLeft} days late`
  const color = st.state === 'OVERDUE' ? 'text-red-600' : st.state === 'DUE_SOON' ? 'text-amber-600' : 'text-emerald-600'
  if (!kmLine && !dayLine) return <Badge className="shrink-0">set last done</Badge>
  return (
    <div className="num shrink-0 text-right">
      <div className={cx('text-sm font-semibold', color)}>{kmLine ?? dayLine}</div>
      {kmLine && dayLine && <div className="mt-0.5 text-[13px] text-stone-500">or {dayLine}</div>}
    </div>
  )
}

function RemindersSection({ id, onOpen, onAdd }: { id: number; onOpen: (r: ReminderView) => void; onAdd: () => void }) {
  const rows = useQuery({ queryKey: ['reminders', id], queryFn: () => api<ReminderView[]>(`/vehicles/${id}/reminders`) })
  const list = rows.data ?? []
  return (
    <section className="space-y-2">
      <SectionHeader title="Reminders" action={<AddLink label="Add" onClick={onAdd} />} />
      {rows.isLoading ? <Loading /> : !list.length ? (
        <Empty icon={<Bell size={36} />} title="No reminders">Oil changes, chain lube, services: by km, by date, or both.</Empty>
      ) : (
        <List>
          {list.map((r) => (
            <Row key={r.reminder.id} onClick={() => onOpen(r)}>
              <div className={`min-w-0 flex-1 ${r.reminder.active ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.reminder.title}</span>
                  {!r.reminder.active && <Badge>done</Badge>}
                </div>
                <Small>
                  {[r.reminder.intervalKm ? `every ${km(r.reminder.intervalKm)}` : null, r.reminder.intervalMonths ? `${r.reminder.intervalMonths} mo` : null].filter(Boolean).join(' / ') || 'once'}
                  {r.status.dueOdometer != null && r.status.kmLeft == null && ` · at ${km(r.status.dueOdometer)}`}
                </Small>
              </div>
              {r.reminder.active && <DueSoonest status={r.status} />}
            </Row>
          ))}
        </List>
      )}
    </section>
  )
}

function ServicesSection({ id, onOpen, onAdd }: { id: number; onOpen: (r: ServiceRow) => void; onAdd: () => void }) {
  const rows = useQuery({ queryKey: ['services', id], queryFn: () => api<ServiceRow[]>(`/vehicles/${id}/services`) })
  const list = rows.data ?? []
  return (
    <section className="space-y-2">
      <SectionHeader title="Service history" meta={list.length ? `${list.length} · ${money(list.reduce((t, r) => t + r.record.cost, 0))}` : undefined}
        action={<AddLink label="Log service" onClick={onAdd} />} />
      {rows.isLoading ? <Loading /> : !list.length ? (
        <Empty icon={<Wrench size={36} />} title="No services yet">Logging a service also resets the reminders it covers.</Empty>
      ) : (
        <List>
          {list.map((r) => (
            <Row key={r.record.id} onClick={() => onOpen(r)}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/12 text-sky-600"><Wrench size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.record.title}</div>
                <Small>{date(r.record.servicedOn)}{r.record.odometer != null ? ` · ${km(r.record.odometer)}` : ''}{r.record.workshop ? ` · ${r.record.workshop}` : ''}</Small>
              </div>
              <div className="num shrink-0 font-semibold">{money(r.record.cost)}</div>
            </Row>
          ))}
        </List>
      )}
    </section>
  )
}

export function PapersSection({ docs, onOpen, onAdd }: { docs: DocView[]; onOpen: (d: DocView) => void; onAdd: () => void }) {
  return (
    <section className="space-y-2">
      <SectionHeader title="Papers" action={<AddLink label="Add" onClick={onAdd} />} />
      {!docs.length ? (
        <Empty icon={<Scroll size={36} />} title="No papers">Add insurance, PUC, RC and road tax to be reminded before they expire.</Empty>
      ) : (
        <List>
          {docs.map((d) => (
            <Row key={d.document.id} onClick={() => onOpen(d)}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600"><Scroll size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.document.title}</div>
                <Small>{docLabel[d.document.type]}{d.document.number ? ` · ${d.document.number}` : ''}</Small>
              </div>
              <DocBadge d={d} />
            </Row>
          ))}
        </List>
      )}
    </section>
  )
}

export function DocBadge({ d }: { d: DocView }) {
  if (d.state === 'NO_EXPIRY') return <Badge className="shrink-0">no expiry</Badge>
  if (d.state === 'EXPIRED') return <Badge tone="bad" className="shrink-0">expired</Badge>
  if (d.state === 'EXPIRING') return <Badge tone="warn" className="shrink-0">{d.daysLeft === 0 ? 'today' : `${d.daysLeft} days`}</Badge>
  return <Badge tone="ok" className="shrink-0">till {date(d.document.expiresOn, false)}</Badge>
}

/** Where the money went, then the expenses list. */
function SpendTab({ id, summary, onOpen, onAdd }: { id: number; summary: Summary; onOpen: (e: Expense) => void; onAdd: () => void }) {
  const rows = useQuery({ queryKey: ['expenses', id], queryFn: () => api<Expense[]>(`/vehicles/${id}/expenses`) })
  const c = summary.costs
  const parts = [
    { label: 'Fuel', value: c.fuel, color: 'bg-accent' },
    { label: 'Service', value: c.service, color: 'bg-sky-500' },
    { label: 'Other', value: c.expenses, color: 'bg-violet-500' },
  ]
  const list = rows.data ?? []
  const months = summary.monthly.some((m) => m.fuel + m.service + m.other > 0) ? summary.monthly : []
  const monthAvg = months.reduce((t, m) => t + m.fuel + m.service + m.other, 0) / Math.max(1, months.length)
  return (
    <>
      <section className="space-y-2">
        <SectionHeader title="Where it went" />
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold tracking-tight">{money(c.total)}</span>
            {c.perKm != null && <span className="num text-sm text-stone-500">{money2(c.perKm)} per km</span>}
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            {c.total > 0 && parts.map((p) => (
              <motion.div key={p.label} className={p.color} initial={{ width: 0 }} animate={{ width: `${(p.value / c.total) * 100}%` }} transition={{ ...softSpring, delay: 0.1 }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {parts.map((p) => (
              <div key={p.label} className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className={cx('size-2 rounded-full', p.color)} /> {p.label}</div>
                <div className="num truncate text-sm font-semibold">{money(p.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {months.length >= 2 && (
        <section className="space-y-2">
          <SectionHeader title="By month" meta={`last ${months.length} months · avg ${money(monthAvg)}`} />
          <ChartCard>
            <BarChart data={months} margin={{ ...margin, left: -12 }}>
              {grid}
              <XAxis dataKey="month" {...axis} tickFormatter={(m: string) => monthLabel(m)} interval="preserveStartEnd" />
              <YAxis {...axis} tickCount={4} allowDecimals={false} tickFormatter={short} />
              <Tooltip labelFormatter={(m) => monthLabel(String(m), true)} formatter={(val, name) => [money(Number(val)), name === 'fuel' ? 'Fuel' : name === 'service' ? 'Service' : 'Other']}
                cursor={{ fill: 'currentColor', className: 'text-stone-500/10' }} {...tooltipStyle} />
              <Bar dataKey="fuel" stackId="m" fill="var(--color-accent)" isAnimationActive={false} />
              <Bar dataKey="service" stackId="m" fill="var(--color-sky-500, #0ea5e9)" isAnimationActive={false} />
              <Bar dataKey="other" stackId="m" fill="var(--color-violet-500, #8b5cf6)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartCard>
        </section>
      )}
      <section className="space-y-2">
        <SectionHeader title="Expenses" meta={list.length ? `${list.length} · ${money(c.expenses)}` : undefined} action={<AddLink label="Add" onClick={onAdd} />} />
        {rows.isLoading ? <Loading /> : !list.length ? (
          <Empty icon={<Receipt size={36} />} title="No expenses">Upgrades, accessories, riding gear, tolls and parking.</Empty>
        ) : (
          <List>
            {list.map((e) => (
              <Row key={e.id} onClick={() => onOpen(e)}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600"><Receipt size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.title}</div>
                  <Small>{expenseLabel[e.category]} · {date(e.spentOn, false)}{e.hisaabTxnId ? ' · Hisaab' : e.vendor ? ` · ${e.vendor}` : ''}</Small>
                </div>
                <div className="num shrink-0 font-semibold">{money(e.amount)}</div>
              </Row>
            ))}
          </List>
        )}
      </section>
    </>
  )
}

function TripsTab({ id }: { id: number }) {
  const rows = useQuery({ queryKey: ['trips', id], queryFn: () => api<Trip[]>(`/vehicles/${id}/trips`) })
  const unassign = useSave((tid: number) => api(`/trips/${tid}/unassign`, { method: 'POST' }), undefined, 'Moved back to Inbox')
  if (rows.isLoading) return <Loading />
  if (!rows.data?.length) return <Empty icon={<Path size={40} />} title="No trips">Trips you assign to this vehicle in the Inbox show up here.</Empty>
  const total = rows.data.reduce((t, x) => t + x.distanceM, 0) / 1000
  return (
    <section className="space-y-2">
      <SectionHeader title="Trips" meta={`${rows.data.length} · ≈ ${km(total)}`} />
      <List>
        {rows.data.map((t) => (
          <motion.div variants={listItem} key={t.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600"><Path size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{dateTime(t.startedAt)}</div>
              <Small>{km(t.distanceM / 1000)} · {Math.round((new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 60000)} min</Small>
            </div>
            <Button variant="ghost" className="shrink-0 !px-2.5 !py-1 text-xs" busy={unassign.isPending && unassign.variables === t.id} onClick={() => unassign.mutate(t.id)}>Remove</Button>
          </motion.div>
        ))}
      </List>
    </section>
  )
}
