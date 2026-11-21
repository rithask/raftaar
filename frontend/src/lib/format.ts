import { type DocType, type ExpenseCategory, type FuelType, type Kind } from './types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const num1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const num2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export const money = (amount: number | null | undefined) => (amount == null ? '—' : inr.format(amount))
export const money2 = (amount: number | null | undefined) => (amount == null ? '—' : inr2.format(amount))
export const km = (distance: number | null | undefined) => (distance == null ? '—' : `${num0.format(distance)} km`)
export const n1 = (value: number | null | undefined) => (value == null ? '—' : num1.format(value))
export const n2 = (value: number | null | undefined) => (value == null ? '—' : num2.format(value))

export const economyUnit = (unit: string) => `km/${unit}`

export function date(iso: string | null | undefined, withYear = true) {
  if (!iso) return '—'
  const when = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function ago(iso: string | null | undefined) {
  if (!iso) return 'never'
  const secondsAgo = (Date.now() - new Date(iso).getTime()) / 1000
  if (secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} h ago`
  return `${Math.floor(secondsAgo / 86400)} d ago`
}

/** today as yyyy-mm-dd in local time */
export const today = () => toLocalDate(new Date())
export const toLocalDate = (when: Date) => `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`

/** <input type=datetime-local> value <-> ISO instant */
export function toLocalInput(iso?: string | null) {
  const when = iso ? new Date(iso) : new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`
}
export const fromLocalInput = (local: string) => new Date(local).toISOString()

export const kindLabel: Record<Kind, string> = { MOTORCYCLE: 'Motorcycle', SCOOTER: 'Scooter', CAR: 'Car', OTHER: 'Other' }
export const fuelLabel: Record<FuelType, string> = { PETROL: 'Petrol', DIESEL: 'Diesel', CNG: 'CNG', ELECTRIC: 'Electric' }
export const fuelUnit: Record<FuelType, string> = { PETROL: 'L', DIESEL: 'L', CNG: 'kg', ELECTRIC: 'kWh' }

export const docLabel: Record<DocType, string> = {
  INSURANCE: 'Insurance',
  PUC: 'PUC',
  RC: 'Registration (RC)',
  ROAD_TAX: 'Road tax',
  FITNESS: 'Fitness',
  PERMIT: 'Permit',
  LICENCE: 'Driving licence',
  OTHER: 'Other',
}

export const expenseLabel: Record<ExpenseCategory, string> = {
  UPGRADE: 'Upgrade',
  ACCESSORY: 'Accessory',
  GEAR: 'Riding gear',
  INSURANCE: 'Insurance',
  TAX: 'Tax & fees',
  PARKING: 'Parking',
  TOLL: 'Toll',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
}

export const num = (input: string): number | null => {
  const cleaned = input.trim().replace(/,/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}
