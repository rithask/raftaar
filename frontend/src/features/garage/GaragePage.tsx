import { Bell, CaretRight, GasPump, Gauge, MagnifyingGlass, Plus, Scroll, Tray, Warning } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { date, economyUnit, km, money, n1 } from '@/lib/format'
import { type GarageCard, type Vehicle } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { FuelForm } from '@/features/fuel/FuelForm'
import { KindIcon, VehicleArt } from '@/features/vehicle/VehicleArt'
import { VehicleForm } from '@/features/vehicle/VehicleForm'
import { imageUrl } from '@/features/vehicle/photo'
import { Badge, Button, buttonStyle, Card, cx, EmptyState, ErrorText, IconBadge, listItem, listParent, Loading, PageHeader, Section, softSpring, surface } from '@/ui'
import { useGarage } from '@/lib/queries'
import { VehicleLink } from '@/features/vehicle/VehicleLink'

export function GaragePage() {
  const garage = useGarage()
  const [adding, setAdding] = useState(false)
  const [fuelFor, setFuelFor] = useState<GarageCard | null>(null)
  const hidden = useHidden()

  if (garage.isLoading) return <Loading />
  if (garage.error) return <ErrorText error={garage.error} />
  const data = garage.data!
  const all = data.vehicles.filter((card) => !hidden(`vehicle:${card.vehicle.id}`))
  const active = all.filter((card) => !card.vehicle.archived)
  const retired = all.filter((card) => card.vehicle.archived)
  const vehicles: Vehicle[] = active.map((card) => card.vehicle)
  const waiting = data.toConfirm + data.tripsToSort

  return (
    <div className="space-y-5">
      <PageHeader title="Garage" action={
        <div className="flex items-center gap-2">
          <Link to="/search" aria-label="Search" className={buttonStyle('secondary', '!px-3')}><MagnifyingGlass size={18} /></Link>
          <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} /> Add</Button>
        </div>
      } />

      <AnimatePresence initial={false}>
      {waiting > 0 && (
        <motion.div key="banner" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={softSpring} className="overflow-hidden">
        <Link to="/inbox" className="flex items-center gap-3 rounded-2xl bg-accent-soft p-4 text-sm ring-1 ring-accent-strong/20 transition duration-100 active:scale-[0.99] active:brightness-95">
          <Tray size={22} className="shrink-0 text-accent-strong" />
          <span className="flex-1">
            {data.toConfirm > 0 && <><b className="num">{data.toConfirm}</b> to confirm</>}
            {data.toConfirm > 0 && data.tripsToSort > 0 && ' · '}
            {data.tripsToSort > 0 && <><b className="num">{data.tripsToSort}</b> trip{data.tripsToSort === 1 ? '' : 's'} to sort</>}
          </span>
          <CaretRight size={18} />
        </Link>
        </motion.div>
      )}
      </AnimatePresence>

      {all.length === 0 ? (
        <EmptyState icon={<Gauge size={48} />} title="Your garage is empty">
          Add a vehicle to start tracking fuel, mileage and services.
          <div className="mt-4"><Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a vehicle</Button></div>
        </EmptyState>
      ) : (
        <motion.div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" variants={listParent} initial="hidden" animate="show">
          {active.map((card) => (
            <motion.div key={card.vehicle.id} variants={listItem} layout>
              <VehicleCard card={card} onFuel={() => setFuelFor(card)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {retired.length > 0 && (
        <Section title="Sold or retired">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {retired.map((card) => (
              <VehicleLink key={card.vehicle.id} vehicleId={card.vehicle.id} className={cx('flex items-center gap-3 rounded-2xl p-3 opacity-70 transition duration-100 active:scale-[0.99] active:opacity-100', surface)}>
                <VehicleArt vehicle={card.vehicle} className="size-12 rounded-xl" iconSize={22} small />
                <span className="font-medium">{card.vehicle.name}</span>
                <span className="num ml-auto text-sm text-stone-500">{km(card.odometer.known)}</span>
              </VehicleLink>
            ))}
          </div>
        </Section>
      )}

      <AnimatePresence>
        {adding && <VehicleForm key="add" open onClose={() => setAdding(false)} />}
        {fuelFor && (
          <FuelForm key="fuel" open onClose={() => setFuelFor(null)} vehicles={vehicles} vehicleId={fuelFor.vehicle.id}
            lastOdometer={fuelFor.odometer.known} estimatedOdometer={fuelFor.odometer.estimated} />
        )}
      </AnimatePresence>
    </div>
  )
}

function VehicleCard({ card, onFuel }: { card: GarageCard; onFuel: () => void }) {
  const vehicle = card.vehicle
  const currentKm = card.odometer.estimated ?? card.odometer.known
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')
  const overdue = card.attention.some((reminderView) => reminderView.status.state === 'OVERDUE') || card.papers.some((paper) => paper.state === 'EXPIRED')
  return (
    <Card raised className="group relative overflow-hidden rounded-3xl transition-shadow hover:shadow-md">
      <VehicleLink vehicleId={vehicle.id} className="block transition duration-100 active:opacity-80">
        {imageUrl(vehicle) ? (
        <div className="relative">
          <VehicleArt vehicle={vehicle} className="aspect-[16/10] w-full transition duration-300 group-hover:scale-[1.02]" iconSize={72} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 pt-12 text-white">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{vehicle.name}</h2>
                <p className="truncate text-sm text-white/75">{subtitle || ' '}</p>
              </div>
              {vehicle.registration && <span className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-stone-900">{vehicle.registration}</span>}
            </div>
          </div>
          {(card.attention.length > 0 || card.papers.length > 0) && (
            <span className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold shadow ${overdue ? 'bg-red-600 text-white' : 'bg-amber-400 text-stone-950'}`}>
              {overdue ? <Warning size={14} weight="bold" /> : <Bell size={14} weight="bold" />}
              {card.attention.length + card.papers.length}
            </span>
          )}
        </div>
        ) : (
          // no photo: a compact header instead of a big grey block
          <div className="flex items-center gap-3 px-4 pt-4">
            <IconBadge size="lg" square className="ring-1 ring-accent-strong/15"><KindIcon kind={vehicle.kind} size={26} /></IconBadge>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg leading-tight font-semibold">{vehicle.name}</h2>
              {subtitle && <p className="truncate text-sm text-stone-500">{subtitle}</p>}
              {vehicle.registration && <span className="mt-1 inline-block whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-stone-900 ring-1 ring-stone-900/15">{vehicle.registration}</span>}
            </div>
            {(card.attention.length > 0 || card.papers.length > 0) && (
              <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${overdue ? 'bg-red-600 text-white' : 'bg-amber-400 text-stone-950'}`}>
                {overdue ? <Warning size={14} weight="bold" /> : <Bell size={14} weight="bold" />}
                {card.attention.length + card.papers.length}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <Mini label="Odometer" value={currentKm != null ? km(currentKm) : '—'} approx={card.odometer.estimated != null} />
          <Mini label="Mileage" value={card.averageEconomy != null ? `${n1(card.averageEconomy)}` : '—'} unit={card.averageEconomy != null ? economyUnit(card.unit) : undefined} />
          <Mini label="This month" value={money(card.spentThisMonth)} />
        </div>
        <div className="space-y-1.5 px-4 pt-3">
          {card.attention.slice(0, 2).map((reminderView) => (
            <div key={reminderView.reminder.id} className="flex items-center gap-2 text-sm">
              <Badge tone={reminderView.status.state === 'OVERDUE' ? 'bad' : 'warn'}>{reminderView.reminder.title}</Badge>
              <span className="truncate text-stone-500">{reminderView.status.summary.replace(/^Due /, '')}</span>
            </div>
          ))}
          {card.papers.slice(0, 2).map((paper) => (
            <div key={paper.document.id} className="flex items-center gap-2 text-sm">
              <Badge tone={paper.state === 'EXPIRED' ? 'bad' : 'warn'}><Scroll size={12} /> {paper.document.title}</Badge>
              <span className="truncate text-stone-500">{paper.state === 'EXPIRED' ? `expired ${date(paper.document.expiresOn)}` : paper.daysLeft === 0 ? 'expires today' : `expires in ${paper.daysLeft} days`}</span>
            </div>
          ))}
        </div>
      </VehicleLink>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-4">
        <span className="truncate text-xs text-stone-500">{card.lastFill ? `Last filled ${date(card.lastFill.filledAt, false)}` : 'No fill-ups yet'}</span>
        <Button variant="primary" className="!py-2" onClick={onFuel}><GasPump size={16} /> Fuel</Button>
      </div>
    </Card>
  )
}

function Mini({ label, value, unit, approx }: { label: string; value: string; unit?: string; approx?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="num truncate text-sm font-semibold">
        {approx && <span className="text-stone-400">≈</span>}{value}
        {unit && <span className="ml-0.5 text-[11px] font-normal text-stone-500">{unit}</span>}
      </div>
    </div>
  )
}
