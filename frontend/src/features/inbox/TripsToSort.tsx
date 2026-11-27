import { Check, Path } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { refresh } from '@/lib/queries'
import { type Trip, type Vehicle } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { vehicleNames } from '@/lib/vehicles'
import { KindIcon } from '@/features/vehicle/VehicleArt'
import { Button, Card, Chip, ErrorText, popSpring, Section, softSpring } from '@/ui'
import { byDay } from './byDay'
import { cardMotion } from './cardMotion'
import { inboxRequests } from './inboxRequests'
import { tripTitle } from './labels'

const MODE: Record<string, string> = { CAR: 'Car', MOTORCYCLE: 'Motorcycle', UNKNOWN: 'Unknown mode' }

/** Trips by day. Tap a vehicle on a trip, or pick several and put them all on one vehicle. */
export function TripsToSort({ trips, vehicles }: { trips: Trip[]; vehicles: Vehicle[] }) {
  const [picked, setPicked] = useState<number[]>([])
  const vehicleName = vehicleNames(vehicles)
  const assign = useSave(
    (assignment: { ids: number[]; vehicleId: number | null }) => inboxRequests.assignTrips(assignment.ids, assignment.vehicleId).then(() => assignment),
    {
      refresh: refresh.inbox,
      onDone: () => setPicked([]),
      done: ({ ids, vehicleId }) => `${ids.length === 1 ? 'Trip' : `${ids.length} trips`} ${vehicleId ? `added to ${vehicleName(vehicleId)}` : 'marked not mine'}`,
      undo: ({ ids }) => inboxRequests.unassignTrips(ids),
    },
  )
  const days = useMemo(() => byDay(trips, (trip) => trip.startedAt), [trips])
  const toggle = (id: number) => setPicked((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]))

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
            <button className="rounded px-1 underline transition active:opacity-60" onClick={() => setPicked((ids) => [...new Set([...ids, ...list.map((trip) => trip.id)])])}>Select day</button>
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
                  <div className="num text-sm font-medium">{tripTitle(trip)}</div>
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
