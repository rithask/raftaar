import { Bell, Check, Wrench } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { date, km, money, today } from '@/lib/format'
import { type ReminderView, type ServiceRow } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { AddLink, Badge, Button, cx, EmptyState, ErrorText, IconBadge, List, listItem, ListRow, Loading, RowMeta, rowPress, Section, softSpring } from '@/ui'

/** When a reminder is due, compactly: km left on top, days below (whichever exist), coloured by urgency. */
export function DueSoonest({ status: st }: { status: ReminderView['status'] }) {
  const kmLine = st.kmLeft == null ? null : st.kmLeft >= 0 ? `${km(st.kmLeft)} left` : `${km(-st.kmLeft)} over`
  const dayLine = st.daysLeft == null ? null
    : st.daysLeft > 1 ? `${st.daysLeft} days` : st.daysLeft === 1 ? 'tomorrow' : st.daysLeft === 0 ? 'today' : `${-st.daysLeft} days late`
  const color = st.state === 'OVERDUE' ? 'text-red-600' : st.state === 'DUE_SOON' ? 'text-amber-600' : 'text-emerald-600'
  if (!kmLine && !dayLine) return <Badge className="shrink-0">set last done</Badge>
  return (
    <div className="num shrink-0 text-right">
      <div className={cx('text-sm font-semibold', color)}>{kmLine ?? dayLine}</div>
      {kmLine && dayLine && <div className="mt-0.5 text-[13px] text-stone-500">or {dayLine}</div>}
    </div>
  )
}

export function RemindersSection({ id, odometer, onOpen, onAdd }: { id: number; odometer: number | null; onOpen: (r: ReminderView) => void; onAdd: () => void }) {
  const rows = useQuery({ queryKey: ['reminders', id], queryFn: () => api<ReminderView[]>(`/vehicles/${id}/reminders`) })
  const [asking, setAsking] = useState<number | null>(null)
  const hidden = useHidden()
  const atKm = odometer != null ? Math.round(odometer) : null
  // Done: logs the service today (at the current odometer) and restarts this reminder from there.
  const done = useSave((r: ReminderView) => api(`/vehicles/${id}/services`, {
    body: { servicedOn: today(), odometer: atKm, title: r.reminder.title, cost: 0, completes: [r.reminder.id] },
  }), () => setAsking(null), 'Done. Add the cost or workshop in Service history if you like.')
  const list = (rows.data ?? []).filter((r) => !hidden(`reminder:${r.reminder.id}`))
  const due = (r: ReminderView) => r.reminder.active && (r.status.state === 'OVERDUE' || r.status.state === 'DUE_SOON')
  return (
    <Section title="Reminders" action={<AddLink label="Add" onClick={onAdd} />}>
      {rows.isLoading ? <Loading /> : !list.length ? (
        <EmptyState icon={<Bell size={36} />} title="No reminders">Oil changes, chain lube, services: by km, by date, or both.</EmptyState>
      ) : (
        <List>
          {list.map((r) => (
            <motion.div variants={listItem} key={r.reminder.id}>
              <div className="flex items-center">
                <button type="button" onClick={() => onOpen(r)} className={cx('flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left', due(r) ? 'pr-2' : 'pr-4', rowPress)}>
                  <div className={`min-w-0 flex-1 ${r.reminder.active ? '' : 'opacity-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.reminder.title}</span>
                      {!r.reminder.active && <Badge>done</Badge>}
                    </div>
                    <RowMeta>
                      {[r.reminder.intervalKm ? `every ${km(r.reminder.intervalKm)}` : null, r.reminder.intervalMonths ? `${r.reminder.intervalMonths} mo` : null].filter(Boolean).join(' / ') || 'once'}
                      {r.status.dueOdometer != null && r.status.kmLeft == null && ` · at ${km(r.status.dueOdometer)}`}
                    </RowMeta>
                  </div>
                  {r.reminder.active && <DueSoonest status={r.status} />}
                </button>
                {due(r) && asking !== r.reminder.id && (
                  <button type="button" onClick={() => setAsking(r.reminder.id)} aria-label={`Mark ${r.reminder.title} done`}
                    className="mr-3 flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition active:scale-95">
                    <Check size={14} weight="bold" /> Done
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {asking === r.reminder.id && (
                  <motion.div key="ask" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={softSpring} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 bg-accent-soft/60 px-4 py-3 text-sm dark:bg-accent-soft/40">
                      <span className="min-w-0 flex-1">
                        Done today{atKm != null && <> at <span className="whitespace-nowrap">{km(atKm)}</span></>}? {r.reminder.intervalKm || r.reminder.intervalMonths ? 'The countdown starts again from there.' : "It'll be marked finished."}
                      </span>
                      <Button variant="ghost" className="!px-3 !py-1.5" onClick={() => setAsking(null)}>Cancel</Button>
                      <Button variant="primary" className="!px-3 !py-1.5" busy={done.isPending} onClick={() => done.mutate(r)}><Check size={14} /> Yes, done</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {done.error && done.variables?.reminder.id === r.reminder.id && <div className="px-4 pb-3"><ErrorText error={done.error} /></div>}
            </motion.div>
          ))}
        </List>
      )}
    </Section>
  )
}

export function ServicesSection({ id, onOpen, onAdd }: { id: number; onOpen: (r: ServiceRow) => void; onAdd: () => void }) {
  const rows = useQuery({ queryKey: ['services', id], queryFn: () => api<ServiceRow[]>(`/vehicles/${id}/services`) })
  const hidden = useHidden()
  const list = (rows.data ?? []).filter((r) => !hidden(`service:${r.record.id}`))
  return (
    <Section title="Service history" meta={list.length ? `${list.length} · ${money(list.reduce((t, r) => t + r.record.cost, 0))}` : undefined}
      action={<AddLink label="Log service" onClick={onAdd} />}>
      {rows.isLoading ? <Loading /> : !list.length ? (
        <EmptyState icon={<Wrench size={36} />} title="No services yet">Logging a service also resets the reminders it covers.</EmptyState>
      ) : (
        <List>
          {list.map((r) => (
            <ListRow key={r.record.id} onClick={() => onOpen(r)}>
              <IconBadge tone="sky"><Wrench size={18} /></IconBadge>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.record.title}</div>
                <RowMeta>{date(r.record.servicedOn)}{r.record.odometer != null ? ` · ${km(r.record.odometer)}` : ''}{r.record.workshop ? ` · ${r.record.workshop}` : ''}</RowMeta>
              </div>
              <div className="num shrink-0 font-semibold">{money(r.record.cost)}</div>
            </ListRow>
          ))}
        </List>
      )}
    </Section>
  )
}
