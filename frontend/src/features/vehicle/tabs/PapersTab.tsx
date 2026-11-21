import { Scroll } from '@phosphor-icons/react'
import { type DocView } from '@/lib/types'
import { AddLink, Empty, SectionHeader } from '@/ui/ui'
import { PaperRow, paperSub } from '@/features/papers/PaperRow'
import { List } from './rows'

export function PapersSection({ docs, onOpen, onRenew, onAdd }: { docs: DocView[]; onOpen: (d: DocView) => void; onRenew: (d: DocView) => void; onAdd: () => void }) {
  return (
    <section className="space-y-2">
      <SectionHeader title="Papers" action={<AddLink label="Add" onClick={onAdd} />} />
      {!docs.length ? (
        <Empty icon={<Scroll size={36} />} title="No papers">Add insurance, PUC, RC and road tax to be reminded before they expire.</Empty>
      ) : (
        <List>
          {docs.map((d) => <PaperRow key={d.document.id} d={d} sub={paperSub(d)} onOpen={() => onOpen(d)} onRenew={() => onRenew(d)} />)}
        </List>
      )}
    </section>
  )
}
