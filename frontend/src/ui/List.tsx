import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { surface } from './Card'
import { cx } from './cx'
import { listItem, listParent, rowPress } from './motion'

/** Rows on one card with hairlines between them; the rows fade in one after another. */
export function List({ children, className, label, as }: { children: ReactNode; className?: string; label?: string; as?: 'nav' }) {
  const Box = as === 'nav' ? motion.nav : motion.div
  return (
    <Box variants={listParent} initial="hidden" animate="show" aria-label={label}
      className={cx('divide-y divide-stone-900/5 overflow-hidden rounded-2xl dark:divide-white/5', surface, className)}>
      {children}
    </Box>
  )
}

/** A row in a {@link List}: a button when it does something on tap, otherwise a plain row. */
export function ListRow({ onClick, children, className }: { onClick?: () => void; children: ReactNode; className?: string }) {
  const layout = cx('flex w-full items-center gap-3 px-4 py-3 text-left', className)
  if (!onClick) return <motion.div variants={listItem} className={layout}>{children}</motion.div>
  return <motion.button type="button" variants={listItem} onClick={onClick} className={cx(layout, rowPress)}>{children}</motion.button>
}

/** A row's text: the title, and the quieter line of details under it. */
export function RowText({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium">{title}</div>
      {children != null && <RowMeta>{children}</RowMeta>}
    </div>
  )
}

/** The quieter line of details under a row's title. */
export function RowMeta({ children }: { children: ReactNode }) {
  return <div className="num mt-0.5 truncate text-[13px] text-stone-500">{children}</div>
}
