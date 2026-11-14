import { Paperclip } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api, type DocType, type Doc, type Expense, type ExpenseCategory, type OdometerReading, type Reminder, type ReminderView, type ServiceRow, type Suggestion, type Vehicle } from '../api'
import { date, dateTime, docLabel, expenseLabel, fromLocalInput, km, num, toLocalInput, today, toLocalDate } from '../format'
import { useSave } from '../hooks'
import { DateInput, DateTimeInput, plusMonths } from './DateField'
import { Button, Chip, ErrorText, Field, FormScreen, Input, Segmented, Select, TextArea, Toggle } from './ui'

// ---- service ----------------------------------------------------------------------------------------------

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
  const save = useSave(() => (r ? api(`/services/${r.id}`, { method: 'PUT', body: body() }) : api(`/vehicles/${vehicleId}/services`, { body: body() })), onClose, 'Service saved')
  const del = useSave(() => api(`/services/${r!.id}`, { method: 'DELETE' }), onClose, 'Service deleted')
  const toggle = (id: number) => setCompletes((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <FormScreen open={open} onClose={onClose} title={r ? 'Edit service' : 'Log a service'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={r ? () => confirm('Delete this service?') && del.mutate(undefined) : undefined} deleting={del.isPending}>
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
        <ErrorText error={save.error ?? del.error} />
      </div>
    </FormScreen>
  )
}

// ---- reminders --------------------------------------------------------------------------------------------

const PRESETS: { title: string; km?: number; months?: number }[] = [
  { title: 'Engine oil', km: 5000, months: 6 },
  { title: 'General service', km: 10000, months: 12 },
  { title: 'Chain clean & lube', km: 500 },
  { title: 'Air filter', km: 10000 },
  { title: 'Coolant', months: 24 },
  { title: 'Brake fluid', months: 24 },
  { title: 'Tyres', km: 25000 },
]

export function ReminderForm({ open, onClose, vehicleId, reminder, odometer }: { open: boolean; onClose: () => void; vehicleId: number; reminder?: Reminder; odometer?: number | null }) {
  const [f, setF] = useState({
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
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }))
  const repeat = f.mode === 'repeat'
  const body = () => ({
    title: f.title,
    intervalKm: repeat ? num(f.intervalKm) : null,
    intervalMonths: repeat ? num(f.intervalMonths) : null,
    lastDoneOn: repeat ? f.lastDoneOn || null : null,
    lastDoneOdometer: repeat ? num(f.lastDoneOdometer) : null,
    dueOn: repeat ? null : f.dueOn || null,
    dueOdometer: repeat ? null : num(f.dueOdometer),
    notifyDaysBefore: num(f.notifyDaysBefore),
    notifyKmBefore: num(f.notifyKmBefore),
    active: f.active,
    notes: f.notes || null,
  })
  const save = useSave(() => (reminder ? api(`/reminders/${reminder.id}`, { method: 'PUT', body: body() }) : api(`/vehicles/${vehicleId}/reminders`, { body: body() })), onClose, 'Reminder saved')
  const del = useSave(() => api(`/reminders/${reminder!.id}`, { method: 'DELETE' }), onClose, 'Reminder deleted')

  return (
    <FormScreen open={open} onClose={onClose} title={reminder ? 'Edit reminder' : 'New reminder'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={reminder ? () => confirm('Delete this reminder?') && del.mutate(undefined) : undefined} deleting={del.isPending}>
      <div className="space-y-4">
        {!reminder && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p.title} active={f.title === p.title}
                onClick={() => setF((o) => ({ ...o, title: p.title, mode: 'repeat', intervalKm: p.km?.toString() ?? '', intervalMonths: p.months?.toString() ?? '' }))}>
                {p.title}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Name"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Engine oil" /></Field>
        <Segmented value={f.mode} onChange={(v) => set('mode', v)} options={[{ value: 'repeat', label: 'Repeating' }, { value: 'once', label: 'One-time' }]} />
        {repeat ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Every (km)"><Input inputMode="numeric" value={f.intervalKm} onChange={(e) => set('intervalKm', e.target.value)} /></Field>
              <Field label="Every (months)"><Input inputMode="numeric" value={f.intervalMonths} onChange={(e) => set('intervalMonths', e.target.value)} /></Field>
            </div>
            <p className="-mt-2 text-xs text-stone-500">Due at whichever comes first.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last done (km)"><Input inputMode="decimal" value={f.lastDoneOdometer} onChange={(e) => set('lastDoneOdometer', e.target.value)} /></Field>
              <Field label="Last done on"><DateInput value={f.lastDoneOn} onChange={(v) => set('lastDoneOn', v)} allowEmpty placeholder="Date" /></Field>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due on"><DateInput value={f.dueOn} onChange={(v) => set('dueOn', v)} allowEmpty placeholder="Date" /></Field>
            <Field label="or at (km)"><Input inputMode="decimal" value={f.dueOdometer} onChange={(e) => set('dueOdometer', e.target.value)} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Remind me (days before)"><Input inputMode="numeric" value={f.notifyDaysBefore} onChange={(e) => set('notifyDaysBefore', e.target.value)} /></Field>
          <Field label="Remind me (km before)"><Input inputMode="numeric" value={f.notifyKmBefore} onChange={(e) => set('notifyKmBefore', e.target.value)} /></Field>
        </div>
        {reminder && <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Active" />}
        <ErrorText error={save.error ?? del.error} />
      </div>
    </FormScreen>
  )
}

// ---- documents --------------------------------------------------------------------------------------------

export function DocumentForm({ open, onClose, vehicles, vehicleId, doc }: { open: boolean; onClose: () => void; vehicles: Vehicle[]; vehicleId?: number | null; doc?: Doc }) {
  const [f, setF] = useState({
    vehicleId: doc ? doc.vehicleId : vehicleId ?? null,
    type: (doc?.type ?? 'INSURANCE') as DocType,
    title: doc?.title ?? '',
    number: doc?.number ?? '',
    provider: doc?.provider ?? '',
    issuedOn: doc?.issuedOn ?? '',
    expiresOn: doc?.expiresOn ?? '',
    remindDaysBefore: String(doc?.remindDaysBefore ?? 30),
    cost: doc?.cost?.toString() ?? '',
    notes: doc?.notes ?? '',
  })
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }))

  const save = useSave(async () => {
    const body = { ...f, title: f.title || null, issuedOn: f.issuedOn || null, expiresOn: f.expiresOn || null, remindDaysBefore: num(f.remindDaysBefore), cost: num(f.cost) }
    const saved = doc ? await api<Doc>(`/documents/${doc.id}`, { method: 'PUT', body }) : await api<Doc>('/documents', { body })
    if (file) {
      const form = new FormData()
      form.append('file', file)
      await api(`/documents/${saved.id}/file`, { method: 'PUT', form })
    }
  }, onClose, 'Saved')
  const del = useSave(() => api(`/documents/${doc!.id}`, { method: 'DELETE' }), onClose, 'Deleted')
  const renew = () => {
    // A renewal usually runs as long as the last one did.
    if (!f.issuedOn || !f.expiresOn) return
    const span = new Date(f.expiresOn).getTime() - new Date(f.issuedOn).getTime()
    const issued = new Date(f.expiresOn)
    issued.setDate(issued.getDate() + 1)
    setF((o) => ({ ...o, issuedOn: toLocalDate(issued), expiresOn: toLocalDate(new Date(issued.getTime() + span)) }))
  }
  const from = f.issuedOn || undefined

  return (
    <FormScreen open={open} onClose={onClose} title={doc ? doc.title : 'Add a paper'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={doc ? () => confirm('Delete this paper?') && del.mutate(undefined) : undefined} deleting={del.isPending}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={f.type} onChange={(e) => set('type', e.target.value as DocType)}>
              {(Object.keys(docLabel) as DocType[]).map((t) => <option key={t} value={t}>{docLabel[t]}</option>)}
            </Select>
          </Field>
          <Field label="For">
            <Select value={f.vehicleId ?? ''} onChange={(e) => set('vehicleId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Me</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Name"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={docLabel[f.type]} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number"><Input value={f.number} onChange={(e) => set('number', e.target.value)} /></Field>
          <Field label="Issued by"><Input value={f.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Insurer, RTO" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issued on"><DateInput value={f.issuedOn} onChange={(v) => set('issuedOn', v)} allowEmpty placeholder="Date" /></Field>
          <Field label="Valid until">
            <DateInput value={f.expiresOn} onChange={(v) => set('expiresOn', v)} allowEmpty placeholder="Date"
              presets={[
                { label: '+6 months', value: () => plusMonths(from, 6) },
                { label: '+1 year', value: () => plusMonths(from, 12) },
                { label: '+5 years', value: () => plusMonths(from, 60) },
              ]} />
          </Field>
        </div>
        {doc && f.issuedOn && f.expiresOn && <Button variant="secondary" className="w-full" onClick={renew}>Renewed? Move dates to the next term</Button>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Remind me (days before)"><Input inputMode="numeric" value={f.remindDaysBefore} onChange={(e) => set('remindDaysBefore', e.target.value)} /></Field>
          <Field label="Cost (₹)"><Input inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Paperclip size={16} /> {file ? file.name : doc?.fileOriginalName ? 'Replace file' : 'Attach a photo or PDF'}</Button>
          {doc?.fileOriginalName && !file && <a className="truncate text-sm text-sky-600 underline active:opacity-60" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">{doc.fileOriginalName}</a>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </FormScreen>
  )
}

// ---- expenses ---------------------------------------------------------------------------------------------

export function ExpenseForm({ open, onClose, vehicles, vehicleId, expense, suggestion }: {
  open: boolean; onClose: () => void; vehicles: Vehicle[]; vehicleId?: number; expense?: Expense; suggestion?: Suggestion
}) {
  const [f, setF] = useState({
    vehicleId: expense?.vehicleId ?? vehicleId ?? suggestion?.suggestedVehicleId ?? vehicles.find((v) => v.isDefault)?.id ?? vehicles[0]?.id,
    spentOn: expense?.spentOn ?? (suggestion ? toLocalDate(new Date(suggestion.occurredAt)) : today()),
    category: (expense?.category ?? 'ACCESSORY') as ExpenseCategory,
    title: expense?.title ?? suggestion?.payee ?? '',
    amount: expense?.amount?.toString() ?? suggestion?.amount?.toString() ?? '',
    odometer: expense?.odometer?.toString() ?? '',
    vendor: expense?.vendor ?? suggestion?.payee ?? '',
    notes: expense?.notes ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }))
  const body = () => ({ ...f, amount: num(f.amount), odometer: num(f.odometer) })
  const save = useSave(() => {
    if (suggestion) return api(`/suggestions/${suggestion.id}/expense`, { body: body() })
    if (expense) return api(`/expenses/${expense.id}`, { method: 'PUT', body: body() })
    return api(`/vehicles/${f.vehicleId}/expenses`, { body: body() })
  }, onClose, 'Expense saved')
  const del = useSave(() => api(`/expenses/${expense!.id}`, { method: 'DELETE' }), onClose, 'Expense deleted')

  return (
    <FormScreen open={open} onClose={onClose} title={suggestion ? 'Add as expense' : expense ? 'Edit expense' : 'Add expense'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={expense ? () => confirm('Delete this expense?') && del.mutate(undefined) : undefined} deleting={del.isPending}>
      <div className="space-y-4">
        {(suggestion || vehicles.length > 1) && !expense && (
          <Field label="Vehicle">
            <Select value={f.vehicleId ?? ''} onChange={(e) => set('vehicleId', Number(e.target.value))}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="What"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Crash guard, helmet, new tyres" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Category">
            <Select value={f.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
              {(Object.keys(expenseLabel) as ExpenseCategory[]).map((c) => <option key={c} value={c}>{expenseLabel[c]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><DateInput value={f.spentOn} onChange={(v) => set('spentOn', v)} /></Field>
          <Field label="Odometer (km)"><Input inputMode="decimal" value={f.odometer} onChange={(e) => set('odometer', e.target.value)} placeholder="Optional" /></Field>
        </div>
        <Field label="Shop"><Input value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
        <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </FormScreen>
  )
}

// ---- odometer ---------------------------------------------------------------------------------------------

export function OdometerForm({ open, onClose, vehicleId, current }: { open: boolean; onClose: () => void; vehicleId: number; current?: number | null }) {
  const [when, setWhen] = useState(toLocalInput())
  const [value, setValue] = useState('')
  const save = useSave(() => api(`/vehicles/${vehicleId}/odometer`, { body: { readAt: fromLocalInput(when), odometer: num(value) } }), onClose, 'Reading saved')
  return (
    <FormScreen open={open} onClose={onClose} title="Odometer reading" onSave={() => save.mutate(undefined)} saving={save.isPending}>
      <div className="space-y-4">
        <Field label="Reading (km)" hint={current ? `Last reading ${km(current)}` : undefined}><Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></Field>
        <Field label="When"><DateTimeInput value={when} onChange={setWhen} /></Field>
        <ErrorText error={save.error} />
        <OdometerHistory vehicleId={vehicleId} />
      </div>
    </FormScreen>
  )
}

const READING_FROM: Record<OdometerReading['source'], string> = {
  PURCHASE: 'At purchase', FUEL: 'Fill-up', SERVICE: 'Service', EXPENSE: 'Expense', MANUAL: 'Entered by hand',
}

/** Every reading the vehicle has, newest first. Only the ones entered here can be removed; the rest belong to their fill-up, service or expense. */
function OdometerHistory({ vehicleId }: { vehicleId: number }) {
  const rows = useQuery({ queryKey: ['odometer', vehicleId], queryFn: () => api<OdometerReading[]>(`/vehicles/${vehicleId}/odometer`) })
  const remove = useSave((id: number) => api(`/odometer/${id}`, { method: 'DELETE' }), undefined, 'Reading removed')
  if (!rows.data?.length) return null
  return (
    <section className="space-y-2 pt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">History</h3>
      <div className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">
        {rows.data.map((r, i) => (
          <div key={`${r.source}${r.id ?? ''}${r.at}${i}`} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="num font-medium">{km(r.odometer)}</div>
              <div className="num truncate text-[13px] text-stone-500">{r.source === 'FUEL' || r.source === 'MANUAL' ? dateTime(r.at) : date(r.at)} · {READING_FROM[r.source]}</div>
            </div>
            {r.id != null && (
              <Button type="button" variant="ghost" className="shrink-0 !px-2.5 !py-1 text-xs" busy={remove.isPending && remove.variables === r.id}
                onClick={() => remove.mutate(r.id!)}>Remove</Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
