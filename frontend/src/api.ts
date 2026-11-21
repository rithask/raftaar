export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'), credentials: 'same-origin' }
  if (init.method === 'DELETE') init.keepalive = true // a delete sent as the page closes (see undo.ts) still goes through
  if (opts.form) init.body = opts.form
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  let res: Response
  try {
    res = await fetch('/api' + path, init)
  } catch {
    throw new ApiError(0, navigator.onLine ? "Can't reach Raftaar. Try again in a moment." : "You're offline.")
  }
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('raftaar:unauthorized'))
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`)
  return data as T
}

// ---- signing out --------------------------------------------------------------------------------------

/** Set on sign-out so the sign-in page doesn't go straight back to the identity provider. */
const SIGNED_OUT = 'raftaar:signed-out'

export function wasSignedOut() {
  try {
    return sessionStorage.getItem(SIGNED_OUT) != null
  } catch {
    return false
  }
}

export function clearSignedOut() {
  try {
    sessionStorage.removeItem(SIGNED_OUT)
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Keeps the sign-in page from going straight to the provider (after signing out, or declining to link). */
export function markSignedOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT, '1')
  } catch {
    // storage unavailable: the sign-in page may go straight to the provider again
  }
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
  markSignedOut()
  // forget the data kept for opening offline (public/sw.js)
  navigator.serviceWorker?.controller?.postMessage('clear-data')
}

/** What the sign-in page offers; `setup` means there's no account yet (onboarding). */
export interface AuthOptions {
  setup: boolean
  passwordLogin: boolean
  oidc?: { name: string; startUrl: string }
  autoRedirect: boolean
}

export interface AccountView {
  username: string
  hasPassword: boolean
  passwordLogin: boolean
  provider?: string
  link: { linked: boolean; email?: string; linkedAt?: string }
}

// ---- types (mirror the backend) ------------------------------------------------------------------------

export type Kind = 'MOTORCYCLE' | 'SCOOTER' | 'CAR' | 'OTHER'
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC'

export interface Vehicle {
  id: number
  name: string
  kind: Kind
  fuelType: FuelType
  make?: string | null
  model?: string | null
  year?: number | null
  registration?: string | null
  color?: string | null
  tankCapacity?: number | null
  purchaseDate?: string | null
  purchaseOdometer?: number | null
  purchasePrice?: number | null
  imageFile?: string | null
  imageVersion: number
  isDefault: boolean
  archived: boolean
  notes?: string | null
}

export interface Odometer {
  known: number | null
  knownAt: string | null
  knownSource: string | null
  estimated: number | null
  tripKmSince: number | null
  kmPerDay: number | null
}

export interface OdometerReading {
  at: string
  odometer: number
  source: 'PURCHASE' | 'FUEL' | 'SERVICE' | 'EXPENSE' | 'MANUAL'
  id: number | null
}

export interface FuelEntry {
  id: number
  vehicleId: number
  filledAt: string
  odometer: number
  volume: number
  pricePerUnit: number
  totalCost: number
  fullTank: boolean
  missedPrevious: boolean
  stationName?: string | null
  stationBrand?: string | null
  latitude?: number | null
  longitude?: number | null
  region?: string | null
  district?: string | null
  source: 'MANUAL' | 'HISAAB' | 'GEOPULSE' | 'HISAAB_GEOPULSE'
  hisaabTxnId?: string | null
  sourceIssue?: string | null
  notes?: string | null
}

export interface FuelRow {
  entry: FuelEntry
  kmPerUnit: number | null
  distance: number | null
  /** The going rate there and then, when one was looked up or entered */
  publishedPrice: number | null
}

export type ReminderStateName = 'OK' | 'DUE_SOON' | 'OVERDUE' | 'UNKNOWN'

export interface Reminder {
  id: number
  vehicleId: number
  title: string
  intervalKm?: number | null
  intervalMonths?: number | null
  lastDoneOn?: string | null
  lastDoneOdometer?: number | null
  dueOn?: string | null
  dueOdometer?: number | null
  notifyDaysBefore: number
  notifyKmBefore: number
  active: boolean
  notes?: string | null
}

export interface ReminderView {
  reminder: Reminder
  status: {
    state: ReminderStateName
    dueOn: string | null
    dueOdometer: number | null
    daysLeft: number | null
    kmLeft: number | null
    projectedOn: string | null
    summary: string
  }
}

export type DocType = 'INSURANCE' | 'PUC' | 'RC' | 'ROAD_TAX' | 'FITNESS' | 'PERMIT' | 'LICENCE' | 'OTHER'

export interface Doc {
  id: number
  vehicleId: number | null
  type: DocType
  title: string
  number?: string | null
  provider?: string | null
  issuedOn?: string | null
  expiresOn?: string | null
  remindDaysBefore: number
  cost?: number | null
  fileType?: string | null
  fileOriginalName?: string | null
  notes?: string | null
}

export interface DocView {
  document: Doc
  daysLeft: number | null
  state: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY'
}

export interface ServiceRecord {
  id: number
  vehicleId: number
  servicedOn: string
  odometer?: number | null
  title: string
  workshop?: string | null
  cost: number
  notes?: string | null
}

export interface ServiceRow {
  record: ServiceRecord
  reminderIds: number[]
}

export type ExpenseCategory = 'UPGRADE' | 'ACCESSORY' | 'GEAR' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'CLEANING' | 'OTHER'

export interface Expense {
  id: number
  vehicleId: number
  spentOn: string
  category: ExpenseCategory
  title: string
  amount: number
  odometer?: number | null
  vendor?: string | null
  hisaabTxnId?: string | null
  notes?: string | null
}

export interface Stretch {
  endId: number
  distance: number
  volume: number
  cost: number
  kmPerUnit: number
}

export interface Summary {
  vehicle: Vehicle
  odometer: Odometer
  averageEconomy: number | null
  lastEconomy: number | null
  unit: string
  lastFill: FuelEntry | null
  costs: { fuel: number; service: number; expenses: number; total: number; perKm: number | null; thisMonth: number }
  reminders: ReminderView[]
  documents: DocView[]
  economyHistory: Stretch[]
  /** Up to the last twelve months, oldest first; month as "2026-11" */
  monthly: { month: string; fuel: number; service: number; other: number }[]
}

export interface Card {
  vehicle: Vehicle
  odometer: Odometer
  averageEconomy: number | null
  lastEconomy: number | null
  unit: string
  lastFill: FuelEntry | null
  spentThisMonth: number
  costPerKm: number | null
  attention: ReminderView[]
  papers: DocView[]
}

export interface Garage {
  vehicles: Card[]
  tripsToSort: number
  toConfirm: number
}

export interface Trip {
  id: number
  geopulseId: number | null
  startedAt: string
  endedAt: string
  distanceM: number
  movementType: string | null
  status: 'PENDING' | 'ASSIGNED' | 'IGNORED'
  vehicleId: number | null
  suggestedVehicleId: number | null
}

export interface Suggestion {
  id: number
  kind: 'FUEL' | 'EXPENSE'
  status: string
  occurredAt: string
  amount: number | null
  payee: string | null
  hisaabTxnId: string | null
  hisaabCategory: string | null
  hisaabAccount: string | null
  stopAt: string | null
  stopSeconds: number | null
  latitude: number | null
  longitude: number | null
  stationName: string | null
  stationBrand: string | null
  region: string | null
  district: string | null
  suggestedPrice: number | null
  suggestedVehicleId: number | null
  note: string | null
}

export interface Inbox {
  trips: Trip[]
  suggestions: { suggestion: Suggestion; estimatedOdometer: number | null; estimatedVolume: number | null }[]
  issues: FuelEntry[]
}

export interface SyncStatus {
  lastRun: string | null
  lastResult: string | null
  lastError: string | null
  lastErrorAt: string | null
  running: boolean
}

export interface Integration {
  name: 'geopulse' | 'hisaab' | 'alerts' | 'osm'
  configured: boolean
  target: string | null
  status: SyncStatus
  options: Record<string, unknown>
}

export interface FuelPrice {
  id: number
  region: string
  district: string | null
  fuelType: FuelType
  price: number
  effectiveAt: string
  source: 'MANUAL' | 'FILL_UP' | 'LOOKUP'
}

export interface Quote {
  region: string | null
  district: string | null
  quote: { price: number; source: string; asOf: string; region: string | null; district: string | null } | null
}

/** The vehicle's photo; `small` is a 192 px copy for where it's shown as an icon (a few KB instead of a few hundred). */
export const imageUrl = (v: Vehicle, size?: 'small') =>
  v.imageFile ? `/api/vehicles/${v.id}/image?v=${v.imageVersion}${size ? `&size=${size}` : ''}` : null

export interface Channel {
  id: number | null
  label: string | null
  service: string
  masked: string
  enabled: boolean
  fromEnvironment: boolean
  lastSentAt: string | null
  lastOk: boolean | null
  lastError: string | null
}

export interface ChannelList {
  apprise: string | null
  channels: Channel[]
}
