import { Camera, DownloadSimple, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { fuelLabel, kindLabel, num } from '@/lib/format'
import { shrinkImage } from '@/lib/images'
import { type FuelType, type Kind, type Vehicle } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { KindIcon, VehicleArt } from './VehicleArt'
import { Button, buttonStyle, DateInput, ErrorText, Field, FormScreen, Input, Segmented, Select, TextArea, Toggle } from '@/ui'
import { refresh } from '@/lib/queries'
import { exportUrl } from '@/features/data/exports'

export function VehicleForm({ open, onClose, vehicle }: { open: boolean; onClose: () => void; vehicle?: Vehicle }) {
  const nav = useNavigate()
  const [form, setForm] = useState(() => ({
    name: vehicle?.name ?? '',
    kind: (vehicle?.kind ?? 'MOTORCYCLE') as Kind,
    fuelType: (vehicle?.fuelType ?? 'PETROL') as FuelType,
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year?.toString() ?? '',
    registration: vehicle?.registration ?? '',
    color: vehicle?.color ?? '',
    tankCapacity: vehicle?.tankCapacity?.toString() ?? '',
    purchaseDate: vehicle?.purchaseDate ?? '',
    purchaseOdometer: vehicle?.purchaseOdometer?.toString() ?? '',
    purchasePrice: vehicle?.purchasePrice?.toString() ?? '',
    isDefault: vehicle?.isDefault ?? false,
    archived: vehicle?.archived ?? false,
    notes: vehicle?.notes ?? '',
  }))
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((o) => ({ ...o, [k]: v }))

  const save = useSave(async () => {
      const body = {
        ...form,
        year: num(form.year),
        tankCapacity: num(form.tankCapacity),
        purchaseOdometer: num(form.purchaseOdometer),
        purchasePrice: num(form.purchasePrice),
        purchaseDate: form.purchaseDate || null,
      }
      const saved = vehicle ? await api<Vehicle>(`/vehicles/${vehicle.id}`, { method: 'PUT', body }) : await api<Vehicle>('/vehicles', { body })
      if (photo) {
        const form = new FormData()
        form.append('file', photo, 'photo.jpg')
        await api(`/vehicles/${saved.id}/image`, { method: 'PUT', form })
      }
      return saved
    }, { refresh: refresh.vehicles, onDone: (saved) => {
      onClose()
      if (!vehicle) nav(`/vehicles/${saved.id}`)
    }, done: vehicle ? 'Saved' : (v) => `${v.name} added` })
  const removePhoto = useSave(() => api(`/vehicles/${vehicle!.id}/image`, { method: 'DELETE' }), { refresh: refresh.vehicles, done: 'Photo removed' })

  const pick = async (file?: File) => {
    if (!file) return
    const small = await shrinkImage(file)
    setPhoto(small)
    setPreview(URL.createObjectURL(small))
  }

  return (
    <FormScreen
      open={open}
      onClose={onClose}
      title={vehicle ? 'Edit vehicle' : 'Add a vehicle'}
      onSave={() => save.mutate(undefined)}
      saving={save.isPending}
      saveLabel={vehicle ? 'Save' : 'Add'}
      onDelete={vehicle ? () => {
        // everything about it goes too, so the Undo is the safety net
        deleteWithUndo({ refresh: refresh.vehicles, text: `${vehicle.name} deleted with all its records`, what: vehicle.name, hide: `vehicle:${vehicle.id}`, run: () => api(`/vehicles/${vehicle.id}`, { method: 'DELETE' }) })
        onClose()
        nav('/')
      } : undefined}
      deleteLabel="Delete vehicle"
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl">
          {preview ? (
            <img src={preview} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : vehicle ? (
            <VehicleArt vehicle={vehicle} className="aspect-[16/9] w-full" />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800">
              <KindIcon kind={form.kind} size={64} />
            </div>
          )}
          <div className="absolute right-2 bottom-2 flex gap-2">
            {vehicle?.imageFile && !preview && (
              <Button variant="secondary" className="!px-3 shadow" busy={removePhoto.isPending} onClick={() => removePhoto.mutate(undefined)} aria-label="Remove photo">
                <Trash size={16} />
              </Button>
            )}
            <Button variant="secondary" className="shadow" onClick={() => fileRef.current?.click()}>
              <Camera size={16} /> {vehicle?.imageFile || preview ? 'Change photo' : 'Add photo'}
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Duke, Activa, Creta" autoFocus={!vehicle} />
        </Field>
        <Segmented
          value={form.kind}
          onChange={(kind) => set('kind', kind)}
          options={(['MOTORCYCLE', 'SCOOTER', 'CAR', 'OTHER'] as Kind[]).map((kind) => ({ value: kind, label: kindLabel[kind] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuel">
            <Select value={form.fuelType} onChange={(e) => set('fuelType', e.target.value as FuelType)}>
              {(Object.keys(fuelLabel) as FuelType[]).map((fuelType) => <option key={fuelType} value={fuelType}>{fuelLabel[fuelType]}</option>)}
            </Select>
          </Field>
          <Field label="Registration">
            <Input value={form.registration} onChange={(e) => set('registration', e.target.value)} placeholder="KA 01 AB 1234" autoCapitalize="characters" />
          </Field>
          <Field label="Make"><Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="KTM" /></Field>
          <Field label="Model"><Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="390 Duke" /></Field>
          <Field label="Year"><Input inputMode="numeric" value={form.year} onChange={(e) => set('year', e.target.value)} /></Field>
          <Field label="Colour"><Input value={form.color} onChange={(e) => set('color', e.target.value)} /></Field>
          <Field label={`Tank (${form.fuelType === 'ELECTRIC' ? 'kWh' : form.fuelType === 'CNG' ? 'kg' : 'L'})`}>
            <Input inputMode="decimal" value={form.tankCapacity} onChange={(e) => set('tankCapacity', e.target.value)} />
          </Field>
          <Field label="Odometer at purchase"><Input inputMode="decimal" value={form.purchaseOdometer} onChange={(e) => set('purchaseOdometer', e.target.value)} placeholder="km" /></Field>
          <Field label="Purchase price (₹)"><Input inputMode="decimal" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} /></Field>
          <Field label="Purchase date" className="col-span-2"><DateInput value={form.purchaseDate} onChange={(v) => set('purchaseDate', v)} allowEmpty placeholder="Optional" /></Field>
        </div>
        <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Toggle checked={form.isDefault} onChange={(v) => set('isDefault', v)} label="My usual ride" hint="Suggested first for new trips and fill-ups." />
        {vehicle && <Toggle checked={form.archived} onChange={(v) => set('archived', v)} label="Sold or retired" hint="Its history stays; it's left out of new entries." />}
        {vehicle && (
          <a href={exportUrl('all', vehicle.id)} download className={buttonStyle('secondary', 'w-full')}>
            <DownloadSimple size={16} /> Export this vehicle's records
          </a>
        )}
        <ErrorText error={save.error ?? removePhoto.error} />
      </div>
    </FormScreen>
  )
}
