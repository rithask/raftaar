import { type DocView, type Expense, type FuelRow, type ReminderView, type ServiceRow } from '@/lib/types'

export type Open =
  | { kind: 'vehicle' } | { kind: 'fuel'; row?: FuelRow } | { kind: 'service'; row?: ServiceRow } | { kind: 'reminder'; reminderView?: ReminderView }
  | { kind: 'doc'; d?: DocView; renewing?: boolean } | { kind: 'expense'; e?: Expense } | { kind: 'odometer' } | null
