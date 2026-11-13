import { Camera, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type FuelType, type Kind, type Vehicle } from '../api'
import { fuelLabel, kindLabel, num } from '../format'
import { shrinkImage, useSave } from '../hooks'
import { DateInput } from './DateField'
import { Button, ErrorText, Field, FormScreen, Input, Segmented, Select, TextArea, Toggle } from './ui'
import { KindIcon, VehicleArt } from './VehicleArt'

export function VehicleForm({ open, onClose, vehicle }: { open: boolean; onClose: () => void; vehicle?: Vehicle }) {
  const nav = useNavigate()
  const [f, setF] = useState(() => ({
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
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }))

  const save = useSave(
    async () => {
      const body = {
        ...f,
        year: num(f.year),
        tankCapacity: num(f.tankCapacity),
        purchaseOdometer: num(f.purchaseOdometer),
        purchasePrice: num(f.purchasePrice),
        purchaseDate: f.purchaseDate || null,
      }
      const saved = vehicle ? await api<Vehicle>(`/vehicles/${vehicle.id}`, { method: 'PUT', body }) : await api<Vehicle>('/vehicles', { body })
      if (photo) {
        const form = new FormData()
        form.append('file', photo, 'photo.jpg')
        await api(`/vehicles/${saved.id}/image`, { method: 'PUT', form })
      }
      return saved
    },
    (saved) => {
      onClose()
      if (!vehicle) nav(`/vehicles/${saved.id}`)
    },
    vehicle ? 'Saved' : (v) => `${v.name} added`,
  )
  const removePhoto = useSave(() => api(`/vehicles/${vehicle!.id}/image`, { method: 'DELETE' }), undefined, 'Photo removed')
  const del = useSave(() => api(`/vehicles/${vehicle!.id}`, { method: 'DELETE' }), () => {
    onClose()
    nav('/')
  }, 'Vehicle deleted')

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
      onDelete={vehicle ? () => confirm(`Delete ${vehicle.name} and all its records? This can't be undone.`) && del.mutate(undefined) : undefined}
      deleting={del.isPending}
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
              <KindIcon kind={f.kind} size={64} />
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
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Duke, Activa, Creta" autoFocus={!vehicle} />
        </Field>
        <Segmented
          value={f.kind}
          onChange={(k) => set('kind', k)}
          options={(['MOTORCYCLE', 'SCOOTER', 'CAR', 'OTHER'] as Kind[]).map((k) => ({ value: k, label: kindLabel[k] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuel">
            <Select value={f.fuelType} onChange={(e) => set('fuelType', e.target.value as FuelType)}>
              {(Object.keys(fuelLabel) as FuelType[]).map((t) => <option key={t} value={t}>{fuelLabel[t]}</option>)}
            </Select>
          </Field>
          <Field label="Registration">
            <Input value={f.registration} onChange={(e) => set('registration', e.target.value)} placeholder="KA 01 AB 1234" autoCapitalize="characters" />
          </Field>
          <Field label="Make"><Input value={f.make} onChange={(e) => set('make', e.target.value)} placeholder="KTM" /></Field>
          <Field label="Model"><Input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="390 Duke" /></Field>
          <Field label="Year"><Input inputMode="numeric" value={f.year} onChange={(e) => set('year', e.target.value)} /></Field>
          <Field label="Colour"><Input value={f.color} onChange={(e) => set('color', e.target.value)} /></Field>
          <Field label={`Tank (${f.fuelType === 'ELECTRIC' ? 'kWh' : f.fuelType === 'CNG' ? 'kg' : 'L'})`}>
            <Input inputMode="decimal" value={f.tankCapacity} onChange={(e) => set('tankCapacity', e.target.value)} />
          </Field>
          <Field label="Odometer at purchase"><Input inputMode="decimal" value={f.purchaseOdometer} onChange={(e) => set('purchaseOdometer', e.target.value)} placeholder="km" /></Field>
          <Field label="Purchase price (₹)"><Input inputMode="decimal" value={f.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} /></Field>
          <Field label="Purchase date" className="col-span-2"><DateInput value={f.purchaseDate} onChange={(v) => set('purchaseDate', v)} allowEmpty placeholder="Optional" /></Field>
        </div>
        <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Toggle checked={f.isDefault} onChange={(v) => set('isDefault', v)} label="My usual ride" hint="Suggested first for new trips and fill-ups." />
        {vehicle && <Toggle checked={f.archived} onChange={(v) => set('archived', v)} label="Sold or retired" hint="Its history stays; it's left out of new entries." />}
        <ErrorText error={save.error ?? removePhoto.error ?? del.error} />
      </div>
    </FormScreen>
  )
}
