import { type Vehicle } from './types'

/** A lookup of a vehicle's name by its id, among {@code vehicles}; undefined for none, or one not among them. */
export const vehicleNames = (vehicles: Vehicle[] | undefined) => (id: number | null | undefined) =>
  id == null ? undefined : vehicles?.find((vehicle) => vehicle.id === id)?.name
