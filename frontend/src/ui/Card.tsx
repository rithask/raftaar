import type { ReactNode } from 'react'
import { cx } from './cx'

/** The white surface cards and lists sit on, in light and dark. */
export const surface = 'bg-white ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10'

/**
 * A card: the surface with rounded corners. {@code padded} gives it the usual inner space, {@code raised} a soft
 * shadow for a card that stands on its own (not one in a list of them).
 */
export function Card({ children, className, padded, raised }: { children: ReactNode; className?: string; padded?: boolean; raised?: boolean }) {
  return <div className={cx('rounded-2xl', surface, padded && 'p-4', raised && 'shadow-sm', className)}>{children}</div>
}
