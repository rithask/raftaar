import { useState } from 'react'
import { api } from '@/lib/api'
import { num, today } from '@/lib/format'
import { type Reminder } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Chip, DateInput, ErrorText, Field, FormScreen, Input, Segmented, Toggle } from '@/ui'
import { refresh } from '@/lib/queries'

export const PRESETS: { title: string; km?: number; months?: number }[] = [
  { title: 'Engine oil', km: 5000, months: 6 },
  { title: 'General service', km: 10000, months: 12 },
  { title: 'Chain clean & lube', km: 500 },
  { title: 'Air filter', km: 10000 },
  { title: 'Coolant', months: 24 },
  { title: 'Brake fluid', months: 24 },
  { title: 'Tyres', km: 25000 },
]

export function ReminderForm({ open, onClose, vehicleId, reminder, odometer }: { open: boolean; onClose: () => void; vehicleId: number; reminder?: Reminder; odometer?: number | null }) {
  const [form, setForm] = useState({
    title: reminder?.title ?? '',
    mode: (reminder && reminder.intervalKm == null && reminder.intervalMonths == null ? 'once' : 'repeat') as 'once' | 'repeat',
    intervalKm: reminder?.intervalKm?.toString() ?? '',
    intervalMonths: reminder?.intervalMonths?.toString() ?? '',
    lastDoneOn: reminder?.lastDoneOn ?? (reminder ? '' : today()),
    lastDoneOdometer: reminder?.lastDoneOdometer?.toString() ?? (odometer != null && !reminder ? String(Math.round(odometer)) : ''),
    dueOn: reminder?.dueOn ?? '',
    dueOdometer: reminder?.dueOdometer?.toString() ?? '',
    notifyDaysBefore: String(reminder?.notifyDaysBefore ?? 14),
    notifyKmBefore: String(reminder?.notifyKmBefore ?? 300),
    active: reminder?.active ?? true,
    notes: reminder?.notes ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((o) => ({ ...o, [k]: v }))
  const repeat = form.mode === 'repeat'
  const body = () => ({
    title: form.title,
    intervalKm: repeat ? num(form.intervalKm) : null,
    intervalMonths: repeat ? num(form.intervalMonths) : null,
    lastDoneOn: repeat ? form.lastDoneOn || null : null,
    lastDoneOdometer: repeat ? num(form.lastDoneOdometer) : null,
    dueOn: repeat ? null : form.dueOn || null,
    dueOdometer: repeat ? null : num(form.dueOdometer),
    notifyDaysBefore: num(form.notifyDaysBefore),
    notifyKmBefore: num(form.notifyKmBefore),
    active: form.active,
    notes: form.notes || null,
  })
  const save = useSave(() => (reminder ? api(`/reminders/${reminder.id}`, { method: 'PUT', body: body() }) : api(`/vehicles/${vehicleId}/reminders`, { body: body() })), { refresh: refresh.vehicleRecords, onDone: onClose, done: 'Reminder saved' })

  return (
    <FormScreen open={open} onClose={onClose} title={reminder ? 'Edit reminder' : 'New reminder'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={reminder ? () => { deleteWithUndo({ refresh: refresh.vehicleRecords, text: 'Reminder deleted', what: 'the reminder', hide: `reminder:${reminder.id}`, run: () => api(`/reminders/${reminder.id}`, { method: 'DELETE' }) }); onClose() } : undefined}>
      <div className="space-y-4">
        {!reminder && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p.title} active={form.title === p.title}
                onClick={() => setForm((o) => ({ ...o, title: p.title, mode: 'repeat', intervalKm: p.km?.toString() ?? '', intervalMonths: p.months?.toString() ?? '' }))}>
                {p.title}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Name"><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Engine oil" /></Field>
        <Segmented value={form.mode} onChange={(v) => set('mode', v)} options={[{ value: 'repeat', label: 'Repeating' }, { value: 'once', label: 'One-time' }]} />
        {repeat ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Every (km)"><Input inputMode="numeric" value={form.intervalKm} onChange={(e) => set('intervalKm', e.target.value)} /></Field>
              <Field label="Every (months)"><Input inputMode="numeric" value={form.intervalMonths} onChange={(e) => set('intervalMonths', e.target.value)} /></Field>
            </div>
            <p className="-mt-2 text-xs text-stone-500">Due at whichever comes first.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last done (km)"><Input inputMode="decimal" value={form.lastDoneOdometer} onChange={(e) => set('lastDoneOdometer', e.target.value)} /></Field>
              <Field label="Last done on"><DateInput value={form.lastDoneOn} onChange={(v) => set('lastDoneOn', v)} allowEmpty placeholder="Date" /></Field>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due on"><DateInput value={form.dueOn} onChange={(v) => set('dueOn', v)} allowEmpty placeholder="Date" /></Field>
            <Field label="or at (km)"><Input inputMode="decimal" value={form.dueOdometer} onChange={(e) => set('dueOdometer', e.target.value)} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Remind me (days before)"><Input inputMode="numeric" value={form.notifyDaysBefore} onChange={(e) => set('notifyDaysBefore', e.target.value)} /></Field>
          <Field label="Remind me (km before)"><Input inputMode="numeric" value={form.notifyKmBefore} onChange={(e) => set('notifyKmBefore', e.target.value)} /></Field>
        </div>
        {reminder && <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Active" />}
        <ErrorText error={save.error} />
      </div>
    </FormScreen>
  )
}
