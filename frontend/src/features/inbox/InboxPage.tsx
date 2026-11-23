import { Check, GasPump, MapPin, Path, Receipt, Tray, Warning, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { ago, date, dateTime, km, money, money2, n2, time } from '@/lib/format'
import { type Inbox, type Trip, type Vehicle } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { FuelForm } from '@/features/fuel/FuelForm'
import { KindIcon } from '@/features/vehicle/VehicleArt'
import { Badge, Button, Card, Chip, easeOut, EmptyState, ErrorText, Loading, PageHeader, popSpring, Section, softSpring, TabPager } from '@/ui'
import { refresh, useInbox, useIntegrations, useVehicles } from '@/lib/queries'
import { VehicleLink } from '@/features/vehicle/VehicleLink'
import { HandledList } from './HandledList'

type Pending = Inbox['suggestions'][number]
/** Cards come in softly, and slide off to the left when they're dealt with; the rest close the gap. */
const cardMotion = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, x: 0, transition: softSpring },
  exit: { opacity: 0, x: -90, transition: { duration: 0.22, ease: easeOut } },
} as const
const MODE: Record<string, string> = { CAR: 'Car', MOTORCYCLE: 'Motorcycle', UNKNOWN: 'Unknown mode' }

/** The Inbox: what's waiting for you (To do) and what you've already dealt with (Done), side by side. */
export function InboxPage() {
  const inbox = useInbox()
  const vehicles = useVehicles()
  const [confirming, setConfirming] = useState<Pending | null>(null)

  if (inbox.isLoading || vehicles.isLoading) return <Loading />
  if (inbox.error) return <ErrorText error={inbox.error} />
  const active = (vehicles.data ?? []).filter((vehicle) => !vehicle.archived)

  return (
    <div className="space-y-5">
      <PageHeader title="Inbox" />
      <TabPager tabs={[
        { value: 'todo', label: 'To do', content: <ToDo data={inbox.data!} vehicles={active} onConfirm={setConfirming} /> },
        { value: 'done', label: 'Done', content: <HandledList vehicles={vehicles.data ?? []} /> },
      ]} />

      <AnimatePresence>
      {confirming?.suggestion.kind === 'FUEL' && (
        <FuelForm key="fuel" open onClose={() => setConfirming(null)} vehicles={active} suggestion={confirming.suggestion} estimatedOdometer={confirming.estimatedOdometer} />
      )}
      {confirming?.suggestion.kind === 'EXPENSE' && (
        <ExpenseForm key="expense" open onClose={() => setConfirming(null)} vehicles={active} suggestion={confirming.suggestion} />
      )}
      </AnimatePresence>
    </div>
  )
}

/** Suggestions to add or dismiss, fill-ups to check, and trips to put on a vehicle. */
function ToDo({ data, vehicles, onConfirm }: { data: Inbox; vehicles: Vehicle[]; onConfirm: (suggestion: Pending) => void }) {
  const dismiss = useSave((id: number) => api(`/suggestions/${id}/dismiss`, { method: 'POST' }), {
    refresh: refresh.inbox, done: 'Dismissed', undo: (_, id) => api(`/suggestions/${id}/restore`, { method: 'POST' }),
  })
  const name = (id: number | null) => vehicles.find((vehicle) => vehicle.id === id)?.name
  if (!data.trips.length && !data.suggestions.length && !data.issues.length) return <InboxEmpty />

  return (
    <>
      {data.suggestions.length > 0 && (
        <Section title="To confirm" className="!space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
          {data.suggestions.map((p) => {
            const suggestion = p.suggestion
            const fuel = suggestion.kind === 'FUEL'
            return (
              <motion.div key={suggestion.id} {...cardMotion}>
              <Card padded raised className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2 ${fuel ? 'bg-accent-soft text-accent-strong' : 'bg-sky-500/15 text-sky-600'}`}>{fuel ? <GasPump size={22} /> : <Receipt size={22} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{suggestion.stationName ?? suggestion.payee ?? (fuel ? 'Fuel stop' : 'Payment')}</span>
                      {suggestion.hisaabTxnId && <Badge tone="info">Hisaab</Badge>}
                      {suggestion.stopAt && <Badge tone="info">GeoPulse</Badge>}
                    </div>
                    <div className="text-sm text-stone-500">
                      {dateTime(suggestion.occurredAt)}
                      {suggestion.region && <> · <MapPin size={12} className="inline" /> {[suggestion.district, suggestion.region].filter(Boolean).join(', ')}</>}
                    </div>
                    <div className="mt-1 text-sm">{suggestion.note}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{suggestion.amount != null ? money(suggestion.amount) : '—'}</div>
                    {fuel && p.estimatedVolume && <div className="num text-xs text-stone-500">≈ {n2(p.estimatedVolume)} L at {money2(suggestion.suggestedPrice)}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={() => onConfirm(p)}>
                    <Check size={16} /> {fuel ? `Add fill-up${name(suggestion.suggestedVehicleId) ? ` · ${name(suggestion.suggestedVehicleId)}` : ''}` : 'Add expense'}
                  </Button>
                  <Button variant="ghost" busy={dismiss.isPending && dismiss.variables === suggestion.id} onClick={() => dismiss.mutate(suggestion.id)}><X size={16} /> Dismiss</Button>
                </div>
              </Card>
              </motion.div>
            )
          })}
          </AnimatePresence>
        </Section>
      )}

      {data.issues.length > 0 && (
        <Section title="Needs a look" className="!space-y-3">
          {data.issues.map((fill) => (
            <VehicleLink key={fill.id} vehicleId={fill.vehicleId} className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm transition duration-100 active:scale-[0.99] active:bg-amber-500/20">
              <Warning size={20} className="text-amber-600" />
              <span className="flex-1">{name(fill.vehicleId) ?? 'Fill-up'} · {date(fill.filledAt)} · {money(fill.totalCost)} — {fill.sourceIssue}</span>
            </VehicleLink>
          ))}
        </Section>
      )}

      {data.trips.length > 0 && <Trips trips={data.trips} vehicles={vehicles} />}
    </>
  )
}

/** Trips by day. Tap a vehicle on a trip, or pick several and put them all on one vehicle. */
function Trips({ trips, vehicles }: { trips: Trip[]; vehicles: Vehicle[] }) {
  const [picked, setPicked] = useState<number[]>([])
  const vname = (id: number | null) => vehicles.find((vehicle) => vehicle.id === id)?.name
  const assign = useSave(
    (a: { ids: number[]; vehicleId: number | null }) => api('/trips/assign', { body: { tripIds: a.ids, vehicleId: a.vehicleId } }).then(() => a),
    {
      refresh: refresh.inbox,
      onDone: () => setPicked([]),
      done: (a) => (a.vehicleId ? `${a.ids.length === 1 ? 'Trip' : `${a.ids.length} trips`} added to ${vname(a.vehicleId)}` : a.ids.length === 1 ? 'Trip hidden' : `${a.ids.length} trips hidden`),
      undo: (a) => api('/trips/unassign', { body: { tripIds: a.ids } }),
    },
  )
  const days = useMemo(() => {
    const m = new Map<string, Trip[]>()
    for (const trip of trips) {
      const k = date(trip.startedAt)
      m.set(k, [...(m.get(k) ?? []), trip])
    }
    return [...m.entries()]
  }, [trips])
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <Section title="Trips to sort" meta={String(trips.length)} className="!space-y-3"
      action={picked.length === 0 && trips.length > 1 && <Button variant="ghost" className="!py-1 text-xs" onClick={() => setPicked(trips.map((trip) => trip.id))}>Select all</Button>}>
      <AnimatePresence>
      {picked.length > 0 && (
        <motion.div key="bar" className="sticky top-2 z-20 sm:top-16" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={softSpring}>
        <Card padded raised className="space-y-2 shadow-lg">
          <div className="text-sm">Assign <b className="num">{picked.length}</b> trip{picked.length === 1 ? '' : 's'} to</div>
          <div className="flex flex-wrap gap-2">
            {vehicles.map((vehicle) => (
              <Button key={vehicle.id} variant="primary" className="!py-1.5" busy={assign.isPending} onClick={() => assign.mutate({ ids: picked, vehicleId: vehicle.id })}>
                <KindIcon kind={vehicle.kind} size={16} /> {vehicle.name}
              </Button>
            ))}
            <Button variant="secondary" className="!py-1.5" onClick={() => assign.mutate({ ids: picked, vehicleId: null })}>Not mine</Button>
            <Button variant="ghost" className="!py-1.5" onClick={() => setPicked([])}>Cancel</Button>
          </div>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>
      <ErrorText error={assign.error} />
      {days.map(([day, list]) => (
        <div key={day} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{day}</span>
            <button className="rounded px-1 underline transition active:opacity-60" onClick={() => setPicked((p) => [...new Set([...p, ...list.map((trip) => trip.id)])])}>Select day</button>
          </div>
          <AnimatePresence initial={false} mode="popLayout">
          {list.map((trip) => (
            <motion.div key={trip.id} {...cardMotion}>
            <Card padded raised className={`!p-3 transition-shadow ${picked.includes(trip.id) ? 'ring-2 !ring-accent' : ''}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(trip.id)} aria-pressed={picked.includes(trip.id)} className={`-m-2 flex size-10 shrink-0 items-center justify-center rounded-lg transition active:scale-90 active:bg-stone-100 dark:active:bg-stone-800`} aria-label="Select trip">
                  <span className={`flex size-6 items-center justify-center rounded-md ring-1 ${picked.includes(trip.id) ? 'bg-accent text-on-accent ring-accent' : 'ring-stone-300 dark:ring-stone-600'}`}>
                  <AnimatePresence>
                    {picked.includes(trip.id) && (
                      <motion.span key="tick" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={popSpring}>
                        <Check size={14} weight="bold" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  </span>
                </button>
                <Path size={18} className="text-stone-400" />
                <div className="min-w-0 flex-1">
                  <div className="num text-sm font-medium">{time(trip.startedAt)} – {time(trip.endedAt)} · {km(trip.distanceM / 1000)}</div>
                  <div className="text-xs text-stone-500">{MODE[trip.movementType ?? 'UNKNOWN'] ?? 'Unknown mode'}</div>
                </div>
              </div>
              {picked.length === 0 && (
                <div className="mt-2 flex flex-wrap gap-2 pl-9">
                  {vehicles.map((vehicle) => (
                    <Chip key={vehicle.id} onClick={() => assign.mutate({ ids: [trip.id], vehicleId: vehicle.id })} className={trip.suggestedVehicleId === vehicle.id ? '!bg-accent-soft !ring-accent-strong/40' : ''}>
                      <KindIcon kind={vehicle.kind} size={14} /> {vehicle.name}
                    </Chip>
                  ))}
                  <Chip onClick={() => assign.mutate({ ids: [trip.id], vehicleId: null })} className="text-stone-500">Not mine</Chip>
                </div>
              )}
            </Card>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      ))}
    </Section>
  )
}

/**
 * An empty Inbox says what would fill it, going by what's connected: nothing (how to connect), one or both
 * (what comes from each, and when it last looked), or a connection that's failing.
 */
function InboxEmpty() {
  const integrations = useIntegrations()
  if (integrations.isLoading) return <Loading />
  const on = (integrations.data ?? []).filter((i) => (i.name === 'geopulse' || i.name === 'hisaab') && i.configured)
  const failing = on.filter((i) => i.status.lastError)
  const what = { geopulse: 'trips from GeoPulse', hisaab: 'fuel payments from Hisaab' } as const
  const settings = (
    <Link to="/settings/connections" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition active:scale-95">
      Open Settings
    </Link>
  )
  if (!on.length) {
    return (
      <EmptyState icon={<Tray size={48} />} title="Nothing to sort">
        Connect GeoPulse to bring in your trips, or Hisaab to bring in fuel payments, and they'll show up here to confirm.
        <div>{settings}</div>
      </EmptyState>
    )
  }
  if (failing.length) {
    const integration = failing[0]
    return (
      <EmptyState icon={<Warning size={48} />} title={`${integration.name === 'geopulse' ? 'GeoPulse' : 'Hisaab'} isn't syncing`}>
        {integration.status.lastError}{/[.!?]$/.test(integration.status.lastError ?? '') ? '' : '.'} Nothing new can arrive until it does.
        <div>{settings}</div>
      </EmptyState>
    )
  }
  const lastRun = on.map((i) => i.status.lastRun).filter(Boolean).sort().at(-1)
  return (
    <EmptyState icon={<Tray size={48} />} title="All caught up">
      New {on.map((i) => what[i.name as 'geopulse' | 'hisaab']).join(' and ')} show up here.
      {lastRun && <span className="mt-1 block text-xs">Last checked {ago(lastRun)}.</span>}
    </EmptyState>
  )
}

