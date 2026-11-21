import { Path } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { api } from '@/lib/api'
import { dateTime, km } from '@/lib/format'
import { type Trip } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { Button, EmptyState, IconBadge, List, listItem, RowMeta, Section } from '@/ui'
import { refresh } from '@/lib/queries'

export function TripsTab({ trips }: { trips: Trip[] }) {
  const unassign = useSave((tid: number) => api(`/trips/${tid}/unassign`, { method: 'POST' }), { refresh: refresh.inbox, done: 'Moved back to Inbox' })
  if (!trips.length) return <EmptyState icon={<Path size={40} />} title="No trips">Trips you assign to this vehicle in the Inbox show up here.</EmptyState>
  const total = trips.reduce((t, x) => t + x.distanceM, 0) / 1000
  return (
    <Section title="Trips" meta={`${trips.length} · ≈ ${km(total)}`}>
      <List>
        {trips.map((t) => (
          <motion.div variants={listItem} key={t.id} className="flex items-center gap-3 px-4 py-3">
            <IconBadge tone="emerald"><Path size={18} /></IconBadge>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{dateTime(t.startedAt)}</div>
              <RowMeta>{km(t.distanceM / 1000)} · {Math.round((new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 60000)} min</RowMeta>
            </div>
            <Button variant="ghost" className="shrink-0 !px-2.5 !py-1 text-xs" busy={unassign.isPending && unassign.variables === t.id} onClick={() => unassign.mutate(t.id)}>Remove</Button>
          </motion.div>
        ))}
      </List>
    </Section>
  )
}
