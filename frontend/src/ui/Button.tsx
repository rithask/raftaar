import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import { press } from './motion'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ variant = 'secondary', className, busy, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50',
        press,
        variant === 'primary' && 'bg-accent text-on-accent shadow-sm shadow-black/15 hover:bg-accent-hover active:bg-accent-hover active:shadow-none',
        variant === 'secondary' && 'bg-stone-200/80 text-stone-900 hover:bg-stone-300/80 active:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:active:bg-stone-700',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-200/70 active:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800 dark:active:bg-stone-800',
        variant === 'danger' && 'bg-red-600/10 text-red-700 hover:bg-red-600/20 active:bg-red-600/25 dark:text-red-400',
        className,
      )}
    >
      {busy ? (
        <>
          <Spinner /> <span className="sr-only">Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}
