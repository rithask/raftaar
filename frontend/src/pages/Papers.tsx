import { Plus, Scroll } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api, type DocView, type Vehicle } from '../api'
import { DocumentForm } from '../components/Forms'
import { Button, Empty, listItem, listParent, Loading, rowPress } from '../components/ui'
import { docLabel } from '../format'
import { DocBadge } from './Vehicle'

/** Every certificate and paper in one place, soonest to expire first. */
export function PapersPage() {
  const docs = useQuery({ queryKey: ['documents'], queryFn: () => api<DocView[]>('/documents') })
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api<Vehicle[]>('/vehicles') })
  const [open, setOpen] = useState<{ d?: DocView } | null>(null)
  if (docs.isLoading) return <Loading />
  const list = docs.data ?? []
  const vs = (vehicles.data ?? []).filter((v) => !v.archived)
  const name = (id: number | null) => (id == null ? 'You' : (vehicles.data ?? []).find((v) => v.id === id)?.name ?? '—')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-none font-bold tracking-tight">Papers</h1>
        <Button onClick={() => setOpen({})}><Plus size={16} /> Add</Button>
      </div>
      {list.length === 0 ? (
        <Empty icon={<Scroll size={48} />} title="No papers yet">Insurance, PUC, RC, road tax and your driving licence. You'll be reminded before they expire.</Empty>
      ) : (
        <motion.div variants={listParent} initial="hidden" animate="show" className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">
          {list.map((d) => (
            <motion.button variants={listItem} key={d.document.id} onClick={() => setOpen({ d })} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${rowPress}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.document.title}</div>
                <div className="truncate text-sm text-stone-500">{name(d.document.vehicleId)} · {docLabel[d.document.type]}{d.document.number ? ` · ${d.document.number}` : ''}</div>
              </div>
              <DocBadge d={d} />
            </motion.button>
          ))}
        </motion.div>
      )}
      <AnimatePresence>
        {open && <DocumentForm key="doc" open onClose={() => setOpen(null)} vehicles={vs} doc={open.d?.document} vehicleId={open.d ? open.d.document.vehicleId : null} />}
      </AnimatePresence>
    </div>
  )
}
