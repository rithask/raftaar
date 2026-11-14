import type { ReactElement } from 'react'
import { CartesianGrid, ResponsiveContainer } from 'recharts'
import { n1 } from '../format'

/** Shared look for the small charts: a card, quiet axes, a soft grid. */
export function ChartCard({ children, className = 'h-40' }: { children: ReactElement; className?: string }) {
  return (
    <div className={`${className} rounded-2xl bg-white p-3 pt-4 ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10`}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

export const grid = <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-stone-200 dark:text-stone-800" vertical={false} />

export const axis = { tick: { fontSize: 11, fill: 'currentColor' }, className: 'text-stone-500', tickLine: false, axisLine: false } as const

export const tooltipStyle = { contentStyle: { borderRadius: 12, border: 'none', fontSize: 12 } } as const

export const margin = { top: 4, right: 8, bottom: 0, left: -24 }

/**
 * What's usual: the middle half of the values (25th to 75th percentile), and the line below which a value is
 * clearly worse than that, at least 5% under the median so a run of near-identical tanks doesn't flag noise.
 */
export function usualRange(values: number[]): { low: number; high: number; poor: number } | null {
  if (values.length < 4) return null
  const v = [...values].sort((a, b) => a - b)
  const q = (p: number) => {
    const i = (v.length - 1) * p
    const lo = Math.floor(i)
    return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo)
  }
  const low = q(0.25)
  const high = q(0.75)
  return { low, high, poor: low - Math.max(1.5 * (high - low), 0.05 * q(0.5)) }
}

/** A short line for a chart key, solid or dashed like the series it names. */
export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="14" height="6" aria-hidden className="shrink-0">
      <line x1="1" y1="3" x2="13" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? '3 2.5' : undefined} />
    </svg>
  )
}

/** "Oct" for a "2026-10" month, or "Oct 2026" with the year. */
export function monthLabel(month: string, withYear = false) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

/** Axis numbers: 1.5k rather than 1500, so they stay narrow. */
export const short = (v: number) => (Math.abs(v) >= 1000 ? `${n1(v / 1000)}k` : String(Math.round(v)))

/** {@code count} evenly spaced ticks from the first value to the last. */
export function evenTicks(min: number, max: number, count = 4) {
  if (max <= min) return [min]
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1))
}
