import { useState } from 'react'
import { api } from '@/lib/api'
import { km, num, today } from '@/lib/format'
import { type ReminderView, type ServiceRow } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Chip, DateInput, ErrorText, Field, FormScreen, Input, TextArea } from '@/ui'
import { refresh } from '@/lib/queries'

export function ServiceForm({ open, onClose, vehicleId, row, reminders, odometer }: {
  open: boolean; onClose: () => void; vehicleId: number; row?: ServiceRow; reminders: ReminderView[]; odometer?: number | null
}) {
  const r = row?.record
  const [f, setF] = useState({
    servicedOn: r?.servicedOn ?? today(),
    odometer: r?.odometer?.toString() ?? '',
    title: r?.title ?? '',
    workshop: r?.workshop ?? '',
    cost: r?.cost?.toString() ?? '',
    notes: r?.notes ?? '',
  })
  const [completes, setCompletes] = useState<number[]>(row?.reminderIds ?? [])
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }))
  const titleFromReminders = () => reminders.filter((x) => completes.includes(x.reminder.id)).map((x) => x.reminder.title).join(', ')
  const body = () => ({ ...f, title: f.title || titleFromReminders(), odometer: num(f.odometer), cost: num(f.cost) ?? 0, completes })
  const save = useSave(() => (r ? api(`/services/${r.id}`, { method: 'PUT', body: body() }) : api(`/vehicles/${vehicleId}/services`, { body: body() })), { refresh: refresh.vehicleRecords, onDone: onClose, done: 'Service saved' })
  const toggle = (id: number) => setCompletes((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <FormScreen open={open} onClose={onClose} title={r ? 'Edit service' : 'Log a service'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={r ? () => { deleteWithUndo({ refresh: refresh.vehicleRecords, text: 'Service deleted', what: 'the service', hide: `service:${r.id}`, run: () => api(`/services/${r.id}`, { method: 'DELETE' }) }); onClose() } : undefined}>
      <div className="space-y-4">
        {reminders.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-stone-500">Reminders this covers</p>
            <div className="flex flex-wrap gap-2">
              {reminders.map((x) => <Chip key={x.reminder.id} active={completes.includes(x.reminder.id)} onClick={() => toggle(x.reminder.id)}>{x.reminder.title}</Chip>)}
            </div>
            {completes.length > 0 && <p className="mt-1.5 text-xs text-stone-500">They'll count again from this service.</p>}
          </div>
        )}
        <Field label="What was done"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={titleFromReminders() || 'General service, oil and filter'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer (km)" hint={odometer ? `Now ≈ ${km(odometer)}` : undefined}><Input inputMode="decimal" value={f.odometer} onChange={(e) => set('odometer', e.target.value)} /></Field>
          <Field label="Cost (₹)"><Input inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        </div>
        <Field label="Date"><DateInput value={f.servicedOn} onChange={(v) => set('servicedOn', v)} /></Field>
        <Field label="Workshop"><Input value={f.workshop} onChange={(e) => set('workshop', e.target.value)} /></Field>
        <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Parts replaced, things to watch" /></Field>
        <ErrorText error={save.error} />
      </div>
    </FormScreen>
  )
}
