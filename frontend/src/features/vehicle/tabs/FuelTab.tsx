import { CloudArrowUp, GasPump, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Line, LineChart, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/lib/api'
import { date, dateTime, economyUnit, km, money, money2, n1, n2 } from '@/lib/format'
import { amounts, useOutbox } from '@/lib/outbox'
import { type FuelRow, type Summary } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { axis, ChartCard, grid, margin, Swatch, tooltipStyle, usualRange } from '@/ui/charts'
import { Badge, Button, EmptyState, IconBadge, List, listItem, ListRow, RowMeta, Section } from '@/ui'
import { refresh } from '@/lib/queries'

export const SOURCE = { MANUAL: '', HISAAB: 'Hisaab', GEOPULSE: 'GeoPulse', HISAAB_GEOPULSE: 'Hisaab + GeoPulse' } as const
export function FuelTab({ vehicleId, summary, fills, onOpen }: { vehicleId: number; summary: Summary; fills: FuelRow[]; onOpen: (r: FuelRow) => void }) {
  const resolve = useSave((fid: number) => api(`/fuel/${fid}/resolve`, { method: 'POST' }), { refresh: refresh.vehicleRecords, done: 'Marked as checked' })
  const waiting = useOutbox().filter((w) => w.vehicleId === vehicleId)
  const hidden = useHidden()
  const list = fills.filter((r) => !hidden(`fuel:${r.entry.id}`))
  if (!list.length && !waiting.length) return <EmptyState icon={<GasPump size={40} />} title="No fill-ups yet">Add each fill-up with the odometer reading. Mileage shows after two full tanks.</EmptyState>
  const byId = new Map(list.map((r) => [r.entry.id, r.entry]))
  const chart = summary.economyHistory.map((st) => ({ when: date(byId.get(st.endId)?.filledAt, false), kmpl: st.kmPerUnit }))
  const unit = summary.unit
  const usual = usualRange(chart.map((c) => c.kmpl))
  const prices = [...list].reverse().map((r) => ({ when: date(r.entry.filledAt, false), paid: r.entry.pricePerUnit, published: r.publishedPrice }))
  const hasPublished = prices.some((p) => p.published != null)
  const spent = list.reduce((t, r) => t + r.entry.totalCost, 0)
  return (
    <>
      {chart.length >= 2 && (
        <Section title="Mileage per tank" meta={usual ? `${economyUnit(unit)} · usually ${n1(usual.low)}–${n1(usual.high)}` : economyUnit(unit)}>
          <ChartCard>
            <LineChart data={chart} margin={margin}>
              {grid}
              {usual && <ReferenceArea y1={usual.low} y2={usual.high} fill="var(--color-accent-strong)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />}
              <XAxis dataKey="when" {...axis} />
              <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.max(0, Math.floor(min - 2)), (max: number) => Math.ceil(max + 2)]} />
              <Tooltip formatter={(val) => [`${n1(Number(val))} ${economyUnit(unit)}`, 'Mileage']} {...tooltipStyle} />
              <Line type="monotone" dataKey="kmpl" stroke="var(--color-accent-strong)" strokeWidth={2.5} isAnimationActive={false}
                dot={({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: { kmpl: number }; index?: number }) => {
                  const low = usual != null && payload != null && payload.kmpl < usual.poor
                  return <circle key={index} cx={cx} cy={cy} r={low ? 4 : 3} fill={low ? 'var(--color-amber-500, #f59e0b)' : 'var(--color-accent-strong)'} stroke="none" />
                }} />
            </LineChart>
          </ChartCard>
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
          <ChartCard>
            <LineChart data={prices} margin={margin}>
              {grid}
              <XAxis dataKey="when" {...axis} />
              <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} />
              <Tooltip formatter={(val, name) => [money2(Number(val)), name === 'paid' ? 'You paid' : 'Published']} {...tooltipStyle} />
              {hasPublished && <Line type="monotone" dataKey="published" stroke="var(--color-stone-400, #a8a29e)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />}
              <Line type="monotone" dataKey="paid" stroke="var(--color-accent-strong)" strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          </ChartCard>
        </Section>
      )}
      <Section title="Fill-ups" meta={`${list.length} · ${money(spent)}`}>
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
          {list.map((r) => (
            <div key={r.entry.id}>
              <ListRow onClick={() => onOpen(r)}>
                <IconBadge><GasPump size={18} /></IconBadge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{dateTime(r.entry.filledAt)}</div>
                  <RowMeta>
                    {km(r.entry.odometer)} · {n2(r.entry.volume)} {unit}
                    {!r.entry.fullTank ? ' · partial' : ''}
                    {r.entry.missedPrevious ? ' · after a skipped one' : ''}
                    {r.entry.source !== 'MANUAL' ? ` · ${SOURCE[r.entry.source]}` : r.entry.stationName ? ` · ${r.entry.stationName}` : ''}
                  </RowMeta>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num font-semibold">{money(r.entry.totalCost)}</div>
                  <div className="num mt-0.5 text-[13px] text-stone-500">{r.kmPerUnit != null ? `${n1(r.kmPerUnit)} ${economyUnit(unit)}` : `@ ${money2(r.entry.pricePerUnit)}`}</div>
                </div>
              </ListRow>
              {r.entry.sourceIssue && (
                <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
                  <Warning size={16} /> <span className="flex-1">{r.entry.sourceIssue}</span>
                  <Button variant="ghost" className="!py-1" onClick={() => resolve.mutate(r.entry.id)}>Checked</Button>
                </div>
              )}
            </div>
          ))}
        </List>
      </Section>
    </>
  )
}
