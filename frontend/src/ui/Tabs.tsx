import { motion } from 'motion/react'
import { useId } from 'react'
import { cx } from './cx'
import { spring } from './motion'

/**
 * Page tabs: plain labels with an accent bar that slides under the chosen one. The strip sticks to the top while
 * the list below scrolls. A dot marks a tab that has something needing attention.
 */
export function Tabs<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; dot?: 'warn' | 'bad' }[]
}) {
  const bar = useId()
  return (
    <div
      role="tablist"
      className="sticky top-[var(--sticky-top,0px)] z-20 -mx-4 flex border-b border-stone-900/10 bg-stone-100/85 px-1 backdrop-blur-md sm:mx-0 sm:px-0 dark:border-white/10 dark:bg-stone-950/85"
    >
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative flex-1 select-none px-1 pt-3 pb-2.5 text-[13px] font-medium transition-colors duration-200 active:opacity-60 sm:text-sm',
              on ? 'font-semibold text-stone-900 dark:text-stone-50' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200',
            )}
          >
            <span className="relative inline-flex items-center gap-1">
              {o.label}
              {o.dot && <span className={cx('size-1.5 rounded-full', o.dot === 'bad' ? 'bg-red-500' : 'bg-amber-500')} aria-label="needs attention" />}
            </span>
            {on && <motion.span layoutId={bar} transition={spring} className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-accent-strong sm:inset-x-6" />}
          </button>
        )
      })}
    </div>
  )
}
