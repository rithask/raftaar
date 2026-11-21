import { useState } from 'react'
import { api } from '@/lib/api'
import { expenseLabel, num, today, toLocalDate } from '@/lib/format'
import { type Expense, type ExpenseCategory, type Suggestion, type Vehicle } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { DateInput, ErrorText, Field, FormScreen, Input, Select, TextArea } from '@/ui'
import { refresh } from '@/lib/queries'

export function ExpenseForm({ open, onClose, vehicles, vehicleId, expense, suggestion }: {
  open: boolean; onClose: () => void; vehicles: Vehicle[]; vehicleId?: number; expense?: Expense; suggestion?: Suggestion
}) {
  const [form, setForm] = useState({
    vehicleId: expense?.vehicleId ?? vehicleId ?? suggestion?.suggestedVehicleId ?? vehicles.find((vehicle) => vehicle.isDefault)?.id ?? vehicles[0]?.id,
    spentOn: expense?.spentOn ?? (suggestion ? toLocalDate(new Date(suggestion.occurredAt)) : today()),
    category: (expense?.category ?? 'ACCESSORY') as ExpenseCategory,
    title: expense?.title ?? suggestion?.payee ?? '',
    amount: expense?.amount?.toString() ?? suggestion?.amount?.toString() ?? '',
    odometer: expense?.odometer?.toString() ?? '',
    vendor: expense?.vendor ?? suggestion?.payee ?? '',
    notes: expense?.notes ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((o) => ({ ...o, [k]: v }))
  const body = () => ({ ...form, amount: num(form.amount), odometer: num(form.odometer) })
  const save = useSave(() => {
    if (suggestion) return api(`/suggestions/${suggestion.id}/expense`, { body: body() })
    if (expense) return api(`/expenses/${expense.id}`, { method: 'PUT', body: body() })
    return api(`/vehicles/${form.vehicleId}/expenses`, { body: body() })
  }, { refresh: refresh.vehicleRecords, onDone: onClose, done: 'Expense saved' })

  return (
    <FormScreen open={open} onClose={onClose} title={suggestion ? 'Add as expense' : expense ? 'Edit expense' : 'Add expense'} onSave={() => save.mutate(undefined)} saving={save.isPending} onDelete={expense ? () => { deleteWithUndo({ refresh: refresh.vehicleRecords, text: 'Expense deleted', what: 'the expense', hide: `expense:${expense.id}`, run: () => api(`/expenses/${expense.id}`, { method: 'DELETE' }) }); onClose() } : undefined}>
      <div className="space-y-4">
        {(suggestion || vehicles.length > 1) && !expense && (
          <Field label="Vehicle">
            <Select value={form.vehicleId ?? ''} onChange={(e) => set('vehicleId', Number(e.target.value))}>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="What"><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Crash guard, helmet, new tyres" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
              {(Object.keys(expenseLabel) as ExpenseCategory[]).map((category) => <option key={category} value={category}>{expenseLabel[category]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><DateInput value={form.spentOn} onChange={(v) => set('spentOn', v)} /></Field>
          <Field label="Odometer (km)"><Input inputMode="decimal" value={form.odometer} onChange={(e) => set('odometer', e.target.value)} placeholder="Optional" /></Field>
        </div>
        <Field label="Shop"><Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
        <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <ErrorText error={save.error} />
      </div>
    </FormScreen>
  )
}
