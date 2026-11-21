import { type DocType, type ExpenseCategory, type FuelType, type Kind } from './types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const num1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const num2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export const money = (n: number | null | undefined) => (n == null ? '—' : inr.format(n))
export const money2 = (n: number | null | undefined) => (n == null ? '—' : inr2.format(n))
export const km = (n: number | null | undefined) => (n == null ? '—' : `${num0.format(n)} km`)
export const n1 = (n: number | null | undefined) => (n == null ? '—' : num1.format(n))
export const n2 = (n: number | null | undefined) => (n == null ? '—' : num2.format(n))

export const economyUnit = (unit: string) => `km/${unit}`

export function date(iso: string | null | undefined, withYear = true) {
  if (!iso) return '—'
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
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
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/** today as yyyy-mm-dd in local time */
export const today = () => toLocalDate(new Date())
export const toLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** <input type=datetime-local> value <-> ISO instant */
export function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => new Date(v).toISOString()

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

export const num = (v: string): number | null => {
  const t = v.trim().replace(/,/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
