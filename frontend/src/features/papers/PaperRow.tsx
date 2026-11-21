import { ArrowsClockwise, Scroll } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { date, docLabel } from '@/lib/format'
import { type DocView } from '@/lib/types'
import { Badge, cx, listItem, rowPress } from '@/ui/ui'

export function DocBadge({ d }: { d: DocView }) {
  if (d.state === 'NO_EXPIRY') return <Badge className="shrink-0">no expiry</Badge>
  if (d.state === 'EXPIRED') return <Badge tone="bad" className="shrink-0">expired</Badge>
  if (d.state === 'EXPIRING') return <Badge tone="warn" className="shrink-0">{d.daysLeft === 0 ? 'today' : `${d.daysLeft} days`}</Badge>
  return <Badge tone="ok" className="shrink-0">till {date(d.document.expiresOn, false)}</Badge>
}

/** Expired or about to: worth a one-tap Renew. */
export const needsRenewal = (d: DocView) => d.state === 'EXPIRED' || d.state === 'EXPIRING'

/**
 * One paper in a list: opens it on tap; expired and expiring ones also get a Renew button that opens it with the
 * dates moved to the next term.
 */
export function PaperRow({ d, sub, onOpen, onRenew, icon = true }: { d: DocView; sub: string; onOpen: () => void; onRenew: () => void; icon?: boolean }) {
  return (
    <motion.div variants={listItem} className="flex items-center">
      <button type="button" onClick={onOpen} className={cx('flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left', needsRenewal(d) ? 'pr-2' : 'pr-4', rowPress)}>
        {icon && <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600"><Scroll size={18} /></span>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{d.document.title}</div>
          <div className="num mt-0.5 truncate text-[13px] text-stone-500">{sub}</div>
        </div>
        <DocBadge d={d} />
      </button>
      {needsRenewal(d) && (
        <button type="button" onClick={onRenew} aria-label={`Renew ${d.document.title}`}
          className="mr-3 flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition active:scale-95">
          <ArrowsClockwise size={14} weight="bold" /> Renew
        </button>
      )}
    </motion.div>
  )
}

export const paperSub = (d: DocView, owner?: string) =>
  [owner, docLabel[d.document.type], d.document.number].filter(Boolean).join(' · ')
