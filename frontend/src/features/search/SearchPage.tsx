import { Bell, GasPump, MagnifyingGlass, Receipt, Scroll, Wrench } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayOf, money } from '@/lib/format'
import { useSearch, useVehicles } from '@/lib/queries'
import { type SearchHit } from '@/lib/types'
import { EmptyState, ErrorText, IconBadge, Input, List, ListSkeleton, PageHeader, rowPress, RowText, Section } from '@/ui'

/** How long typing pauses before the search runs. */
const PAUSE_MS = 250

const KINDS: { kind: SearchHit['kind']; title: string; icon: ReactNode }[] = [
  { kind: 'FUEL', title: 'Fill-ups', icon: <IconBadge><GasPump size={18} /></IconBadge> },
  { kind: 'SERVICE', title: 'Services', icon: <IconBadge tone="sky"><Wrench size={18} /></IconBadge> },
  { kind: 'EXPENSE', title: 'Expenses', icon: <IconBadge tone="violet"><Receipt size={18} /></IconBadge> },
  { kind: 'PAPER', title: 'Papers', icon: <IconBadge tone="violet"><Scroll size={18} /></IconBadge> },
  { kind: 'REMINDER', title: 'Reminders', icon: <IconBadge tone="sky"><Bell size={18} /></IconBadge> },
]

/**
 * Searching every record by its words: pumps and places, service titles and workshops, expenses and vendors, papers,
 * reminders, and the notes on any of them. Results come by kind; tapping one opens it on its vehicle's page (or on
 * Papers, for a paper that isn't a vehicle's). What you typed stays in the address, so Back returns to the results.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [typed, setTyped] = useState(params.get('q') ?? '')
  const words = useSettled(typed.trim(), PAUSE_MS)
  // into the address when the words change, and only then: rerun as a result's page loads, it would pull you back here
  const shown = params.get('q') ?? ''
  useEffect(() => {
    if (words !== shown) setParams(words ? { q: words } : {}, { replace: true })
  }, [words])
  const results = useSearch(words)
  const vehicles = useVehicles()
  const vehicleName = (id: number | null) => (id == null ? null : vehicles.data?.find((vehicle) => vehicle.id === id)?.name)

  return (
    <div className="space-y-5">
      <PageHeader title="Search" />
      <label className="relative block">
        <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
        <Input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus enterKeyHint="search"
          placeholder="Pump, workshop, title, notes…" aria-label="Search your records" className="pl-10" />
      </label>
      <ErrorText error={results.error} />
      {words.length < 2 ? (
        <EmptyState icon={<MagnifyingGlass size={40} />} title="Search your records">Fill-ups, services, expenses, papers and reminders, by any word in them.</EmptyState>
      ) : results.isLoading ? (
        <ListSkeleton />
      ) : !results.data?.length ? (
        <EmptyState title={`Nothing has “${words}”`}>Try part of a word, or another one.</EmptyState>
      ) : (
        KINDS.map(({ kind, title, icon }) => {
          const hits = results.data.filter((hit) => hit.kind === kind)
          if (!hits.length) return null
          return (
            <Section key={kind} title={title} meta={String(hits.length)}>
              <List>
                {hits.map((hit) => (
                  <Link key={hit.id} to={linkTo(hit)} className={`flex items-center gap-3 px-4 py-3 ${rowPress}`}>
                    {icon}
                    <RowText title={hit.title ?? title}>
                      {[vehicleName(hit.vehicleId), hit.on ? dayOf(hit.on) : null, hit.detail].filter(Boolean).join(' · ') || undefined}
                    </RowText>
                    {hit.amount != null && hit.amount > 0 && <div className="num shrink-0 font-semibold">{money(hit.amount)}</div>}
                  </Link>
                ))}
              </List>
            </Section>
          )
        })
      )}
    </div>
  )
}

/** Where a result opens: its vehicle's page on the right tab with the record open, or Papers for one with no vehicle. */
export function linkTo({ kind, id, vehicleId }: SearchHit) {
  const [tab, open] = ({ FUEL: ['fuel', 'fuel'], SERVICE: ['upkeep', 'service'], EXPENSE: ['spend', 'expense'], PAPER: ['papers', 'doc'], REMINDER: ['upkeep', 'reminder'] } as const)[kind]
  if (vehicleId == null) return `/papers?open=doc:${id}`
  return `/vehicles/${vehicleId}?tab=${tab}&open=${open}:${id}`
}

/** {@code value} once it's stopped changing for {@code ms}. */
function useSettled<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}
