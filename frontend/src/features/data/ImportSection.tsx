import { ClockCounterClockwise, FileArrowUp, Trash, Warning } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { ago, date } from '@/lib/format'
import { refresh, useImports, useVehicles } from '@/lib/queries'
import { type ImportPreview, type ImportResult, type RecordCounts } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Button, Card, ErrorText, Field, IconBadge, List, RowText, Section, Select, softSpring } from '@/ui'

const SOURCE: Record<ImportPreview['source'], string> = { RAFTAAR: 'Raftaar export', FUELIO: 'Fuelio backup', OTHER: 'CSV from another app' }
/** The vehicle choice for "make a new one from the file". */
const NEW = 'new'

/**
 * Importing records from a file: Raftaar's own export, Fuelio's backup, or another app's CSV (Drivvo and the like).
 * Picking a file shows what's in it, which of your vehicles each of its vehicles goes to (a match is chosen for
 * you; or a new one), and what's already here and will be left out. Nothing is saved until Import. Each import is
 * listed below it and can be removed whole.
 */
export function ImportSection() {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const vehicles = useVehicles()

  const preview = useSave((chosen: File) => api<ImportPreview>('/import/preview', { form: withFile(chosen) }), {
    refresh: [],
    onDone: (found) => setChoices(Object.fromEntries(found.vehicles.map((v) => [v.name, v.match != null ? String(v.match) : NEW]))),
  })
  const run = useSave(() => {
    const form = withFile(file!)
    form.append('vehicles', JSON.stringify(Object.fromEntries(Object.entries(choices).map(([name, choice]) => [name, choice === NEW ? null : Number(choice)]))))
    return api<ImportResult>('/import', { form })
  }, {
    refresh: refresh.imported,
    onDone: () => reset(),
    done: (result) => `Imported ${countsText(result.added)}`,
    undo: (result) => api(`/imports/${result.batchId}`, { method: 'DELETE' }),
  })

  const reset = () => {
    setFile(null)
    preview.reset()
    if (input.current) input.current.value = ''
  }
  const choose = (chosen: File | undefined) => {
    if (!chosen) return
    setFile(chosen)
    preview.mutate(chosen)
  }
  const found = preview.data

  return (
    <Section title="Import" meta="From Raftaar, Fuelio or another app's CSV">
      <input ref={input} type="file" accept=".csv,.zip,text/csv,application/zip" className="sr-only" aria-label="File to import"
        onChange={(e) => choose(e.target.files?.[0])} />
      {!file && (
        <Button className="w-full" onClick={() => input.current?.click()}><FileArrowUp size={16} /> Choose a file</Button>
      )}
      <ErrorText error={preview.error ?? run.error} />
      <AnimatePresence initial={false}>
        {file && (
          // below the exports on a phone: brought into view as it opens
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}
            ref={intoView}>
            <Card padded className="space-y-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{file.name}</div>
                <div className="text-sm text-stone-500">
                  {preview.isPending ? 'Reading…' : found ? [SOURCE[found.source], found.from && found.to ? `${date(found.from)} to ${date(found.to)}` : null].filter(Boolean).join(' · ') : ''}
                </div>
              </div>
              {found && <PreviewDetails found={found} choices={choices} onChoose={(name, choice) => setChoices((current) => ({ ...current, [name]: choice }))}
                vehicles={vehicles.data ?? []} />}
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" disabled={!found || total(found.adding) === 0} busy={run.isPending} onClick={() => run.mutate(undefined)}>
                  {found && total(found.adding) === 0 ? 'Nothing new to import' : 'Import'}
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <PastImports />
    </Section>
  )
}

function PreviewDetails({ found, choices, onChoose, vehicles }: {
  found: ImportPreview; choices: Record<string, string>; onChoose: (name: string, choice: string) => void; vehicles: { id: number; name: string }[]
}) {
  const left = total(found.duplicates)
  return (
    <>
      <div className="text-sm">
        <div><b>Adding</b> {total(found.adding) ? countsText(found.adding) : 'nothing new'}</div>
        {left > 0 && <div className="text-stone-500">{countsText(found.duplicates)} already here, left out</div>}
      </div>
      {found.vehicles.length > 0 && (
        <div className="space-y-3">
          {found.vehicles.map((v) => (
            <Field key={v.name} label={`“${v.name}” (${v.records} record${v.records === 1 ? '' : 's'}) goes to`}>
              <Select value={choices[v.name] ?? NEW} onChange={(e) => onChoose(v.name, e.target.value)}>
                <option value={NEW}>A new vehicle, “{v.name}”</option>
                {vehicles.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
              </Select>
            </Field>
          ))}
        </div>
      )}
      {found.source === 'OTHER' && (
        <p className="text-xs text-stone-500">Read by its column names. Check a few records after importing; you can remove the import if they're wrong.</p>
      )}
      {found.skipped.length > 0 && (
        <details className="text-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Warning size={16} /> {found.skipped.length} row{found.skipped.length === 1 ? '' : 's'} couldn't be read
          </summary>
          <ul className="mt-2 space-y-0.5 text-xs text-stone-500">
            {found.skipped.slice(0, 20).map((reason) => <li key={reason}>{reason}</li>)}
            {found.skipped.length > 20 && <li>…and {found.skipped.length - 20} more</li>}
          </ul>
        </details>
      )}
    </>
  )
}

/** Each import so far, newest first, with Remove (which takes out exactly what it added). */
function PastImports() {
  const imports = useImports()
  const hidden = useHidden()
  const list = (imports.data ?? []).filter((batch) => !hidden(`import:${batch.id}`))
  if (!list.length) return null
  return (
    <List label="Past imports">
      {list.map((batch) => (
        <div key={batch.id} className="flex items-center gap-3 py-3 pr-2 pl-4">
          <IconBadge tone="neutral" square><ClockCounterClockwise size={18} /></IconBadge>
          <RowText title={batch.summary ?? 'Import'}>{[batch.fileName, ago(batch.createdAt)].filter(Boolean).join(' · ')}</RowText>
          <Button variant="ghost" className="shrink-0 !px-2.5 !py-1.5 text-xs" aria-label={`Remove the import of ${batch.fileName ?? 'a file'}`}
            onClick={() => deleteWithUndo({ text: 'Import removed', what: 'the import', hide: `import:${batch.id}`, refresh: refresh.imported,
              run: () => api(`/imports/${batch.id}`, { method: 'DELETE' }) })}>
            <Trash size={14} /> Remove
          </Button>
        </div>
      ))}
    </List>
  )
}

/** Scrolls an element into view as it appears (a ref callback, defined once so it isn't run again on each render). */
const intoView = (element: HTMLElement | null) => element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

const withFile = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return form
}

const total = (counts: RecordCounts) => counts.fuel + counts.services + counts.expenses + counts.odometer + counts.papers + counts.reminders

const KINDS: [keyof RecordCounts, string, string][] = [
  ['fuel', 'fill-up', 'fill-ups'], ['services', 'service', 'services'], ['expenses', 'expense', 'expenses'],
  ['odometer', 'odometer reading', 'odometer readings'], ['papers', 'paper', 'papers'], ['reminders', 'reminder', 'reminders'],
  ['vehicles', 'new vehicle', 'new vehicles'],
]

/** "2 fill-ups, 1 service, 1 new vehicle". */
export const countsText = (counts: RecordCounts) =>
  KINDS.filter(([kind]) => counts[kind] > 0).map(([kind, one, many]) => `${counts[kind].toLocaleString('en-IN')} ${counts[kind] === 1 ? one : many}`).join(', ') || 'nothing'
