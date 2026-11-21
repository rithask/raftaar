import { Plus, Scroll } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { type DocView, type Vehicle } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { DocumentForm } from './DocumentForm'
import { needsRenewal, PaperRow, paperSub } from './PaperRow'
import { Button, EmptyState, List, Loading, PageHeader, Section } from '@/ui'

/** Every certificate and paper in one place: what needs attention first (expired, then expiring), then the rest. */
export function PapersPage() {
  const docs = useQuery({ queryKey: ['documents'], queryFn: () => api<DocView[]>('/documents') })
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api<Vehicle[]>('/vehicles') })
  const [open, setOpen] = useState<{ d?: DocView; renewing?: boolean } | null>(null)
  const hidden = useHidden()
  if (docs.isLoading) return <Loading />
  const list = (docs.data ?? []).filter((d) => !hidden(`doc:${d.document.id}`))
  const vs = (vehicles.data ?? []).filter((v) => !v.archived)
  const name = (id: number | null) => (id == null ? 'You' : (vehicles.data ?? []).find((v) => v.id === id)?.name ?? '—')
  const byExpiry = (a: DocView, b: DocView) => (a.document.expiresOn ?? '').localeCompare(b.document.expiresOn ?? '')
  const groups = [
    { title: 'Needs attention', items: list.filter(needsRenewal).sort((a, b) => Number(b.state === 'EXPIRED') - Number(a.state === 'EXPIRED') || byExpiry(a, b)) },
    { title: 'Valid', items: list.filter((d) => d.state === 'VALID').sort(byExpiry) },
    { title: 'No expiry', items: list.filter((d) => d.state === 'NO_EXPIRY') },
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
              {g.items.map((d) => (
                <PaperRow key={d.document.id} d={d} icon={false} sub={paperSub(d, name(d.document.vehicleId))}
                  onOpen={() => setOpen({ d })} onRenew={() => setOpen({ d, renewing: true })} />
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
