import { Scroll, Wrench } from '@phosphor-icons/react'
import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { date, economyUnit, money, money2, n1 } from '@/lib/format'
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
import { type VehiclePageData } from '@/lib/types'
import { useOpenParam } from '@/lib/useOpenParam'
import { FuelTab } from './tabs/FuelTab'
import { PapersSection } from './tabs/PapersTab'
import { SpendTab } from './tabs/SpendTab'
import { TripsTab } from './tabs/TripsTab'
import { RemindersSection, ServicesSection } from './tabs/UpkeepTab'
import { Card, ErrorText, Loading, TabPager } from '@/ui'
import { useVehiclePage, useVehicles } from '@/lib/queries'

export function VehiclePage() {
  const id = Number(useParams().id)
  const page = useVehiclePage(id)
  const [params] = useSearchParams()
  const vehicles = useVehicles()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const headRef = useRef<HTMLDivElement>(null)
  const headInView = useInView(headRef, !page.isLoading)
  const hidden = useHidden()
  // a record named in the address (from search) opens once the page has loaded
  useOpenParam(page.data != null, (kind, recordId) => recordToOpen(page.data!, kind, recordId), setOpen)

  if (page.isLoading) return <Loading />
  if (page.error) return <ErrorText error={page.error} />
  const { summary, fuel, reminders, services, expenses, trips } = page.data!
  const vehicle = summary.vehicle
  const currentKm = summary.odometer.estimated ?? summary.odometer.known
  const activeVehicles = (vehicles.data ?? [vehicle]).filter((x) => !x.archived || x.id === vehicle.id)
  const due = summary.reminders.filter((reminderView) => (reminderView.status.state === 'OVERDUE' || reminderView.status.state === 'DUE_SOON') && !hidden(`reminder:${reminderView.reminder.id}`))
  const docs = summary.documents.filter((paper) => !hidden(`doc:${paper.document.id}`))
  const papers = docs.filter((paper) => paper.state === 'EXPIRED' || paper.state === 'EXPIRING')
  // a sold or retired vehicle: its history to look at, nothing to act on (no chips, dots, Fuel or quick add)
  const retired = vehicle.archived
  const worst = (bad: boolean, any: boolean) => (retired ? undefined : bad ? 'bad' : any ? 'warn' : undefined)

  return (
    <div className="space-y-5 pb-20 [--sticky-top:3.25rem] sm:pb-0 sm:[--sticky-top:0px]">
      <div ref={headRef}>
        <Header vehicle={vehicle} onEdit={() => setOpen({ kind: 'vehicle' })} onFuel={() => setOpen({ kind: 'fuel' })} onPick={setOpen} />
      </div>
      <CompactBar vehicle={vehicle} visible={!headInView} onEdit={() => setOpen({ kind: 'vehicle' })} />
      {retired && (
        <p className="rounded-2xl bg-stone-200/60 px-4 py-3 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">
          <b className="font-semibold text-stone-800 dark:text-stone-100">{vehicle.soldOn ? `Sold or retired on ${date(vehicle.soldOn)}.` : 'Sold or retired.'}</b>{' '}
          Its history stays here. To use it again, turn off Sold or retired in Edit.
        </p>
      )}

      {/* phones and tablets: one column. Wide screens: tabs on the left, the numbers and what's due in a column on the right. */}
      <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-6 xl:space-y-0">
      <aside className="space-y-5 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1">
      {/* the three numbers that matter, and one quiet line under them */}
      <Card padded raised className="rounded-3xl">
        <div className="grid grid-cols-3 divide-x divide-stone-900/5 dark:divide-white/10">
          <div className="min-w-0 pr-2">
            <button type="button" onClick={() => setOpen({ kind: 'odometer' })} aria-label="Update odometer"
              className="-m-2 w-[calc(100%+1rem)] rounded-xl p-2 text-left transition active:scale-[0.97] active:bg-stone-100 dark:active:bg-stone-800">
              <Figure label="Odometer" value={currentKm != null ? `${summary.odometer.estimated != null ? '≈' : ''}${Math.round(currentKm).toLocaleString('en-IN')}` : '—'} unit="km" edit />
            </button>
          </div>
          <div className="min-w-0 px-3">
            <Figure label="Mileage" value={summary.averageEconomy != null ? n1(summary.averageEconomy) : '—'} unit={summary.averageEconomy != null ? economyUnit(summary.unit) : undefined} />
          </div>
          <div className="min-w-0 pl-3">
            <Figure label="Per km" value={summary.costs.perKm != null ? money2(summary.costs.perKm) : '—'} />
          </div>
        </div>
        <p className="num mt-3 border-t border-stone-900/5 pt-3 text-xs text-stone-500 dark:border-white/10">
          {[
            summary.odometer.kmPerDay != null ? `${n1(summary.odometer.kmPerDay)} km a day` : null,
            `${money(summary.costs.thisMonth)} this month`,
            summary.lastEconomy != null && summary.averageEconomy != null && summary.lastEconomy !== summary.averageEconomy ? `last tank ${n1(summary.lastEconomy)}` : null,
            summary.averageEconomy == null ? 'mileage after two full tanks' : null,
          ].filter(Boolean).join('  ·  ')}
        </p>
      </Card>

      {!retired && (due.length > 0 || papers.length > 0) && (
        // what needs doing soon, as one row of chips (the tabs below have the details)
        <section aria-label="Coming up" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 xl:flex-col xl:items-stretch">
          {due.map((reminderView) => (
            <AttentionChip key={`r${reminderView.reminder.id}`} bad={reminderView.status.state === 'OVERDUE'} icon={<Wrench size={14} />} title={reminderView.reminder.title}
              detail={reminderView.status.summary.replace(/^Due /, '')} onClick={() => setOpen({ kind: 'service' })} />
          ))}
          {papers.map((paper) => (
            <AttentionChip key={`d${paper.document.id}`} bad={paper.state === 'EXPIRED'} icon={<Scroll size={14} />} title={paper.document.title}
              detail={paper.state === 'EXPIRED' ? 'expired' : paper.daysLeft === 0 ? 'today' : `${paper.daysLeft} days`}
              onClick={() => setOpen({ kind: 'doc', d: paper })} />
          ))}
        </section>
      )}
      </aside>

      {/* the tabs' pages side by side: tap a tab or swipe between them */}
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <TabPager initial={startTab(params.get('tab'))} tabs={[
          { value: 'fuel', label: 'Fuel', content: <FuelTab vehicleId={id} summary={summary} fills={fuel} onOpen={(fill) => setOpen({ kind: 'fuel', row: fill })} /> },
          {
            value: 'upkeep', label: 'Upkeep', dot: worst(due.some((reminderView) => reminderView.status.state === 'OVERDUE'), due.length > 0),
            content: (
              <>
                <RemindersSection vehicleId={id} reminders={reminders} odometer={currentKm} retired={retired} onOpen={(reminderView) => setOpen({ kind: 'reminder', reminderView })} onAdd={() => setOpen({ kind: 'reminder' })} />
                <ServicesSection services={services} onOpen={(service) => setOpen({ kind: 'service', row: service })} onAdd={() => setOpen({ kind: 'service' })} />
              </>
            ),
          },
          {
            value: 'papers', label: 'Papers', dot: worst(papers.some((paper) => paper.state === 'EXPIRED'), papers.length > 0),
            content: <PapersSection docs={docs} onOpen={(paper) => setOpen({ kind: 'doc', d: paper })} onRenew={(paper) => setOpen({ kind: 'doc', d: paper, renewing: true })} onAdd={() => setOpen({ kind: 'doc' })} />,
          },
          { value: 'spend', label: 'Spend', content: <SpendTab summary={summary} expenses={expenses} onOpen={(expense) => setOpen({ kind: 'expense', e: expense })} onAdd={() => setOpen({ kind: 'expense' })} /> },
          { value: 'trips', label: 'Trips', content: <TripsTab trips={trips} /> },
        ]} />
      </div>
      </div>

      {!retired && <FuelFab onClick={() => setOpen({ kind: 'fuel' })} onPick={setOpen} hidden={open !== null} />}

      <AnimatePresence>
        {open?.kind === 'vehicle' && <VehicleForm key="vehicle" open onClose={close} vehicle={vehicle} />}
        {open?.kind === 'fuel' && <FuelForm key="fuel" open onClose={close} vehicles={activeVehicles} vehicleId={id} entry={open.row?.entry} lastOdometer={summary.odometer.known} estimatedOdometer={summary.odometer.estimated} />}
        {open?.kind === 'service' && <ServiceForm key="service" open onClose={close} vehicleId={id} row={open.row} reminders={summary.reminders} odometer={currentKm} />}
        {open?.kind === 'reminder' && <ReminderForm key="reminder" open onClose={close} vehicleId={id} reminder={open.reminderView?.reminder} odometer={currentKm} />}
        {open?.kind === 'doc' && <DocumentForm key="doc" open onClose={close} vehicles={activeVehicles} vehicleId={id} doc={open.d?.document} renewing={open.renewing} />}
        {open?.kind === 'expense' && <ExpenseForm key="expense" open onClose={close} vehicles={activeVehicles} vehicleId={id} expense={open.e} />}
        {open?.kind === 'odometer' && <OdometerForm key="odometer" open onClose={close} vehicleId={id} current={summary.odometer.known} odometer={summary.odometer} />}
      </AnimatePresence>
    </div>
  )
}

const TABS = ['fuel', 'upkeep', 'papers', 'spend', 'trips'] as const

/** The tab to start on, from ?tab= (a search result's), if it's one of them. */
const startTab = (tab: string | null) => TABS.find((value) => value === tab)

/** A record of this vehicle as something to open, from its kind and id (see useOpenParam); null when it's gone. */
function recordToOpen(data: VehiclePageData, kind: string, id: number): Open {
  switch (kind) {
    case 'fuel': { const row = data.fuel.find((fill) => fill.entry.id === id); return row ? { kind: 'fuel', row } : null }
    case 'service': { const row = data.services.find((service) => service.record.id === id); return row ? { kind: 'service', row } : null }
    case 'expense': { const e = data.expenses.find((expense) => expense.id === id); return e ? { kind: 'expense', e } : null }
    case 'reminder': { const reminderView = data.reminders.find((view) => view.reminder.id === id); return reminderView ? { kind: 'reminder', reminderView } : null }
    case 'doc': { const d = data.summary.documents.find((paper) => paper.document.id === id); return d ? { kind: 'doc', d } : null }
    default: return null
  }
}
