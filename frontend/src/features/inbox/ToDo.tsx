import { Check, GasPump, MapPin, Receipt, Tray, Warning, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ago, date, dateTime, money, money2, n2 } from '@/lib/format'
import { refresh, useIntegrations } from '@/lib/queries'
import { type Inbox, type Vehicle } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { VehicleLink } from '@/features/vehicle/VehicleLink'
import { Badge, Button, Card, EmptyState, IconBadge, Loading, Section } from '@/ui'
import { cardMotion } from './cardMotion'
import { inboxRequests } from './inboxRequests'
import { TripsToSort } from './TripsToSort'

export type Pending = Inbox['suggestions'][number]

/** Suggestions to add or dismiss, fill-ups to check, and trips to put on a vehicle. */
export function ToDo({ inbox, vehicles, onConfirm }: { inbox: Inbox; vehicles: Vehicle[]; onConfirm: (suggestion: Pending) => void }) {
  const dismiss = useSave(inboxRequests.dismiss, { refresh: refresh.inbox, done: 'Dismissed', undo: (_, id) => inboxRequests.restore(id) })
  const vehicleName = (id: number | null) => vehicles.find((vehicle) => vehicle.id === id)?.name
  if (!inbox.trips.length && !inbox.suggestions.length && !inbox.issues.length) return <InboxEmpty />

  return (
    <>
      {inbox.suggestions.length > 0 && (
        <Section title="To confirm" className="!space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
          {inbox.suggestions.map((pending) => (
            <motion.div key={pending.suggestion.id} {...cardMotion}>
              <SuggestionCard pending={pending} vehicleName={vehicleName} onAdd={() => onConfirm(pending)}
                dismissing={dismiss.isPending && dismiss.variables === pending.suggestion.id} onDismiss={() => dismiss.mutate(pending.suggestion.id)} />
            </motion.div>
          ))}
          </AnimatePresence>
        </Section>
      )}

      {inbox.issues.length > 0 && (
        <Section title="Needs a look" className="!space-y-3">
          {inbox.issues.map((fill) => (
            <VehicleLink key={fill.id} vehicleId={fill.vehicleId} className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm transition duration-100 active:scale-[0.99] active:bg-amber-500/20">
              <Warning size={20} className="text-amber-600" />
              <span className="flex-1">{vehicleName(fill.vehicleId) ?? 'Fill-up'} · {date(fill.filledAt)} · {money(fill.totalCost)} — {fill.sourceIssue}</span>
            </VehicleLink>
          ))}
        </Section>
      )}

      {inbox.trips.length > 0 && <TripsToSort trips={inbox.trips} vehicles={vehicles} />}
    </>
  )
}

/** A fill-up or expense found in Hisaab or at a pump stop, to add (with its form) or dismiss. */
function SuggestionCard({ pending, vehicleName, onAdd, dismissing, onDismiss }: {
  pending: Pending; vehicleName: (id: number | null) => string | undefined; onAdd: () => void; dismissing: boolean; onDismiss: () => void
}) {
  const suggestion = pending.suggestion
  const fuel = suggestion.kind === 'FUEL'
  const forVehicle = vehicleName(suggestion.suggestedVehicleId)
  return (
    <Card padded raised className="space-y-3">
      <div className="flex items-start gap-3">
        <IconBadge square tone={fuel ? 'accent' : 'violet'}>{fuel ? <GasPump size={22} /> : <Receipt size={22} />}</IconBadge>
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
          {fuel && pending.estimatedVolume && <div className="num text-xs text-stone-500">≈ {n2(pending.estimatedVolume)} L at {money2(suggestion.suggestedPrice)}</div>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onAdd}>
          <Check size={16} /> {fuel ? `Add fill-up${forVehicle ? ` · ${forVehicle}` : ''}` : 'Add expense'}
        </Button>
        <Button variant="ghost" busy={dismissing} onClick={onDismiss}><X size={16} /> Dismiss</Button>
      </div>
    </Card>
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

