import type { ReactNode } from 'react'

/** A bit of code or a setting's name inside a sentence (APPRISE_URLS, ntfys://…). */
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 text-[11px] dark:bg-stone-800">{children}</code>
}
