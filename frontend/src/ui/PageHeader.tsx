import type { ReactNode } from 'react'

/** A section's title (Garage, Inbox, Papers, Settings), with its main action on the right. */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <h1 className="text-[28px] leading-none font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}
