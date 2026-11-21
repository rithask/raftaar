import type { ReactNode } from 'react'
import { cx } from './cx'

/** The colour of each kind of thing, so a fill-up, a service or a paper looks the same wherever it appears. */
const TONES = {
  accent: 'bg-accent-soft text-accent-strong', // fuel, vehicles
  sky: 'bg-sky-500/12 text-sky-600', // services, things waiting to be sent
  violet: 'bg-violet-500/12 text-violet-600', // expenses, papers
  emerald: 'bg-emerald-500/12 text-emerald-600', // trips
  neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200', // settings
} as const

const SIZES = { md: 'size-9', lg: 'size-12', xl: 'size-16' } as const

/** An icon on a soft tinted circle (or rounded square), at the start of a row or a card. */
export function IconBadge({ tone = 'accent', size = 'md', square, className, children }: {
  tone?: keyof typeof TONES; size?: keyof typeof SIZES; square?: boolean; className?: string; children: ReactNode
}) {
  return (
    <span className={cx('flex shrink-0 items-center justify-center', SIZES[size], square ? (size === 'md' ? 'rounded-xl' : 'rounded-2xl') : 'rounded-full', TONES[tone], className)}>
      {children}
    </span>
  )
}
