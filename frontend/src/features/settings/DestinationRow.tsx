import { Trash } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Badge, IconBadge } from '@/ui'

/**
 * One place notifications go (another device, an Apprise channel), in the list of them: what it is, then its badges
 * ("failed", "paused") and a line about it (how the last one went), and its controls on the right. The badges sit
 * under the name, not beside it, so a name keeps the room it has between the icon and the controls.
 */
export function DestinationRow({ icon, title, detail, failed, badges, children }: {
  icon: ReactNode; title: string; detail?: ReactNode; failed?: boolean; badges?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 pr-2 pl-4">
      <IconBadge tone="neutral" square>{icon}</IconBadge>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {failed && <Badge tone="bad" className="shrink-0">failed</Badge>}
          {badges}
          {detail && <span className="num truncate text-[13px] text-stone-500">{detail}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** The bin at the end of a row; {@code what} says what goes, for screen readers. */
export function RemoveButton({ what, onClick }: { what: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Remove ${what}`} onClick={onClick}
      className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600">
      <Trash size={16} />
    </button>
  )
}
