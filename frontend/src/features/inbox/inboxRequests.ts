import { api } from '@/lib/api'

/** What the Inbox asks the server to do with suggestions and trips, each with its way back. */
export const inboxRequests = {
  /** Undone by {@link restore}. */
  dismiss: (suggestionId: number) => api(`/suggestions/${suggestionId}/dismiss`, { method: 'POST' }),
  /** Back to To do: one dismissed, or one added whose fill-up or expense has since been deleted. */
  restore: (suggestionId: number) => api(`/suggestions/${suggestionId}/restore`, { method: 'POST' }),
  /** Undoes adding a suggestion: deletes the fill-up or expense it became ({@code recordId}) and puts it back. */
  undoAdd: (suggestionId: number, recordId: number) => api(`/suggestions/${suggestionId}/undo-add`, { body: { recordId } }),
  /** {@code vehicleId} null: not mine. Undone by {@link unassignTrips}. */
  assignTrips: (tripIds: number[], vehicleId: number | null) => api('/trips/assign', { body: { tripIds, vehicleId } }),
  /** Back to sort. */
  unassignTrips: (tripIds: number[]) => api('/trips/unassign', { body: { tripIds } }),
}
