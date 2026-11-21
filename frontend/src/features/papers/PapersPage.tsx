import { Plus, Scroll } from '@phosphor-icons/react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { type DocView } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { DocumentForm } from './DocumentForm'
import { needsRenewal, PaperRow, paperSub } from './PaperRow'
import { Button, EmptyState, List, Loading, PageHeader, Section } from '@/ui'
import { useDocuments, useVehicles } from '@/lib/queries'

/** Every certificate and paper in one place: what needs attention first (expired, then expiring), then the rest. */
export function PapersPage() {
  const docs = useDocuments()
  const vehicles = useVehicles()
  const [open, setOpen] = useState<{ d?: DocView; renewing?: boolean } | null>(null)
  const hidden = useHidden()
  if (docs.isLoading) return <Loading />
  const list = (docs.data ?? []).filter((paper) => !hidden(`doc:${paper.document.id}`))
  const vs = (vehicles.data ?? []).filter((vehicle) => !vehicle.archived)
  const name = (id: number | null) => (id == null ? 'You' : (vehicles.data ?? []).find((vehicle) => vehicle.id === id)?.name ?? '—')
  const byExpiry = (paper: DocView, b: DocView) => (paper.document.expiresOn ?? '').localeCompare(b.document.expiresOn ?? '')
  const groups = [
    { title: 'Needs attention', items: list.filter(needsRenewal).sort((paper, b) => Number(b.state === 'EXPIRED') - Number(paper.state === 'EXPIRED') || byExpiry(paper, b)) },
    { title: 'Valid', items: list.filter((paper) => paper.state === 'VALID').sort(byExpiry) },
    { title: 'No expiry', items: list.filter((paper) => paper.state === 'NO_EXPIRY') },
  ].filter((g) => g.items.length)

  return (
    <div className="space-y-5">
      <PageHeader title="Papers" action={<Button onClick={() => setOpen({})}><Plus size={16} /> Add</Button>} />
      {list.length === 0 ? (
        <EmptyState icon={<Scroll size={48} />} title="No papers yet">Insurance, PUC, RC, road tax and your driving licence. You'll be reminded before they expire.</EmptyState>
      ) : (
        groups.map((g) => (
          <Section key={g.title} title={g.title} meta={String(g.items.length)}>
            <List>
              {g.items.map((paper) => (
                <PaperRow key={paper.document.id} d={paper} icon={false} sub={paperSub(paper, name(paper.document.vehicleId))}
                  onOpen={() => setOpen({ d: paper })} onRenew={() => setOpen({ d: paper, renewing: true })} />
              ))}
            </List>
          </Section>
        ))
      )}
      <AnimatePresence>
        {open && <DocumentForm key="doc" open onClose={() => setOpen(null)} vehicles={vs} doc={open.d?.document} vehicleId={open.d ? open.d.document.vehicleId : null} renewing={open.renewing} />}
      </AnimatePresence>
    </div>
  )
}
