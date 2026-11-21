import { Trash } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/lib/api'
import { date, fromLocalInput, km, n1, num, time, toLocalInput } from '@/lib/format'
import { type Odometer, type OdometerReading } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { axis, ChartCard, evenTicks, grid, margin, short, tooltipStyle } from '@/ui/charts'
import { DateTimeInput, ErrorText, Field, FormScreen, Input, List, Section } from '@/ui'

export function OdometerForm({ open, onClose, vehicleId, current, odometer }: {
  open: boolean; onClose: () => void; vehicleId: number; current?: number | null; odometer?: Odometer
}) {
  const [when, setWhen] = useState(toLocalInput())
  const [value, setValue] = useState('')
  const save = useSave(() => api(`/vehicles/${vehicleId}/odometer`, { body: { readAt: fromLocalInput(when), odometer: num(value) } }), onClose, 'Reading saved')
  return (
    <FormScreen open={open} onClose={onClose} title="Odometer reading" onSave={() => save.mutate(undefined)} saving={save.isPending}>
      <div className="space-y-4">
        <Field label="Reading (km)" hint={current ? `Last reading ${km(current)}` : undefined}><Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></Field>
        <Field label="When"><DateTimeInput value={when} onChange={setWhen} /></Field>
        <ErrorText error={save.error} />
        <OdometerHistory vehicleId={vehicleId} odometer={odometer} />
      </div>
    </FormScreen>
  )
}

export const READING_FROM: Record<OdometerReading['source'], string> = {
  PURCHASE: 'Purchase', FUEL: 'Fill-up', SERVICE: 'Service', EXPENSE: 'Expense', MANUAL: 'By hand',
}

export const DAY = 86_400_000

/** Fill-ups and hand readings have a time; services, expenses and the purchase only a day. */
export const readAt = (r: OdometerReading) => (r.source === 'FUEL' || r.source === 'MANUAL' ? `${date(r.at)}, ${time(r.at)}` : date(r.at))

/**
 * Every reading the vehicle has, newest first, each with how far it went since the one before and how fast.
 * Only the ones entered here can be removed; the rest belong to their fill-up, service or expense.
 */
export function OdometerHistory({ vehicleId, odometer }: { vehicleId: number; odometer?: Odometer }) {
  const rows = useQuery({ queryKey: ['odometer', vehicleId], queryFn: () => api<OdometerReading[]>(`/vehicles/${vehicleId}/odometer`) })
  const remove = useSave((id: number) => api(`/odometer/${id}`, { method: 'DELETE' }), undefined, 'Reading removed')
  const list = rows.data ?? []
  if (!list.length) return null
  const chart = [...list].reverse().map((r) => ({ t: new Date(r.at).getTime(), km: r.odometer }))
  const spansTime = chart.length >= 2 && chart[chart.length - 1].t - chart[0].t >= DAY
  const yearTicks = chart.length && new Date(chart[0].t).getFullYear() !== new Date(chart[chart.length - 1].t).getFullYear()
  const meta = [
    odometer?.kmPerDay != null ? `${n1(odometer.kmPerDay)} km a day` : null,
    odometer?.tripKmSince != null ? `≈ ${km(odometer.tripKmSince)} since the last reading` : null,
  ].filter(Boolean).join(' · ')
  return (
    <Section title="History" meta={meta || undefined} className="pt-2">
      {spansTime && (
        <ChartCard className="h-32">
          <LineChart data={chart} margin={{ ...margin, left: -4 }}>
            {grid}
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis} ticks={evenTicks(chart[0].t, chart[chart.length - 1].t)}
              tickFormatter={(t: number) => new Date(t).toLocaleDateString('en-IN', yearTicks ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })} />
            <YAxis {...axis} domain={['auto', 'auto']} tickCount={3} tickFormatter={short} />
            <Tooltip labelFormatter={(t) => date(new Date(Number(t)).toISOString())} formatter={(v) => [km(Number(v)), 'Odometer']} {...tooltipStyle} />
            <Line type="linear" dataKey="km" stroke="var(--color-accent-strong)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          </LineChart>
        </ChartCard>
      )}
      <List>
        {list.map((r, i) => {
          const prev = list[i + 1]
          const gone = prev ? r.odometer - prev.odometer : null
          const days = prev ? (new Date(r.at).getTime() - new Date(prev.at).getTime()) / DAY : 0
          return (
            <div key={`${r.source}${r.id ?? ''}${r.at}${i}`} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <div className="num font-medium">{km(r.odometer)}</div>
                <div className="num truncate text-[13px] text-stone-500">{readAt(r)} · {READING_FROM[r.source]}</div>
              </div>
              {gone != null && (
                <div className="num shrink-0 text-right">
                  <div className={gone < 0 ? 'text-sm font-medium text-amber-600' : 'text-sm text-stone-700 dark:text-stone-300'}>
                    {gone < 0 ? `−${km(-gone)}` : `+${km(gone)}`}
                  </div>
                  {gone > 0 && days >= 1 && <div className="text-[13px] text-stone-500">{n1(gone / days)} km/day</div>}
                </div>
              )}
              {r.id != null ? (
                <button type="button" aria-label="Remove reading" disabled={remove.isPending}
                  onClick={() => remove.mutate(r.id!)}
                  className="shrink-0 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-red-600 active:scale-90 disabled:opacity-50 dark:hover:bg-stone-800">
                  <Trash size={16} />
                </button>
              ) : <span className="w-8 shrink-0" />}
            </div>
          )
        })}
      </List>
    </Section>
  )
}
