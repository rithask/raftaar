import { km, time } from '@/lib/format'
import { type Suggestion, type Trip } from '@/lib/types'

/** What a suggestion is called: the pump or payee, else what kind it is. */
export const suggestionTitle = (suggestion: Suggestion) => suggestion.stationName ?? suggestion.payee ?? (suggestion.kind === 'FUEL' ? 'Fuel stop' : 'Payment')

/** A trip as one line: when, and how far. */
export const tripTitle = (trip: Trip) => `${time(trip.startedAt)} – ${time(trip.endedAt)} · ${km(trip.distanceM / 1000)}`
