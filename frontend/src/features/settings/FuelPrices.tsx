import { Plus, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { date, fuelLabel, money2, num } from '@/lib/format'
import { INDIAN_STATES } from '@/lib/states'
import { type FuelPrice, type FuelType } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Button, Card, ErrorText, Field, Input, List, Select } from '@/ui'
import { refresh, useFuelPrices } from '@/lib/queries'

/** Fuel prices you've entered, by state (and district), for fill-ups where none could be looked up. */
export function FuelPrices() {
  const prices = useFuelPrices()
  const [form, setForm] = useState({ region: '', district: '', fuelType: 'PETROL' as FuelType, price: '' })
  const add = useSave(() => api('/fuel-prices', { body: { ...form, district: form.district || null, price: num(form.price) } }), { refresh: refresh.fuelPrices, onDone: () => setForm((o) => ({ ...o, price: '' })), done: 'Price saved' })
  const hiddenPrice = useHidden()
  const remove = (price: FuelPrice) => deleteWithUndo({ refresh: refresh.fuelPrices, text: 'Price removed', what: 'the price', hide: `price:${price.id}`, run: () => api(`/fuel-prices/${price.id}`, { method: 'DELETE' }) })
  const src = { MANUAL: 'you', FILL_UP: 'fill-up', LOOKUP: 'looked up' } as const
  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">Picked up from your fill-ups. Set one here when prices change.</p>
      <Card padded raised className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="State">
            <Input list="states-s" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            <datalist id="states-s">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="District (optional)"><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
          <Field label="Fuel">
            <Select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value as FuelType })}>
              {(Object.keys(fuelLabel) as FuelType[]).map((fuelType) => <option key={fuelType} value={fuelType}>{fuelLabel[fuelType]}</option>)}
            </Select>
          </Field>
          <Field label="₹ per unit"><Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
        </div>
        <Button variant="primary" busy={add.isPending} disabled={!form.region.trim() || !form.price.trim()} onClick={() => add.mutate(undefined)}><Plus size={16} /> Set price</Button>
        <ErrorText error={add.error} />
      </Card>
      {(prices.data?.length ?? 0) > 0 && (
        <List>
          {prices.data!.filter((price) => !hiddenPrice(`price:${price.id}`)).map((price) => (
            <div key={price.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{price.region}{price.district ? `, ${price.district}` : ''} · {fuelLabel[price.fuelType]}</div>
                <div className="text-xs text-stone-500">{date(price.effectiveAt)} · {src[price.source]}</div>
              </div>
              <div className="num font-semibold">{money2(price.price)}</div>
              <button onClick={() => remove(price)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove price"><Trash size={16} /></button>
            </div>
          ))}
        </List>
      )}
    </section>
  )
}
