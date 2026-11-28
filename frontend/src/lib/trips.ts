import { km, time } from './format'
import { type Trip } from './types'

/** Where a trip went, by GeoPulse's places: "Home → Office", "From Home", "To Office"; null when neither end is named. */
export function tripPlaces({ startPlace, endPlace }: Trip) {
  if (startPlace && endPlace) return startPlace === endPlace ? `Around ${startPlace}` : `${startPlace} → ${endPlace}`
  if (startPlace) return `From ${startPlace}`
  if (endPlace) return `To ${endPlace}`
  return null
}

/** When a trip was, and how far: "9:00 am – 9:25 am · 12 km". */
export const tripWhen = (trip: Trip) => `${time(trip.startedAt)} – ${time(trip.endedAt)} · ${km(trip.distanceM / 1000)}`

/** A trip's title: where it went, or when, if its places aren't named. */
export const tripTitle = (trip: Trip) => tripPlaces(trip) ?? tripWhen(trip)
