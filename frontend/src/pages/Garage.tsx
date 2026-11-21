import { Bell, CaretRight, GasPump, Gauge, Plus, Scroll, Tray, Warning } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, imageUrl, type Card, type Garage, type Vehicle } from '../api'
import { FuelForm } from '../components/FuelForm'
import { Badge, Button, Empty, ErrorText, listItem, listParent, Loading, softSpring } from '../components/ui'
import { KindIcon, VehicleArt } from '../components/VehicleArt'
import { VehicleForm } from '../components/VehicleForm'
import { date, economyUnit, km, money, n1 } from '../format'
import { useHidden } from '../undo'

export function GaragePage() {
  const garage = useQuery({ queryKey: ['garage'], queryFn: () => api<Garage>('/garage') })
  const [adding, setAdding] = useState(false)
  const [fuelFor, setFuelFor] = useState<Card | null>(null)
  const hidden = useHidden()

  if (garage.isLoading) return <Loading />
  if (garage.error) return <ErrorText error={garage.error} />
  const data = garage.data!
  const all = data.vehicles.filter((c) => !hidden(`vehicle:${c.vehicle.id}`))
  const active = all.filter((c) => !c.vehicle.archived)
  const retired = all.filter((c) => c.vehicle.archived)
  const vehicles: Vehicle[] = active.map((c) => c.vehicle)
  const waiting = data.toConfirm + data.tripsToSort

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-none font-bold tracking-tight">Garage</h1>
        <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} /> Add</Button>
      </div>

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
        <Empty icon={<Gauge size={48} />} title="Your garage is empty">
          Add a vehicle to start tracking fuel, mileage and services.
          <div className="mt-4"><Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a vehicle</Button></div>
        </Empty>
      ) : (
        <motion.div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" variants={listParent} initial="hidden" animate="show">
          {active.map((c) => (
            <motion.div key={c.vehicle.id} variants={listItem} layout>
              <VehicleCard card={c} onFuel={() => setFuelFor(c)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {retired.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-stone-500">Sold or retired</h2>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {retired.map((c) => (
              <Link key={c.vehicle.id} to={`/vehicles/${c.vehicle.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 opacity-70 ring-1 ring-stone-900/5 transition duration-100 active:scale-[0.99] active:opacity-100 dark:bg-stone-900 dark:ring-white/10">
                <VehicleArt vehicle={c.vehicle} className="size-12 rounded-xl" iconSize={22} small />
                <span className="font-medium">{c.vehicle.name}</span>
                <span className="num ml-auto text-sm text-stone-500">{km(c.odometer.known)}</span>
              </Link>
            ))}
          </div>
        </div>
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

function VehicleCard({ card, onFuel }: { card: Card; onFuel: () => void }) {
  const v = card.vehicle
  const odo = card.odometer.estimated ?? card.odometer.known
  const subtitle = [v.make, v.model, v.year].filter(Boolean).join(' ')
  const overdue = card.attention.some((r) => r.status.state === 'OVERDUE') || card.papers.some((d) => d.state === 'EXPIRED')
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-900/5 transition-shadow hover:shadow-md dark:bg-stone-900 dark:ring-white/10">
      <Link to={`/vehicles/${v.id}`} className="block transition duration-100 active:opacity-80">
        {imageUrl(v) ? (
        <div className="relative">
          <VehicleArt vehicle={v} className="aspect-[16/10] w-full transition duration-300 group-hover:scale-[1.02]" iconSize={72} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 pt-12 text-white">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{v.name}</h2>
                <p className="truncate text-sm text-white/75">{subtitle || ' '}</p>
              </div>
              {v.registration && <span className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-stone-900">{v.registration}</span>}
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
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong ring-1 ring-accent-strong/15">
              <KindIcon kind={v.kind} size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg leading-tight font-semibold">{v.name}</h2>
              {subtitle && <p className="truncate text-sm text-stone-500">{subtitle}</p>}
              {v.registration && <span className="mt-1 inline-block whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-stone-900 ring-1 ring-stone-900/15">{v.registration}</span>}
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
          <Mini label="Odometer" value={odo != null ? km(odo) : '—'} approx={card.odometer.estimated != null} />
          <Mini label="Mileage" value={card.averageEconomy != null ? `${n1(card.averageEconomy)}` : '—'} unit={card.averageEconomy != null ? economyUnit(card.unit) : undefined} />
          <Mini label="This month" value={money(card.spentThisMonth)} />
        </div>
        <div className="space-y-1.5 px-4 pt-3">
          {card.attention.slice(0, 2).map((r) => (
            <div key={r.reminder.id} className="flex items-center gap-2 text-sm">
              <Badge tone={r.status.state === 'OVERDUE' ? 'bad' : 'warn'}>{r.reminder.title}</Badge>
              <span className="truncate text-stone-500">{r.status.summary.replace(/^Due /, '')}</span>
            </div>
          ))}
          {card.papers.slice(0, 2).map((d) => (
            <div key={d.document.id} className="flex items-center gap-2 text-sm">
              <Badge tone={d.state === 'EXPIRED' ? 'bad' : 'warn'}><Scroll size={12} /> {d.document.title}</Badge>
              <span className="truncate text-stone-500">{d.state === 'EXPIRED' ? `expired ${date(d.document.expiresOn)}` : d.daysLeft === 0 ? 'expires today' : `expires in ${d.daysLeft} days`}</span>
            </div>
          ))}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-4">
        <span className="truncate text-xs text-stone-500">{card.lastFill ? `Last filled ${date(card.lastFill.filledAt, false)}` : 'No fill-ups yet'}</span>
        <Button variant="primary" className="!py-2" onClick={onFuel}><GasPump size={16} /> Fuel</Button>
      </div>
    </div>
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
