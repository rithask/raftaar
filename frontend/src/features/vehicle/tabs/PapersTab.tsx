import { Scroll } from '@phosphor-icons/react'
import { type DocView } from '@/lib/types'
import { PaperRow, paperSub } from '@/features/papers/PaperRow'
import { AddLink, EmptyState, List, Section } from '@/ui'

export function PapersSection({ docs, onOpen, onRenew, onAdd }: { docs: DocView[]; onOpen: (d: DocView) => void; onRenew: (d: DocView) => void; onAdd: () => void }) {
  return (
    <Section title="Papers" action={<AddLink label="Add" onClick={onAdd} />}>
      {!docs.length ? (
        <EmptyState icon={<Scroll size={36} />} title="No papers">Add insurance, PUC, RC and road tax to be reminded before they expire.</EmptyState>
      ) : (
        <List>
          {docs.map((d) => <PaperRow key={d.document.id} d={d} sub={paperSub(d)} onOpen={() => onOpen(d)} onRenew={() => onRenew(d)} />)}
        </List>
      )}
    </Section>
  )
}
