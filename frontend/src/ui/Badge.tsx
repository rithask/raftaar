import type { ReactNode } from 'react'
import { cx } from './cx'

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info'

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
        tone === 'ok' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        tone === 'bad' && 'bg-red-500/15 text-red-700 dark:text-red-400',
        tone === 'info' && 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
        className,
      )}
    >
      {children}
    </span>
  )
}
