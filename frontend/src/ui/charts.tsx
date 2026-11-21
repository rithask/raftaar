import type { ReactElement } from 'react'
import { CartesianGrid, ResponsiveContainer } from 'recharts'
import { surface } from './Card'
import { cx } from './cx'

// Only the chart components in features/vehicle/charts.tsx import this: it pulls in the charting library, which is
// loaded on its own, when a chart is first shown.

/** Shared look for the small charts: a card, quiet axes, a soft grid. */
export function ChartCard({ children, className = 'h-40' }: { children: ReactElement; className?: string }) {
  return (
    <div className={cx(className, 'rounded-2xl p-3 pt-4', surface)}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

export const grid = <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-stone-200 dark:text-stone-800" vertical={false} />

export const axis = { tick: { fontSize: 11, fill: 'currentColor' }, className: 'text-stone-500', tickLine: false, axisLine: false } as const

export const tooltipStyle = { contentStyle: { borderRadius: 12, border: 'none', fontSize: 12 } } as const

export const margin = { top: 4, right: 8, bottom: 0, left: -24 }
