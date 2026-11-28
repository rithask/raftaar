import { Path } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { dateTime, km } from '@/lib/format'
import { tripPlaces } from '@/lib/trips'
import { type Trip } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { Button, EmptyState, IconBadge, List, listItem, RowMeta, Section } from '@/ui'
import { refresh } from '@/lib/queries'
import { inboxRequests } from '@/features/inbox/inboxRequests'

export function TripsTab({ trips }: { trips: Trip[] }) {
  const unassign = useSave((trip: Trip) => inboxRequests.unassignTrips([trip.id]), {
    refresh: refresh.inbox, done: 'Moved back to Inbox', undo: (_, trip) => inboxRequests.assignTrips([trip.id], trip.vehicleId),
  })
  if (!trips.length) return <EmptyState icon={<Path size={40} />} title="No trips">Trips you assign to this vehicle in the Inbox show up here.</EmptyState>
  const total = trips.reduce((t, x) => t + x.distanceM, 0) / 1000
  return (
    <Section title="Trips" meta={`${trips.length} · ≈ ${km(total)}`}>
      <List>
        {trips.map((trip) => (
          <motion.div variants={listItem} key={trip.id} className="flex items-center gap-3 px-4 py-3">
            <IconBadge tone="emerald"><Path size={18} /></IconBadge>
            <div className="min-w-0 flex-1">
              {/* where it went is the title when GeoPulse named its places; when it was, otherwise */}
              <div className="truncate font-medium">{tripPlaces(trip) ?? dateTime(trip.startedAt)}</div>
              <RowMeta>
                {[tripPlaces(trip) ? dateTime(trip.startedAt) : null, km(trip.distanceM / 1000), `${Math.round((new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime()) / 60000)} min`]
                  .filter(Boolean).join(' · ')}
              </RowMeta>
            </div>
            <Button variant="ghost" className="shrink-0 !px-2.5 !py-1 text-xs" busy={unassign.isPending && unassign.variables.id === trip.id} onClick={() => unassign.mutate(trip)}>Remove</Button>
          </motion.div>
        ))}
      </List>
    </Section>
  )
}
