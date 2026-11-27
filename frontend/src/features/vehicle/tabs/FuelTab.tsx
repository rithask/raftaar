import { CloudArrowUp, GasPump, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { date, dateTime, economyUnit, km, money, money2, n1, n2 } from '@/lib/format'
import { amounts, useOutbox } from '@/lib/outbox'
import { type FuelRow, type Summary } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { MileageChart, PriceChart } from '../LazyCharts'
import { Badge, Button, EmptyState, IconBadge, List, listItem, ListRow, RowMeta, Section, Swatch, usualRange } from '@/ui'
import { refresh } from '@/lib/queries'

export const SOURCE = { MANUAL: '', HISAAB: 'Hisaab', GEOPULSE: 'GeoPulse', HISAAB_GEOPULSE: 'Hisaab + GeoPulse' } as const
export function FuelTab({ vehicleId, summary, fills, onOpen }: { vehicleId: number; summary: Summary; fills: FuelRow[]; onOpen: (fill: FuelRow) => void }) {
  const resolve = useSave((fid: number) => api(`/fuel/${fid}/resolve`, { method: 'POST' }), { refresh: refresh.vehicleRecords, done: 'Marked as checked' })
  const waiting = useOutbox().filter((w) => w.vehicleId === vehicleId)
  const hidden = useHidden()
  const list = fills.filter((fill) => !hidden(`fuel:${fill.entry.id}`))
  const [shownMonths, setShownMonths] = useState(MONTHS_AT_A_TIME)
  if (!list.length && !waiting.length) return <EmptyState icon={<GasPump size={40} />} title="No fill-ups yet">Add each fill-up with the odometer reading. Mileage shows after two full tanks.</EmptyState>
  const byId = new Map(list.map((fill) => [fill.entry.id, fill.entry]))
  const chart = summary.economyHistory.map((stretch) => ({ when: date(byId.get(stretch.endId)?.filledAt, false), kmpl: stretch.kmPerUnit }))
  const unit = summary.unit
  const usual = usualRange(chart.map((c) => c.kmpl))
  const prices = [...list].reverse().map((fill) => ({ when: date(fill.entry.filledAt, false), paid: fill.entry.pricePerUnit, published: fill.publishedPrice }))
  const hasPublished = prices.some((p) => p.published != null)
  const spent = list.reduce((t, fill) => t + fill.entry.totalCost, 0)
  const months = byMonth(list)
  return (
    <>
      {chart.length >= 2 && (
        <Section title="Mileage per tank" meta={usual ? `${economyUnit(unit)} · usually ${n1(usual.low)}–${n1(usual.high)}` : economyUnit(unit)}>
          <MileageChart tanks={chart} usual={usual} unit={unit} />
        </Section>
      )}
      {prices.length >= 2 && (
        <Section title="Price paid" meta={hasPublished ? (
            <span className="inline-flex items-center gap-3">
              <span>₹/{unit}</span>
              <span className="inline-flex items-center gap-1"><Swatch color="var(--color-accent-strong)" /> you</span>
              <span className="inline-flex items-center gap-1"><Swatch color="var(--color-stone-400, #a8a29e)" dashed /> published</span>
            </span>
          ) : `₹/${unit}`}>
          <PriceChart prices={prices} hasPublished={hasPublished} />
        </Section>
      )}
      <Section title="Fill-ups" meta={`${list.length} · ${money(spent)}`}>
        {waiting.length > 0 && (
          <List>
            {waiting.map((w) => (
              // saved on this phone, not sent yet
              <motion.div variants={listItem} key={w.key} className="flex items-center gap-3 px-4 py-3">
                <IconBadge tone="sky"><CloudArrowUp size={18} /></IconBadge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{dateTime(w.body.filledAt)}</div>
                  <RowMeta>{w.body.odometer != null ? km(w.body.odometer) : '—'}{amounts(w.body).volume != null ? ` · ${n2(amounts(w.body).volume!)} ${unit}` : ''}</RowMeta>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num font-semibold">{amounts(w.body).total != null ? money(amounts(w.body).total!) : '—'}</div>
                  <Badge tone={w.error ? 'bad' : 'info'} className="mt-0.5">{w.error ? 'not saved' : 'not sent yet'}</Badge>
                </div>
              </motion.div>
            ))}
          </List>
        )}
        {months.slice(0, shownMonths).map((month) => (
          <section key={month.key} className="space-y-1.5" aria-label={month.label}>
            {/* stays under the tab strip while its month scrolls past */}
            <div className="sticky top-[var(--below-strip,0px)] z-10 -mx-1 flex items-baseline justify-between gap-3 bg-stone-100/90 px-2 py-1.5 backdrop-blur-md dark:bg-stone-950/90">
              <h3 className="text-sm font-semibold">{month.label}</h3>
              <span className="num truncate text-xs text-stone-500">
                {month.fills.length} · {money(month.spent)}{month.economy != null ? ` · ${n1(month.economy)} ${economyUnit(unit)}` : ''}
              </span>
            </div>
            <List>
              {month.fills.map((fill) => <FillRow key={fill.entry.id} fill={fill} unit={unit} onOpen={() => onOpen(fill)} onChecked={() => resolve.mutate(fill.entry.id)} />)}
            </List>
          </section>
        ))}
        {months.length > shownMonths && (
          <Button variant="secondary" className="w-full" onClick={() => setShownMonths((shown) => shown + MONTHS_AT_A_TIME)}>
            Show earlier months ({months.length - shownMonths} more)
          </Button>
        )}
      </Section>
    </>
  )
}

/** How many months of fill-ups show at first, and how many more each "Show earlier months" adds. */
const MONTHS_AT_A_TIME = 6

/** Fill-ups by the month they were in, newest first, each month with what was spent and its average mileage. */
function byMonth(fills: FuelRow[]) {
  const months = new Map<string, FuelRow[]>()
  for (const fill of fills) {
    const when = new Date(fill.entry.filledAt)
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`
    const month = months.get(key)
    if (month) month.push(fill)
    else months.set(key, [fill])
  }
  return [...months.entries()].map(([key, inMonth]) => {
    const economies = inMonth.map((fill) => fill.kmPerUnit).filter((value): value is number => value != null)
    return {
      key,
      label: new Date(inMonth[0].entry.filledAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      fills: inMonth,
      spent: inMonth.reduce((total, fill) => total + fill.entry.totalCost, 0),
      economy: economies.length ? economies.reduce((total, value) => total + value, 0) / economies.length : null,
    }
  })
}

/** One fill-up: when, the odometer and volume, what it cost and its mileage; and, if its payment changed, a way to say it's checked. */
function FillRow({ fill, unit, onOpen, onChecked }: { fill: FuelRow; unit: string; onOpen: () => void; onChecked: () => void }) {
  return (
    <div>
      <ListRow onClick={onOpen}>
        <IconBadge><GasPump size={18} /></IconBadge>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{dateTime(fill.entry.filledAt)}</div>
          <RowMeta>
            {km(fill.entry.odometer)} · {n2(fill.entry.volume)} {unit}
            {!fill.entry.fullTank ? ' · partial' : ''}
            {fill.entry.missedPrevious ? ' · after a skipped one' : ''}
            {fill.entry.source !== 'MANUAL' ? ` · ${SOURCE[fill.entry.source]}` : fill.entry.stationName ? ` · ${fill.entry.stationName}` : ''}
          </RowMeta>
        </div>
        <div className="shrink-0 text-right">
          <div className="num font-semibold">{money(fill.entry.totalCost)}</div>
          <div className="num mt-0.5 text-[13px] text-stone-500">{fill.kmPerUnit != null ? `${n1(fill.kmPerUnit)} ${economyUnit(unit)}` : `@ ${money2(fill.entry.pricePerUnit)}`}</div>
        </div>
      </ListRow>
      {fill.entry.sourceIssue && (
        <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          <Warning size={16} /> <span className="flex-1">{fill.entry.sourceIssue}</span>
          <Button variant="ghost" className="!py-1" onClick={onChecked}>Checked</Button>
        </div>
      )}
    </div>
  )
}
