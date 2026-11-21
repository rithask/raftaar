import { Bar, BarChart, Line, LineChart, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { date, economyUnit, km, money, money2, n1 } from '@/lib/format'
import { evenTicks, monthLabel, short, type usualRange } from '@/ui/chartHelpers'
import { axis, ChartCard, grid, margin, tooltipStyle } from '@/ui/charts'

// The vehicle's charts. This module (and the charting library with it) is loaded on its own, the first time a
// chart is shown: see LazyCharts.tsx.

type Usual = ReturnType<typeof usualRange>

/** Km per litre (or per kg, per kWh) for each full tank, with the usual range shaded and poor tanks marked. */
export function MileageChart({ tanks, usual, unit }: { tanks: { when: string; kmpl: number }[]; usual: Usual; unit: string }) {
  return (
    <ChartCard>
      <LineChart data={tanks} margin={margin}>
        {grid}
        {usual && <ReferenceArea y1={usual.low} y2={usual.high} fill="var(--color-accent-strong)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />}
        <XAxis dataKey="when" {...axis} />
        <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.max(0, Math.floor(min - 2)), (max: number) => Math.ceil(max + 2)]} />
        <Tooltip formatter={(value) => [`${n1(Number(value))} ${economyUnit(unit)}`, 'Mileage']} {...tooltipStyle} />
        <Line type="monotone" dataKey="kmpl" stroke="var(--color-accent-strong)" strokeWidth={2.5} isAnimationActive={false}
          dot={({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: { kmpl: number }; index?: number }) => {
            const poor = usual != null && payload != null && payload.kmpl < usual.poor
            return <circle key={index} cx={cx} cy={cy} r={poor ? 4 : 3} fill={poor ? 'var(--color-amber-500, #f59e0b)' : 'var(--color-accent-strong)'} stroke="none" />
          }} />
      </LineChart>
    </ChartCard>
  )
}

/** What you paid per litre at each fill-up, and the published price then, when it's known. */
export function PriceChart({ prices, hasPublished }: { prices: { when: string; paid: number; published: number | null }[]; hasPublished: boolean }) {
  return (
    <ChartCard>
      <LineChart data={prices} margin={margin}>
        {grid}
        <XAxis dataKey="when" {...axis} />
        <YAxis {...axis} allowDecimals={false} tickCount={4} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} />
        <Tooltip formatter={(value, name) => [money2(Number(value)), name === 'paid' ? 'You paid' : 'Published']} {...tooltipStyle} />
        {hasPublished && <Line type="monotone" dataKey="published" stroke="var(--color-stone-400, #a8a29e)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />}
        <Line type="monotone" dataKey="paid" stroke="var(--color-accent-strong)" strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
      </LineChart>
    </ChartCard>
  )
}

/** Spending per month, fuel, service and other stacked. */
export function MonthlyChart({ months }: { months: { month: string; fuel: number; service: number; other: number }[] }) {
  return (
    <ChartCard>
      <BarChart data={months} margin={{ ...margin, left: -12 }}>
        {grid}
        <XAxis dataKey="month" {...axis} tickFormatter={(month: string) => monthLabel(month)} interval="preserveStartEnd" />
        <YAxis {...axis} tickCount={4} allowDecimals={false} tickFormatter={short} />
        <Tooltip labelFormatter={(month) => monthLabel(String(month), true)} formatter={(value, name) => [money(Number(value)), name === 'fuel' ? 'Fuel' : name === 'service' ? 'Service' : 'Other']}
          cursor={{ fill: 'currentColor', className: 'text-stone-500/10' }} {...tooltipStyle} />
        <Bar dataKey="fuel" stackId="m" fill="var(--color-accent)" isAnimationActive={false} />
        <Bar dataKey="service" stackId="m" fill="var(--color-sky-500, #0ea5e9)" isAnimationActive={false} />
        <Bar dataKey="other" stackId="m" fill="var(--color-violet-500, #8b5cf6)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartCard>
  )
}

/** The odometer over time, from every reading the vehicle has. */
export function OdometerChart({ readings }: { readings: { t: number; km: number }[] }) {
  const first = readings[0].t, last = readings[readings.length - 1].t
  const yearTicks = new Date(first).getFullYear() !== new Date(last).getFullYear()
  return (
    <ChartCard className="h-32">
      <LineChart data={readings} margin={{ ...margin, left: -4 }}>
        {grid}
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis} ticks={evenTicks(first, last)}
          tickFormatter={(t: number) => new Date(t).toLocaleDateString('en-IN', yearTicks ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })} />
        <YAxis {...axis} domain={['auto', 'auto']} tickCount={3} tickFormatter={short} />
        <Tooltip labelFormatter={(t) => date(new Date(Number(t)).toISOString())} formatter={(value) => [km(Number(value)), 'Odometer']} {...tooltipStyle} />
        <Line type="linear" dataKey="km" stroke="var(--color-accent-strong)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
      </LineChart>
    </ChartCard>
  )
}
