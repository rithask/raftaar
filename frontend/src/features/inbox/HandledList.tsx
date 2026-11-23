import { ArrowCounterClockwise, Checks, GasPump, Path, Receipt } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { api } from '@/lib/api'
import { date, km, money, time } from '@/lib/format'
import { refresh, useHandled } from '@/lib/queries'
import { type Handled, type Vehicle } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { VehicleLink } from '@/features/vehicle/VehicleLink'
import { Button, EmptyState, ErrorText, IconBadge, List, ListSkeleton, RowText, rowPress } from '@/ui'

/** The reason a suggestion you dismissed yourself carries (Suggestions.DISMISSED_BY_YOU on the server). */
const DISMISSED_BY_YOU = 'Dismissed'

/**
 * The Inbox's Done tab: what's been added, dismissed or sorted, newest first and by day. Each row says what became
 * of it and opens the vehicle it went to; what can be is put back in To do with one tap.
 */
export function HandledList({ vehicles }: { vehicles: Vehicle[] }) {
  const handled = useHandled()
  const restoreSuggestion = useSave((id: number) => api(`/suggestions/${id}/restore`, { method: 'POST' }), { refresh: refresh.inbox, done: 'Back in To do' })
  const restoreTrip = useSave((id: number) => api(`/trips/${id}/unassign`, { method: 'POST' }), { refresh: refresh.inbox, done: 'Back in To do' })
  const vehicleName = (id: number | null) => vehicles.find((vehicle) => vehicle.id === id)?.name
  const days = useMemo(() => {
    const byDay = new Map<string, Handled[]>()
    for (const item of handled.data?.pages.flatMap((page) => page.items) ?? []) {
      const day = date(item.at)
      byDay.set(day, [...(byDay.get(day) ?? []), item])
    }
    return [...byDay.entries()]
  }, [handled.data])

  if (handled.isLoading) return <ListSkeleton />
  if (handled.error) return <ErrorText error={handled.error} />
  if (!days.length) {
    return <EmptyState icon={<Checks size={48} />} title="Nothing done yet">Fill-ups, expenses and trips you add, dismiss or sort show up here.</EmptyState>
  }

  const restoring = (item: Handled) => item.trip
    ? restoreTrip.isPending && restoreTrip.variables === item.trip.id
    : restoreSuggestion.isPending && restoreSuggestion.variables === item.suggestion!.id
  const restore = (item: Handled) => (item.trip ? restoreTrip.mutate(item.trip.id) : restoreSuggestion.mutate(item.suggestion!.id))

  return (
    <>
      <ErrorText error={restoreSuggestion.error ?? restoreTrip.error} />
      {days.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <h3 className="px-1 text-xs text-stone-500">{day}</h3>
          <List>
            {items.map((item) => (
              <HandledRow key={item.trip ? `t${item.trip.id}` : `s${item.suggestion!.id}`} item={item} vehicleName={vehicleName}
                restoring={restoring(item)} onRestore={() => restore(item)} />
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

function HandledRow({ item, vehicleName, restoring, onRestore }: {
  item: Handled; vehicleName: (id: number | null) => string | undefined; restoring: boolean; onRestore: () => void
}) {
  const { suggestion, trip, vehicleId } = item
  const fuel = suggestion?.kind === 'FUEL'
  const icon = trip
    ? <IconBadge tone="emerald"><Path size={18} /></IconBadge>
    : fuel ? <IconBadge><GasPump size={18} /></IconBadge> : <IconBadge tone="violet"><Receipt size={18} /></IconBadge>
  const title = trip
    ? `${time(trip.startedAt)} – ${time(trip.endedAt)} · ${km(trip.distanceM / 1000)}`
    : suggestion!.stationName ?? suggestion!.payee ?? (fuel ? 'Fuel stop' : 'Payment')
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
function outcome({ suggestion, trip, vehicleId, restorable }: Handled, vehicleName: (id: number | null) => string | undefined) {
  if (trip) return trip.status === 'ASSIGNED' ? `On ${vehicleName(trip.vehicleId) ?? 'a vehicle'}` : 'Not mine'
  const [aRecord, record] = suggestion!.kind === 'FUEL' ? ['a fill-up', 'fill-up'] : ['an expense', 'expense']
  if (suggestion!.status === 'DISMISSED') return suggestion!.dismissReason === DISMISSED_BY_YOU ? 'Dismissed' : `Dismissed: ${suggestion!.dismissReason}`
  if (vehicleId != null) return `Added as ${aRecord} on ${vehicleName(vehicleId) ?? 'a vehicle'}`
  return restorable ? `Added; the ${record} has since been deleted` : `Added as ${aRecord}`
}
