import { Scroll, Wrench } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { economyUnit, money, money2, n1 } from '@/lib/format'
import { useHidden } from '@/lib/undo'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { FuelForm } from '@/features/fuel/FuelForm'
import { OdometerForm } from '@/features/odometer/OdometerForm'
import { DocumentForm } from '@/features/papers/DocumentForm'
import { ReminderForm } from '@/features/upkeep/ReminderForm'
import { ServiceForm } from '@/features/upkeep/ServiceForm'
import { FuelFab } from './QuickAdd'
import { VehicleForm } from './VehicleForm'
import { AttentionChip, CompactBar, Figure, Header, useInView } from './VehicleHeader'
import { type Open } from './open'
import { FuelTab } from './tabs/FuelTab'
import { PapersSection } from './tabs/PapersTab'
import { SpendTab } from './tabs/SpendTab'
import { TripsTab } from './tabs/TripsTab'
import { RemindersSection, ServicesSection } from './tabs/UpkeepTab'
import { Card, ErrorBoundary, ErrorText, Loading, Tabs } from '@/ui'
import { useVehiclePage, useVehicles } from '@/lib/queries'

export type Tab = 'fuel' | 'upkeep' | 'papers' | 'spend' | 'trips'
export const TABS: Tab[] = ['fuel', 'upkeep', 'papers', 'spend', 'trips']
export function VehiclePage() {
  const id = Number(useParams().id)
  const page = useVehiclePage(id)
  const vehicles = useVehicles()
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
  const headInView = useInView(headRef, !page.isLoading)
  const hidden = useHidden()

  if (page.isLoading) return <Loading />
  if (page.error) return <ErrorText error={page.error} />
  const { summary: s, fuel, reminders, services, expenses, trips } = page.data!
  const v = s.vehicle
  const odo = s.odometer.estimated ?? s.odometer.known
  const activeVehicles = (vehicles.data ?? [v]).filter((x) => !x.archived || x.id === v.id)
  const due = s.reminders.filter((r) => (r.status.state === 'OVERDUE' || r.status.state === 'DUE_SOON') && !hidden(`reminder:${r.reminder.id}`))
  const docs = s.documents.filter((d) => !hidden(`doc:${d.document.id}`))
  const papers = docs.filter((d) => d.state === 'EXPIRED' || d.state === 'EXPIRING')
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
      <Card padded raised className="rounded-3xl">
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
      </Card>

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
          {tab === 'fuel' && <FuelTab vehicleId={id} summary={s} fills={fuel} onOpen={(row) => setOpen({ kind: 'fuel', row })} />}
          {tab === 'upkeep' && (
            <>
              <RemindersSection vehicleId={id} reminders={reminders} odometer={odo} onOpen={(r) => setOpen({ kind: 'reminder', r })} onAdd={() => setOpen({ kind: 'reminder' })} />
              <ServicesSection services={services} onOpen={(row) => setOpen({ kind: 'service', row })} onAdd={() => setOpen({ kind: 'service' })} />
            </>
          )}
          {tab === 'papers' && <PapersSection docs={docs} onOpen={(d) => setOpen({ kind: 'doc', d })} onRenew={(d) => setOpen({ kind: 'doc', d, renewing: true })} onAdd={() => setOpen({ kind: 'doc' })} />}
          {tab === 'spend' && <SpendTab summary={s} expenses={expenses} onOpen={(e) => setOpen({ kind: 'expense', e })} onAdd={() => setOpen({ kind: 'expense' })} />}
          {tab === 'trips' && <TripsTab trips={trips} />}
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
        {open?.kind === 'doc' && <DocumentForm key="doc" open onClose={close} vehicles={activeVehicles} vehicleId={id} doc={open.d?.document} renewing={open.renewing} />}
        {open?.kind === 'expense' && <ExpenseForm key="expense" open onClose={close} vehicles={activeVehicles} vehicleId={id} expense={open.e} />}
        {open?.kind === 'odometer' && <OdometerForm key="odometer" open onClose={close} vehicleId={id} current={s.odometer.known} odometer={s.odometer} />}
      </AnimatePresence>
    </div>
  )
}
