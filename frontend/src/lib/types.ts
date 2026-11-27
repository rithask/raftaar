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
  /** Set once it's sold or retired. */
  soldOn?: string | null
  salePrice?: number | null
  saleOdometer?: number | null
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
  ownership: Ownership
}

/**
 * What a vehicle has cost to own (Ownership on the server): purchase + running − sale, per km and per month;
 * "so far" while it isn't sold. {@code missing} names what isn't known ("purchase price").
 */
export interface Ownership {
  sold: boolean
  purchase: number | null
  running: number
  sale: number | null
  total: number
  distance: number | null
  perKm: number | null
  months: number | null
  perMonth: number | null
  missing: string[]
}

/** A vehicle as the garage shows it: the figures for its card and what needs attention. */
export interface GarageCard {
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
  ownership: Ownership
}

export interface Garage {
  vehicles: GarageCard[]
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
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED'
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
  /** Why it was dismissed (see Handled's resolution for whether by you). */
  dismissReason: string | null
}

/** A record found by its words (Search on the server). {@code on}: its day (a paper's expiry). */
export interface SearchHit {
  kind: 'FUEL' | 'SERVICE' | 'EXPENSE' | 'PAPER' | 'REMINDER'
  id: number
  vehicleId: number | null
  title: string | null
  detail: string | null
  on: string | null
  amount: number | null
}

/** What became of something in the Inbox (Resolution on the server). */
export type Resolution = 'ADDED' | 'ADDED_THEN_DELETED' | 'DISMISSED' | 'DISMISSED_BY_SYNC' | 'ON_VEHICLE' | 'NOT_MINE'

/**
 * Something already dealt with in the Inbox: a suggestion (added or dismissed) or a trip (on a vehicle or not mine).
 * {@code vehicleId}: where it went. {@code restorable}: it can go back to To do.
 */
export interface Handled {
  at: string
  suggestion: Suggestion | null
  trip: Trip | null
  vehicleId: number | null
  resolution: Resolution
  restorable: boolean
}

/** {@code next}: where the page after this one starts; null at the end. */
export interface HandledPage {
  items: Handled[]
  next: string | null
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

/** Everything the vehicle page shows, in one request: its tabs are ready before you switch to them. */
export interface VehiclePageData {
  summary: Summary
  fuel: FuelRow[]
  reminders: ReminderView[]
  services: ServiceRow[]
  expenses: Expense[]
  trips: Trip[]
}
