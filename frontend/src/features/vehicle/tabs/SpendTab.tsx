import { Receipt } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { date, expenseLabel, km, money, money2 } from '@/lib/format'
import { type Expense, type Ownership, type Summary } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { MonthlyChart } from '../LazyCharts'
import { AddLink, Card, cx, EmptyState, IconBadge, List, ListRow, RowMeta, Section, softSpring } from '@/ui'

/** Where the money went, then the expenses list. */
export function SpendTab({ summary, expenses, onOpen, onAdd }: { summary: Summary; expenses: Expense[]; onOpen: (expense: Expense) => void; onAdd: () => void }) {
  const c = summary.costs
  const parts = [
    { label: 'Fuel', value: c.fuel, color: 'bg-accent' },
    { label: 'Service', value: c.service, color: 'bg-sky-500' },
    { label: 'Other', value: c.expenses, color: 'bg-violet-500' },
  ]
  const hidden = useHidden()
  const list = expenses.filter((expense) => !hidden(`expense:${expense.id}`))
  const months = summary.monthly.some((m) => m.fuel + m.service + m.other > 0) ? summary.monthly : []
  const monthAvg = months.reduce((t, m) => t + m.fuel + m.service + m.other, 0) / Math.max(1, months.length)
  return (
    <>
      <OwnershipSection ownership={summary.ownership} />
      <Section title="Where it went">
        <Card padded>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-bold tracking-tight">{money(c.total)}</span>
            {c.perKm != null && <span className="num text-sm text-stone-500">{money2(c.perKm)} per km</span>}
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            {c.total > 0 && parts.map((p) => (
              <motion.div key={p.label} className={p.color} initial={{ width: 0 }} animate={{ width: `${(p.value / c.total) * 100}%` }} transition={{ ...softSpring, delay: 0.1 }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {parts.map((p) => (
              <div key={p.label} className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-stone-500"><span className={cx('size-2 rounded-full', p.color)} /> {p.label}</div>
                <div className="num truncate text-sm font-semibold">{money(p.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      </Section>
      {months.length >= 2 && (
        <Section title="By month" meta={`last ${months.length} months · avg ${money(monthAvg)}`}>
          <MonthlyChart months={months} />
        </Section>
      )}
      <Section title="Expenses" meta={list.length ? `${list.length} · ${money(c.expenses)}` : undefined} action={<AddLink label="Add" onClick={onAdd} />}>
        {!list.length ? (
          <EmptyState icon={<Receipt size={36} />} title="No expenses">Upgrades, accessories, riding gear, tolls and parking.</EmptyState>
        ) : (
          <List>
            {list.map((expense) => (
              <ListRow key={expense.id} onClick={() => onOpen(expense)}>
                <IconBadge tone="violet"><Receipt size={18} /></IconBadge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{expense.title}</div>
                  <RowMeta>{expenseLabel[expense.category]} · {date(expense.spentOn, false)}{expense.hisaabTxnId ? ' · Hisaab' : expense.vendor ? ` · ${expense.vendor}` : ''}</RowMeta>
                </div>
                <div className="num shrink-0 font-semibold">{money(expense.amount)}</div>
              </ListRow>
            ))}
          </List>
        )}
      </Section>
    </>
  )
}

/**
 * What it has cost to own: bought for, running costs, sold for, and the total per km and per month ("so far" while
 * it isn't sold). Shown once there's more to it than the running costs below; until then, a line saying what to add.
 */
function OwnershipSection({ ownership: o }: { ownership: Ownership }) {
  if (o.purchase == null && !o.sold) {
    return <p className="px-1 text-sm text-stone-500">Add what you paid for it (Edit) to see what it costs to own.</p>
  }
  const lines = [
    { label: 'Bought for', value: o.purchase != null ? money(o.purchase) : 'not set' },
    { label: 'Running costs', value: money(o.running) },
    ...(o.sold ? [{ label: 'Sold for', value: o.sale != null ? `− ${money(o.sale)}` : 'not set' }] : []),
  ]
  const rates = [
    o.perKm != null && o.distance != null ? `${money2(o.perKm)} per km over ${km(o.distance)}` : null,
    o.perMonth != null && o.months != null ? `${money(o.perMonth)} a month over ${o.months} month${o.months === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return (
    <Section title={o.sold ? 'Cost of owning it' : 'Cost of owning it so far'}>
      <Card padded>
        <dl className="space-y-1.5 text-sm">
          {lines.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-stone-500">{label}</dt>
              <dd className="num">{value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-t border-stone-900/5 pt-2 dark:border-white/10">
            <dt className="font-medium">Total</dt>
            <dd className="num text-xl font-bold tracking-tight">{money(o.total)}</dd>
          </div>
        </dl>
        {rates.length > 0 && <p className="num mt-2 text-sm text-stone-600 dark:text-stone-300">{rates.join(' · ')}</p>}
        {o.missing.length > 0 && <p className="mt-2 text-xs text-stone-500">Add the {joinWords(o.missing)} (Edit) to count {o.missing.length === 1 ? 'it' : 'them'}.</p>}
      </Card>
    </Section>
  )
}

/** "a", "a and b", "a, b and c". */
const joinWords = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)
