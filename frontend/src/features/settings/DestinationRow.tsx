import { Trash } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Badge, IconBadge, RowText } from '@/ui'

/**
 * One place notifications go (another device, an Apprise channel), in the list of them: what it is, a line about it
 * (how the last one went), badges ("failed", "paused"), and its controls on the right.
 */
export function DestinationRow({ icon, title, detail, failed, badges, children }: {
  icon: ReactNode; title: string; detail?: ReactNode; failed?: boolean; badges?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 pr-2 pl-4">
      <IconBadge tone="neutral" square>{icon}</IconBadge>
      {/* the name shortens before a badge does */}
      <RowText title={<span className="flex items-center gap-2"><span className="truncate">{title}</span>{badges}{failed && <Badge tone="bad" className="shrink-0">failed</Badge>}</span>}>
        {detail}
      </RowText>
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
