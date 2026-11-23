import { MapPin, Plus } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { fromLocalInput, fuelUnit, km, money2, num, toLocalInput } from '@/lib/format'
import { queueFill, unreachable } from '@/lib/outbox'
import { INDIAN_STATES } from '@/lib/states'
import { type FuelEntry, type Quote, type Suggestion, type Vehicle } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { inboxRequests } from '@/features/inbox/inboxRequests'
import { Badge, Button, DateTimeInput, ErrorText, Field, FormScreen, Input, Select, TextArea, Toggle } from '@/ui'
import { refresh } from '@/lib/queries'

type Key = 'volume' | 'price' | 'total'

/**
 * Price, volume and total: type any two and the third is worked out. The one you touched longest ago is the one
 * that gets calculated, so you can start from whichever two the pump or receipt shows.
 */
export function FuelForm({
  open,
  onClose,
  vehicles,
  vehicleId,
  entry,
  suggestion,
  estimatedOdometer,
  lastOdometer,
}: {
  open: boolean
  onClose: () => void
  vehicles: Vehicle[]
  vehicleId?: number
  entry?: FuelEntry
  suggestion?: Suggestion
  estimatedOdometer?: number | null
  lastOdometer?: number | null
}) {
  const initialVehicle = entry?.vehicleId ?? vehicleId ?? suggestion?.suggestedVehicleId ?? vehicles.find((candidate) => candidate.isDefault)?.id ?? vehicles[0]?.id
  const [vid, setVid] = useState<number | undefined>(initialVehicle)
  const vehicle = vehicles.find((candidate) => candidate.id === vid)
  const unit = vehicle ? fuelUnit[vehicle.fuelType] : 'L'

  const [when, setWhen] = useState(toLocalInput(entry?.filledAt ?? suggestion?.occurredAt))
  const [odometer, setOdometer] = useState(entry?.odometer?.toString() ?? '')
  const [vals, setVals] = useState<Record<Key, string>>({
    volume: entry?.volume?.toString() ?? '',
    price: entry?.pricePerUnit?.toString() ?? suggestion?.suggestedPrice?.toString() ?? '',
    total: entry?.totalCost?.toString() ?? suggestion?.amount?.toString() ?? '',
  })
  // Fields that were given a value, oldest first. Pre-filled values (last price, a Hisaab amount) count as
  // the oldest, so anything you type wins over them.
  const [order, setOrder] = useState<Key[]>(() => {
    if (entry) return ['price', 'volume', 'total']
    return (['price', 'total'] as Key[]).filter((k) => (k === 'price' ? suggestion?.suggestedPrice : suggestion?.amount) != null)
  })
  // Editing a saved fill-up: keep its three numbers exactly as they were until you change one.
  const [touched, setTouched] = useState(!entry)
  const [fullTank, setFullTank] = useState(entry?.fullTank ?? true)
  const [missed, setMissed] = useState(entry?.missedPrevious ?? false)
  const [station, setStation] = useState(entry?.stationName ?? suggestion?.stationName ?? '')
  const [region, setRegion] = useState(entry?.region ?? suggestion?.region ?? '')
  const [district, setDistrict] = useState(entry?.district ?? suggestion?.district ?? '')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    entry?.latitude != null ? { lat: entry.latitude, lon: entry.longitude! } : suggestion?.latitude != null ? { lat: suggestion.latitude, lon: suggestion.longitude! } : null,
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  // Kept out of the way until wanted; open by themselves when they already have something in them.
  const [more, setMore] = useState(() => !!(entry?.missedPrevious || entry?.stationName || entry?.region || entry?.notes || suggestion?.stationName))
  const [pickVehicle, setPickVehicle] = useState(!vehicleId || !!suggestion)
  const [pickWhen, setPickWhen] = useState(!!entry || !!suggestion)

  /**
   * The value that's worked out: the one that isn't among the two most recently filled-in fields. Empty fields
   * never count, so with a price already there, typing the amount paid works out the litres.
   */
  const derived = useMemo<Key | null>(() => {
    if (!touched) return null
    const filled = order.filter((k) => vals[k].trim() !== '' && num(vals[k]) !== null)
    if (filled.length < 2) return null
    const sources = filled.slice(-2)
    return (['price', 'volume', 'total'] as Key[]).find((k) => !sources.includes(k)) ?? null
  }, [order, vals, touched])
  const computed = useMemo(() => {
    const volume = num(vals.volume), price = num(vals.price), total = num(vals.total)
    if (derived === 'total' && volume && price) return (volume * price).toFixed(2)
    if (derived === 'volume' && total && price) return (total / price).toFixed(3)
    if (derived === 'price' && total && volume) return (total / volume).toFixed(2)
    return ''
  }, [vals, derived])
  const shown = (k: Key) => (k === derived ? computed : vals[k])
  const edit = (k: Key, value: string) => {
    // Typing over a worked-out value starts from what it showed, not from an old typed value.
    setVals((o) => ({ ...o, [k]: value }))
    setOrder((o) => (o[o.length - 1] === k ? o : [...o.filter((x) => x !== k), k]))
    setTouched(true)
  }
  /** A price that arrived on its own (last fill-up, your location): fill it in as the oldest value. */
  const prefillPrice = (price: number) => {
    setVals((o) => ({ ...o, price: String(price) }))
    setOrder((o) => (o.includes('price') ? o : ['price', ...o]))
  }

  // Price where the vehicle last filled up, unless one is already known.
  const lastRegion = region || undefined
  const quote = useQuery({
    queryKey: ['quote', vid, lastRegion, district],
    queryFn: () => api<Quote>(`/fuel-prices/quote?${new URLSearchParams({ ...(vid ? { vehicleId: String(vid) } : {}), ...(vehicle ? { fuelType: vehicle.fuelType } : {}), ...(lastRegion ? { region: lastRegion } : {}), ...(district ? { district } : {}) })}`),
    enabled: open && !!vid && !entry,
  })
  useEffect(() => {
    if (quote.data?.quote && !vals.price) prefillPrice(quote.data.quote.price)
  }, [quote.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) return setLocError("This browser can't share your location")
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude
        setCoords({ lat, lon })
        try {
          const q = await api<Quote>(`/fuel-prices/quote?lat=${lat}&lon=${lon}${vid ? `&vehicleId=${vid}` : ''}${vehicle ? `&fuelType=${vehicle.fuelType}` : ''}`)
          if (q.region) setRegion(q.region)
          if (q.district) setDistrict(q.district)
          if (q.quote) {
            if (derived !== 'price') prefillPrice(q.quote.price)
          } else if (!q.region) setLocError("Couldn't tell which state you're in. Pick it below.")
        } catch (e) {
          setLocError(e instanceof Error ? e.message : 'Lookup failed')
        } finally {
          setLocating(false)
        }
      },
      (e) => {
        setLocating(false)
        setLocError(e.code === 1 ? 'Location access is blocked for this site' : "Couldn't get your location")
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const body = () => {
    const volume = num(shown('volume')), price = num(shown('price')), total = num(shown('total'))
    return {
      vehicleId: vid,
      filledAt: fromLocalInput(when),
      odometer: num(odometer),
      // send the two you typed; the server works out the third the same way
      volume: derived === 'volume' ? null : volume,
      pricePerUnit: derived === 'price' ? null : price,
      totalCost: derived === 'total' ? null : total,
      fullTank,
      missedPrevious: missed,
      stationName: station || null,
      region: region || null,
      district: district || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lon ?? null,
      notes: notes || null,
    }
  }

  const save = useSave(async (): Promise<{ queued?: boolean; id?: number }> => {
    if (!vid) throw new Error('Pick a vehicle')
    if (suggestion) return api(`/suggestions/${suggestion.id}/fuel`, { body: body() })
    if (entry) return api(`/fuel/${entry.id}`, { method: 'PUT', body: body() })
    // A new fill-up with no connection (at the pump): keep it on this phone and send it later.
    const b = body()
    if (num(odometer) == null) throw new Error('Odometer reading is required')
    if (!navigator.onLine) {
      queueFill(vid, vehicle?.name ?? 'vehicle', b)
      return { queued: true }
    }
    try {
      return await api(`/vehicles/${vid}/fuel`, { body: b })
    } catch (e) {
      if (!unreachable(e)) throw e
      queueFill(vid, vehicle?.name ?? 'vehicle', b)
      return { queued: true }
    }
  }, { refresh: refresh.vehicleRecords, onDone: onClose, done: (r) => (r?.queued ? "Saved on this phone. It'll be sent when you're back online." : suggestion ? 'Fill-up added' : entry ? 'Fill-up updated' : 'Fill-up saved'),
    // added from the Inbox: Undo deletes the fill-up and puts the suggestion back
    undo: suggestion ? (added) => inboxRequests.undoAdd(suggestion.id, added.id!) : undefined })

  const enteredKm = num(odometer)
  const below = enteredKm != null && lastOdometer != null && !entry && enteredKm < lastOdometer

  return (
    <FormScreen
      open={open}
      onClose={onClose}
      title={suggestion ? 'Confirm fill-up' : entry ? 'Edit fill-up' : 'Add fill-up'}
      onSave={() => save.mutate(undefined)}
      saving={save.isPending}
      onDelete={entry ? () => {
        deleteWithUndo({ refresh: refresh.vehicleRecords, text: 'Fill-up deleted', what: 'the fill-up', hide: `fuel:${entry.id}`, run: () => api(`/fuel/${entry.id}`, { method: 'DELETE' }) })
        onClose()
      } : undefined}
      deleteLabel="Delete fill-up"
      saveAtBottom
    >
      <div className="space-y-4">
        {suggestion && (
          <div className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-800 dark:text-sky-300">
            {suggestion.note}
            {suggestion.payee && <> · {suggestion.payee}</>}
            {suggestion.hisaabAccount && <> · {suggestion.hisaabAccount}</>}
          </div>
        )}
        {vehicles.length > 1 && pickVehicle ? (
          <Field label="Vehicle">
            <Select value={vid ?? ''} onChange={(e) => setVid(Number(e.target.value))}>
              {vehicles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </Select>
          </Field>
        ) : vehicles.length > 1 && vehicle ? (
          // opened from a vehicle: say which, and let it be changed
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{vehicle.name}{vehicle.registration ? <span className="ml-2 font-mono text-xs text-stone-500">{vehicle.registration}</span> : null}</span>
            <button type="button" onClick={() => setPickVehicle(true)} className="shrink-0 rounded-lg px-2 py-1 font-medium text-accent-strong active:bg-accent-soft">Change</button>
          </div>
        ) : null}
        <Field
          label="Odometer (km)"
          hint={below ? <span className="text-amber-600">Lower than the last reading ({km(lastOdometer)})</span> : estimatedOdometer ? `≈ ${km(estimatedOdometer)} going by your trips` : lastOdometer ? `Last reading ${km(lastOdometer)}` : undefined}
        >
          <Input inputMode="decimal" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder={estimatedOdometer ? String(Math.round(estimatedOdometer)) : ''} autoFocus={!entry && !suggestion} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['price', `₹ per ${unit}`],
            ['volume', unit === 'kWh' ? 'kWh' : unit === 'kg' ? 'Kilograms' : 'Litres'],
            ['total', 'Paid (₹)'],
          ] as [Key, string][]).map(([k, label]) => (
            <Field key={k} label={label} hint={k === derived && computed ? 'worked out' : undefined}>
              <Input inputMode="decimal" value={shown(k)} onChange={(e) => edit(k, e.target.value)} className={k === derived ? '!bg-transparent' : ''} />
            </Field>
          ))}
        </div>
        {quote.data?.quote && (
          <p className="text-xs text-stone-500">
            {money2(quote.data.quote.price)}/{unit}{quote.data.quote.region ? ` in ${quote.data.quote.region}` : ''}, {quote.data.quote.source === 'MANUAL' ? 'as you set it' : quote.data.quote.source === 'LOOKUP' ? 'looked up' : 'from your last fill-up'}
          </p>
        )}

        <Toggle checked={fullTank} onChange={setFullTank} label="Full tank" hint="Mileage is worked out between full tanks." />

        {pickWhen ? (
          <Field label="When"><DateTimeInput value={when} onChange={setWhen} /></Field>
        ) : (
          // almost every fill-up is logged at the pump: "now" unless you say otherwise
          <div className="flex items-center justify-between gap-2 text-sm">
            <span><span className="text-stone-500">When</span> <span className="font-medium">now</span></span>
            <button type="button" onClick={() => setPickWhen(true)} className="rounded-lg px-2 py-1 font-medium text-accent-strong active:bg-accent-soft">Change</button>
          </div>
        )}

        {!more ? (
          <button type="button" onClick={() => setMore(true)}
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-stone-900/15 px-4 py-3 text-sm font-medium text-stone-600 transition active:scale-[0.99] active:bg-stone-100 dark:border-white/15 dark:text-stone-300 dark:active:bg-stone-800">
            <Plus size={16} /> More details <span className="font-normal text-stone-400">pump, skipped fill-up, notes</span>
          </button>
        ) : (
        <>
        <Toggle checked={missed} onChange={setMissed} label="I skipped logging the last fill-up" hint="So this stretch doesn't throw off your mileage." />

        <div className="space-y-3 rounded-2xl bg-stone-100 p-3 dark:bg-stone-800/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Where</span>
            <Button variant="ghost" className="!py-1.5" busy={locating} onClick={locate}><MapPin size={16} /> Use my location</Button>
          </div>
          <Field label="Pump"><Input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Indian Oil, MG Road" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <Input list="states" value={region} onChange={(e) => setRegion(e.target.value)} />
              <datalist id="states">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="District"><Input value={district} onChange={(e) => setDistrict(e.target.value)} /></Field>
          </div>
          {coords && <Badge tone="info"><MapPin size={12} /> Location saved</Badge>}
          {locError && <p className="text-xs text-amber-600">{locError}</p>}
        </div>

        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </>
        )}
        <ErrorText error={save.error} />
      </div>
    </FormScreen>
  )
}
