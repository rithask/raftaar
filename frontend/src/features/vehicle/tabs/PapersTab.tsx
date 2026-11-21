import { Scroll } from '@phosphor-icons/react'
import { type DocView } from '@/lib/types'
import { PaperRow, paperSub } from '@/features/papers/PaperRow'
import { AddLink, EmptyState, List, Section } from '@/ui'

export function PapersSection({ docs, onOpen, onRenew, onAdd }: { docs: DocView[]; onOpen: (paper: DocView) => void; onRenew: (paper: DocView) => void; onAdd: () => void }) {
  return (
    <Section title="Papers" action={<AddLink label="Add" onClick={onAdd} />}>
      {!docs.length ? (
        <EmptyState icon={<Scroll size={36} />} title="No papers">Add insurance, PUC, RC and road tax to be reminded before they expire.</EmptyState>
      ) : (
        <List>
          {docs.map((paper) => <PaperRow key={paper.document.id} d={paper} sub={paperSub(paper)} onOpen={() => onOpen(paper)} onRenew={() => onRenew(paper)} />)}
        </List>
      )}
    </Section>
  )
}
