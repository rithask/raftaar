import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * A small heading above a list, with how many or how much ("12 · ₹4,300") and an action on the right ("+ Add").
 * The figures follow the title on its line, and only go to the next one when there isn't room.
 */
export function SectionHeader({ title, meta, action }: { title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">{title}</h2>
        {meta && <p className="num min-w-0 text-xs text-stone-500">{meta}</p>}
      </div>
      {action}
    </div>
  )
}

/** A part of a page: its heading, then what's in it. */
export function Section({ title, meta, action, children, className }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('space-y-2', className)}>
      <SectionHeader title={title} meta={meta} action={action} />
      {children}
    </section>
  )
}

/** The text-style "+ Add" button used in section headers. */
export function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-my-1 flex shrink-0 select-none items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-accent-strong transition active:scale-95 active:bg-accent-soft"
    >
      <span aria-hidden>+</span> {label}
    </button>
  )
}
