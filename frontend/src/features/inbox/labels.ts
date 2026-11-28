import { type Suggestion } from '@/lib/types'

/** What a suggestion is called: the pump or payee, else what kind it is. */
export const suggestionTitle = (suggestion: Suggestion) => suggestion.stationName ?? suggestion.payee ?? (suggestion.kind === 'FUEL' ? 'Fuel stop' : 'Payment')
