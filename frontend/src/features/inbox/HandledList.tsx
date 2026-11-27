import { ArrowCounterClockwise, Checks, GasPump, Path, Receipt } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { money, time } from '@/lib/format'
import { refresh, useHandled } from '@/lib/queries'
import { type Handled, type Vehicle } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { vehicleNames } from '@/lib/vehicles'
import { VehicleLink } from '@/features/vehicle/VehicleLink'
import { Button, EmptyState, ErrorText, IconBadge, List, ListSkeleton, RowText, rowPress } from '@/ui'
import { byDay } from './byDay'
import { inboxRequests } from './inboxRequests'
import { suggestionTitle, tripTitle } from './labels'

/**
 * The Inbox's Done tab: what's been added, dismissed or sorted, newest first and by day. Each row says what became
 * of it and opens the vehicle it went to; what can be is put back in To do with one tap.
 */
export function HandledList({ vehicles }: { vehicles: Vehicle[] }) {
  const handled = useHandled()
  const putBack = useSave(
    (item: Handled) => (item.trip ? inboxRequests.unassignTrips([item.trip.id]) : inboxRequests.restore(item.suggestion!.id)),
    {
      refresh: refresh.inbox,
      done: (_, item) => `${item.trip ? 'Trip' : suggestionTitle(item.suggestion!)} back in To do`,
      // back as it was: a trip on its vehicle (or not mine), a suggestion dismissed. One that was added can't be
      // added again from a toast (that takes the form), so it has no Undo.
      undo: (_, item) => (item.trip ? inboxRequests.assignTrips([item.trip.id], item.trip.vehicleId) : inboxRequests.dismiss(item.suggestion!.id)),
      canUndo: (_, item) => item.resolution !== 'ADDED_THEN_DELETED',
    },
  )
  const vehicleName = vehicleNames(vehicles)
  const days = useMemo(() => byDay(handled.data?.pages.flatMap((page) => page.items) ?? [], (item) => item.at), [handled.data])

  if (handled.isLoading) return <ListSkeleton />
  if (handled.error) return <ErrorText error={handled.error} />
  if (!days.length) {
    return <EmptyState icon={<Checks size={48} />} title="Nothing done yet">Fill-ups, expenses and trips you add, dismiss or sort show up here.</EmptyState>
  }

  return (
    <>
      <ErrorText error={putBack.error} />
      {days.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <h3 className="px-1 text-xs text-stone-500">{day}</h3>
          <List>
            {items.map((item) => (
              <HandledRow key={keyOf(item)} item={item} vehicleName={vehicleName}
                restoring={putBack.isPending && keyOf(putBack.variables) === keyOf(item)} onRestore={() => putBack.mutate(item)} />
            ))}
          </List>
        </section>
      ))}
      {handled.hasNextPage && (
        <Button variant="secondary" className="w-full" busy={handled.isFetchingNextPage} onClick={() => void handled.fetchNextPage()}>Load more</Button>
      )}
    </>
  )
}

const keyOf = (item: Handled) => (item.trip ? `trip:${item.trip.id}` : `suggestion:${item.suggestion!.id}`)

function HandledRow({ item, vehicleName, restoring, onRestore }: {
  item: Handled; vehicleName: (id: number | null) => string | undefined; restoring: boolean; onRestore: () => void
}) {
  const { suggestion, trip, vehicleId } = item
  const fuel = suggestion?.kind === 'FUEL'
  const icon = trip
    ? <IconBadge tone="emerald"><Path size={18} /></IconBadge>
    : fuel ? <IconBadge><GasPump size={18} /></IconBadge> : <IconBadge tone="violet"><Receipt size={18} /></IconBadge>
  const title = trip ? tripTitle(trip) : suggestionTitle(suggestion!)
  const details = trip ? null : [time(item.at), suggestion!.amount != null ? money(suggestion!.amount) : null].filter(Boolean).join(' · ')
  // what became of it gets a line of its own, wrapping rather than cut short
  const text = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <RowText title={title}>{details}</RowText>
        <div className="mt-0.5 text-[13px] text-stone-600 dark:text-stone-400">{outcome(item, vehicleName)}</div>
      </div>
    </>
  )

  return (
    <div className="flex items-center">
      {vehicleId != null
        ? <VehicleLink vehicleId={vehicleId} className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 ${item.restorable ? 'pr-2' : 'pr-4'} ${rowPress}`}>{text}</VehicleLink>
        : <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2">{text}</div>}
      {item.restorable && (
        <Button variant="ghost" className="mr-2 shrink-0 !px-2.5 !py-1.5 text-xs" busy={restoring} onClick={onRestore} aria-label={`Put ${title} back in To do`}>
          <ArrowCounterClockwise size={14} /> To do
        </Button>
      )}
    </div>
  )
}

/** What became of it, in a few words. */
function outcome({ suggestion, vehicleId, resolution }: Handled, vehicleName: (id: number | null) => string | undefined) {
  const [aRecord, record] = suggestion?.kind === 'EXPENSE' ? ['an expense', 'expense'] : ['a fill-up', 'fill-up']
  const where = vehicleId != null ? ` on ${vehicleName(vehicleId) ?? 'a vehicle'}` : ''
  switch (resolution) {
    case 'ADDED': return `Added as ${aRecord}${where}`
    case 'ADDED_THEN_DELETED': return `Added; the ${record} has since been deleted`
    case 'DISMISSED': return 'Dismissed'
    case 'DISMISSED_BY_SYNC': return `Dismissed: ${suggestion!.dismissReason}`
    case 'ON_VEHICLE': return `On ${vehicleName(vehicleId) ?? 'a vehicle'}`
    case 'NOT_MINE': return 'Not mine'
  }
}
