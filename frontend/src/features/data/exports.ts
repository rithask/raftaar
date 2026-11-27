/** The kinds of record that can be exported, each its own CSV file (DataExport.Table on the server). */
export const EXPORTS = [
  { file: 'fuel', title: 'Fill-ups' },
  { file: 'services', title: 'Services' },
  { file: 'expenses', title: 'Expenses' },
  { file: 'papers', title: 'Papers' },
  { file: 'reminders', title: 'Reminders' },
  { file: 'odometer', title: 'Odometer readings' },
  { file: 'vehicles', title: 'Vehicles' },
] as const

/** The address of an export: one kind as CSV, or everything as a zip; for one vehicle, or for all of them. */
export const exportUrl = (file: string, vehicleId?: number) =>
  `/api/export/${file === 'all' ? 'all.zip' : `${file}.csv`}${vehicleId != null ? `?vehicleId=${vehicleId}` : ''}`
