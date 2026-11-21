import { Receipt } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts'
import { date, expenseLabel, money, money2 } from '@/lib/format'
import { type Expense, type Summary } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { axis, ChartCard, grid, margin, monthLabel, short, tooltipStyle } from '@/ui/charts'
import { AddLink, Card, cx, EmptyState, IconBadge, List, ListRow, RowMeta, Section, softSpring } from '@/ui'

/** Where the money went, then the expenses list. */
export function SpendTab({ summary, expenses, onOpen, onAdd }: { summary: Summary; expenses: Expense[]; onOpen: (e: Expense) => void; onAdd: () => void }) {
  const c = summary.costs
  const parts = [
    { label: 'Fuel', value: c.fuel, color: 'bg-accent' },
    { label: 'Service', value: c.service, color: 'bg-sky-500' },
    { label: 'Other', value: c.expenses, color: 'bg-violet-500' },
  ]
  const hidden = useHidden()
  const list = expenses.filter((e) => !hidden(`expense:${e.id}`))
  const months = summary.monthly.some((m) => m.fuel + m.service + m.other > 0) ? summary.monthly : []
  const monthAvg = months.reduce((t, m) => t + m.fuel + m.service + m.other, 0) / Math.max(1, months.length)
  return (
    <>
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
          <ChartCard>
            <BarChart data={months} margin={{ ...margin, left: -12 }}>
              {grid}
              <XAxis dataKey="month" {...axis} tickFormatter={(m: string) => monthLabel(m)} interval="preserveStartEnd" />
              <YAxis {...axis} tickCount={4} allowDecimals={false} tickFormatter={short} />
              <Tooltip labelFormatter={(m) => monthLabel(String(m), true)} formatter={(val, name) => [money(Number(val)), name === 'fuel' ? 'Fuel' : name === 'service' ? 'Service' : 'Other']}
                cursor={{ fill: 'currentColor', className: 'text-stone-500/10' }} {...tooltipStyle} />
              <Bar dataKey="fuel" stackId="m" fill="var(--color-accent)" isAnimationActive={false} />
              <Bar dataKey="service" stackId="m" fill="var(--color-sky-500, #0ea5e9)" isAnimationActive={false} />
              <Bar dataKey="other" stackId="m" fill="var(--color-violet-500, #8b5cf6)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartCard>
        </Section>
      )}
      <Section title="Expenses" meta={list.length ? `${list.length} · ${money(c.expenses)}` : undefined} action={<AddLink label="Add" onClick={onAdd} />}>
        {!list.length ? (
          <EmptyState icon={<Receipt size={36} />} title="No expenses">Upgrades, accessories, riding gear, tolls and parking.</EmptyState>
        ) : (
          <List>
            {list.map((e) => (
              <ListRow key={e.id} onClick={() => onOpen(e)}>
                <IconBadge tone="violet"><Receipt size={18} /></IconBadge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.title}</div>
                  <RowMeta>{expenseLabel[e.category]} · {date(e.spentOn, false)}{e.hisaabTxnId ? ' · Hisaab' : e.vendor ? ` · ${e.vendor}` : ''}</RowMeta>
                </div>
                <div className="num shrink-0 font-semibold">{money(e.amount)}</div>
              </ListRow>
            ))}
          </List>
        )}
      </Section>
    </>
  )
}
