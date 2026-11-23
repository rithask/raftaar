import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { useInbox, useVehicles } from '@/lib/queries'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { FuelForm } from '@/features/fuel/FuelForm'
import { ErrorText, Loading, PageHeader, TabPager } from '@/ui'
import { HandledList } from './HandledList'
import { type Pending, ToDo } from './ToDo'

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
        { value: 'todo', label: 'To do', content: <ToDo inbox={inbox.data!} vehicles={active} onConfirm={setConfirming} /> },
        { value: 'done', label: 'Done', lazy: true, content: <HandledList vehicles={vehicles.data ?? []} /> },
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
