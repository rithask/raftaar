import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { usePrefetchVehicle } from '@/lib/queries'

/**
 * A link to a vehicle's page that starts loading the page when a finger lands on it (or a pointer rests on it), so
 * it's usually ready when the tap ends and the page slides in already filled.
 */
export function VehicleLink({ vehicleId, ...rest }: Omit<ComponentProps<typeof Link>, 'to'> & { vehicleId: number }) {
  const prefetch = usePrefetchVehicle()
  return <Link {...rest} to={`/vehicles/${vehicleId}`} onPointerDown={() => prefetch(vehicleId)} onMouseEnter={() => prefetch(vehicleId)} />
}
