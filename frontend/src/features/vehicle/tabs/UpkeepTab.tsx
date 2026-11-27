import { Bell, Check, Wrench } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { date, dayOf, km, money, today } from '@/lib/format'
import { type ReminderView, type ServiceRow } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { AddLink, Badge, Button, cx, EmptyState, ErrorText, IconBadge, List, listItem, ListRow, RowMeta, rowPress, Section, softSpring } from '@/ui'
import { refresh } from '@/lib/queries'

/**
 * When a reminder is due, compactly: km left on top, coloured by urgency, and below it roughly when that is at the
 * vehicle's pace ("around 14 Dec"), or else the days left on its date.
 */
export function DueSoonest({ status: st }: { status: ReminderView['status'] }) {
  const kmLine = st.kmLeft == null ? null : st.kmLeft >= 0 ? `${km(st.kmLeft)} left` : `${km(-st.kmLeft)} over`
  const dayLine = st.daysLeft == null ? null
    : st.daysLeft > 1 ? `${st.daysLeft} days` : st.daysLeft === 1 ? 'tomorrow' : st.daysLeft === 0 ? 'today' : `${-st.daysLeft} days late`
  const color = st.state === 'OVERDUE' ? 'text-red-600' : st.state === 'DUE_SOON' ? 'text-amber-600' : 'text-emerald-600'
  if (!kmLine && !dayLine) return <Badge className="shrink-0">set last done</Badge>
  const below = st.projectedOn ? `around ${dayOf(st.projectedOn)}` : kmLine && dayLine ? `or ${dayLine}` : null
  return (
    <div className="num shrink-0 text-right">
      <div className={cx('text-sm font-semibold', color)}>{kmLine ?? dayLine}</div>
      {below && <div className="mt-0.5 text-[13px] text-stone-500">{below}</div>}
    </div>
  )
}

export function RemindersSection({ vehicleId, reminders, odometer, onOpen, onAdd }: {
  vehicleId: number; reminders: ReminderView[]; odometer: number | null; onOpen: (reminderView: ReminderView) => void; onAdd: () => void
}) {
  const [asking, setAsking] = useState<number | null>(null)
  const hidden = useHidden()
  const atKm = odometer != null ? Math.round(odometer) : null
  // Done: logs the service today (at the current odometer) and restarts this reminder from there.
  const done = useSave((reminderView: ReminderView) => api(`/vehicles/${vehicleId}/services`, {
    body: { servicedOn: today(), odometer: atKm, title: reminderView.reminder.title, cost: 0, completes: [reminderView.reminder.id] },
  }), { refresh: refresh.vehicleRecords, onDone: () => setAsking(null), done: 'Done. Add the cost or workshop in Service history if you like.' })
  const list = reminders.filter((reminderView) => !hidden(`reminder:${reminderView.reminder.id}`))
  const due = (reminderView: ReminderView) => reminderView.reminder.active && (reminderView.status.state === 'OVERDUE' || reminderView.status.state === 'DUE_SOON')
  return (
    <Section title="Reminders" action={<AddLink label="Add" onClick={onAdd} />}>
      {!list.length ? (
        <EmptyState icon={<Bell size={36} />} title="No reminders">Oil changes, chain lube, services: by km, by date, or both.</EmptyState>
      ) : (
        <List>
          {list.map((reminderView) => (
            <motion.div variants={listItem} key={reminderView.reminder.id}>
              <div className="flex items-center">
                <button type="button" onClick={() => onOpen(reminderView)} className={cx('flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left', due(reminderView) ? 'pr-2' : 'pr-4', rowPress)}>
                  <div className={`min-w-0 flex-1 ${reminderView.reminder.active ? '' : 'opacity-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{reminderView.reminder.title}</span>
                      {!reminderView.reminder.active && <Badge>done</Badge>}
                    </div>
                    <RowMeta>
                      {[reminderView.reminder.intervalKm ? `every ${km(reminderView.reminder.intervalKm)}` : null, reminderView.reminder.intervalMonths ? `${reminderView.reminder.intervalMonths} mo` : null].filter(Boolean).join(' / ') || 'once'}
                      {reminderView.status.dueOdometer != null && reminderView.status.kmLeft == null && ` · at ${km(reminderView.status.dueOdometer)}`}
                    </RowMeta>
                  </div>
                  {reminderView.reminder.active && <DueSoonest status={reminderView.status} />}
                </button>
                {due(reminderView) && asking !== reminderView.reminder.id && (
                  <button type="button" onClick={() => setAsking(reminderView.reminder.id)} aria-label={`Mark ${reminderView.reminder.title} done`}
                    className="mr-3 flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition active:scale-95">
                    <Check size={14} weight="bold" /> Done
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {asking === reminderView.reminder.id && (
                  <motion.div key="ask" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={softSpring} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 bg-accent-soft/60 px-4 py-3 text-sm dark:bg-accent-soft/40">
                      <span className="min-w-0 flex-1">
                        Done today{atKm != null && <> at <span className="whitespace-nowrap">{km(atKm)}</span></>}? {reminderView.reminder.intervalKm || reminderView.reminder.intervalMonths ? 'The countdown starts again from there.' : "It'll be marked finished."}
                      </span>
                      <Button variant="ghost" className="!px-3 !py-1.5" onClick={() => setAsking(null)}>Cancel</Button>
                      <Button variant="primary" className="!px-3 !py-1.5" busy={done.isPending} onClick={() => done.mutate(reminderView)}><Check size={14} /> Yes, done</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {done.error && done.variables?.reminder.id === reminderView.reminder.id && <div className="px-4 pb-3"><ErrorText error={done.error} /></div>}
            </motion.div>
          ))}
        </List>
      )}
    </Section>
  )
}

export function ServicesSection({ services, onOpen, onAdd }: { services: ServiceRow[]; onOpen: (service: ServiceRow) => void; onAdd: () => void }) {
  const hidden = useHidden()
  const list = services.filter((service) => !hidden(`service:${service.record.id}`))
  return (
    <Section title="Service history" meta={list.length ? `${list.length} · ${money(list.reduce((t, service) => t + service.record.cost, 0))}` : undefined}
      action={<AddLink label="Log service" onClick={onAdd} />}>
      {!list.length ? (
        <EmptyState icon={<Wrench size={36} />} title="No services yet">Logging a service also resets the reminders it covers.</EmptyState>
      ) : (
        <List>
          {list.map((service) => (
            <ListRow key={service.record.id} onClick={() => onOpen(service)}>
              <IconBadge tone="sky"><Wrench size={18} /></IconBadge>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{service.record.title}</div>
                <RowMeta>{date(service.record.servicedOn)}{service.record.odometer != null ? ` · ${km(service.record.odometer)}` : ''}{service.record.workshop ? ` · ${service.record.workshop}` : ''}</RowMeta>
              </div>
              <div className="num shrink-0 font-semibold">{money(service.record.cost)}</div>
            </ListRow>
          ))}
        </List>
      )}
    </Section>
  )
}
