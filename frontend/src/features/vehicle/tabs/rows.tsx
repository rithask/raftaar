import { motion } from 'motion/react'
import { type ReactNode } from 'react'
import { listItem, listParent, rowPress } from '@/ui/ui'

export function List({ children }: { children: ReactNode }) {
  return <motion.div variants={listParent} initial="hidden" animate="show" className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">{children}</motion.div>
}

export function Row({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return <motion.button variants={listItem} onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${rowPress}`}>{children}</motion.button>
}

export function Small({ children }: { children: ReactNode }) {
  return <div className="num mt-0.5 truncate text-[13px] text-stone-500">{children}</div>
}
