import { Paperclip } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { docLabel, num, today, toLocalDate } from '@/lib/format'
import { type Doc, type DocType, type Vehicle } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Button, DateInput, ErrorText, Field, FormScreen, Input, plusMonths, Select, TextArea } from '@/ui'
import { refresh } from '@/lib/queries'

/**
 * The next term of a paper: it starts the day after the old one ends (or today, if that's already past) and runs as
 * long as the last term did, or a year when that isn't known.
 */
export function nextTerm(issuedOn?: string | null, expiresOn?: string | null): { issuedOn: string; expiresOn: string } {
  const day = 86_400_000
  const todayStart = new Date(today() + 'T00:00:00')
  const after = expiresOn ? new Date(new Date(expiresOn + 'T00:00:00').getTime() + day) : todayStart
  const start = after < todayStart ? todayStart : after
  if (issuedOn && expiresOn) {
    const span = new Date(expiresOn + 'T00:00:00').getTime() - new Date(issuedOn + 'T00:00:00').getTime()
    if (span > 0) return { issuedOn: toLocalDate(start), expiresOn: toLocalDate(new Date(start.getTime() + span)) }
  }
  return { issuedOn: toLocalDate(start), expiresOn: plusMonths(toLocalDate(new Date(start.getTime() - day)), 12) }
}

export function DocumentForm({ open, onClose, vehicles, vehicleId, doc, renewing = false }: { open: boolean; onClose: () => void; vehicles: Vehicle[]; vehicleId?: number | null; doc?: Doc; renewing?: boolean }) {
  // Renewing: the same paper with its dates moved to the next term, asking for the new certificate.
  const term = renewing && doc ? nextTerm(doc.issuedOn, doc.expiresOn) : null
  const [f, setF] = useState({
    vehicleId: doc ? doc.vehicleId : vehicleId ?? null,
    type: (doc?.type ?? 'INSURANCE') as DocType,
    title: doc?.title ?? '',
    number: doc?.number ?? '',
    provider: doc?.provider ?? '',
    issuedOn: term?.issuedOn ?? doc?.issuedOn ?? '',
    expiresOn: term?.expiresOn ?? doc?.expiresOn ?? '',
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
  }, { refresh: refresh.papers, onDone: onClose, done: renewing ? 'Renewed. Reminders start over for the new date.' : 'Saved' })
  const renew = () => setF((o) => ({ ...o, ...nextTerm(o.issuedOn || null, o.expiresOn || null) }))
  const from = f.issuedOn || undefined

  return (
    <FormScreen open={open} onClose={onClose} title={renewing && doc ? `Renew ${doc.title}` : doc ? doc.title : 'Add a paper'} onSave={() => save.mutate(undefined)} saving={save.isPending}
      saveLabel={renewing ? 'Save renewal' : 'Save'}
      onDelete={doc && !renewing ? () => { deleteWithUndo({ refresh: refresh.papers, text: 'Paper deleted', what: 'the paper', hide: `doc:${doc.id}`, run: () => api(`/documents/${doc.id}`, { method: 'DELETE' }) }); onClose() } : undefined}>
      <div className="space-y-4">
        {renewing && (
          <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-stone-700 dark:text-stone-200">
            The dates are moved to the next term. Check them, update the number if it changed, and attach the new certificate.
          </p>
        )}
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
        {doc && !renewing && f.expiresOn && <Button variant="secondary" className="w-full" onClick={renew}>Renewed? Move dates to the next term</Button>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Remind me (days before)"><Input inputMode="numeric" value={f.remindDaysBefore} onChange={(e) => set('remindDaysBefore', e.target.value)} /></Field>
          <Field label="Cost (₹)"><Input inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Paperclip size={16} /> {file ? file.name : renewing ? 'Attach the new certificate' : doc?.fileOriginalName ? 'Replace file' : 'Attach a photo or PDF'}</Button>
          {doc?.fileOriginalName && !file && <a className="truncate text-sm text-sky-600 underline active:opacity-60" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">{doc.fileOriginalName}</a>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <ErrorText error={save.error} />
      </div>
    </FormScreen>
  )
}
