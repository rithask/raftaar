import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Spinner } from './Button'
import { surface } from './Card'
import { cx } from './cx'
import { softSpring, spring } from './motion'

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -6, 5, -3, 0] }} transition={{ duration: 0.35 }}
      className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </motion.p>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.05 }} className="text-stone-400 dark:text-stone-600">
          {icon}
        </motion.div>
      )}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-stone-500 dark:text-stone-400">{children}</div>}
    </motion.div>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-stone-400">
      <Spinner className="size-6" />
    </div>
  )
}

/** A grey block that gently pulses where content is about to appear, in its shape, so nothing jumps when it does. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-stone-200/80 dark:bg-stone-800', className)} aria-hidden />
}

/** A list card of placeholder rows, the height of the real ones. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={cx('divide-y divide-stone-900/5 overflow-hidden rounded-2xl dark:divide-white/5', surface)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}
