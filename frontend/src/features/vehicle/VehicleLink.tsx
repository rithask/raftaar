import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { usePrefetchVehicle } from '@/lib/queries'
import { loadCharts } from './LazyCharts'
import { loadVehiclePage } from './loadVehiclePage'

/**
 * A link to a vehicle's page that starts loading the page (its data, its code and the charts) when a finger lands on
 * it or a pointer rests on it, so it's usually ready when the tap ends and the page slides in already filled.
 */
export function VehicleLink({ vehicleId, ...rest }: Omit<ComponentProps<typeof Link>, 'to'> & { vehicleId: number }) {
  const prefetchData = usePrefetchVehicle()
  const prefetch = () => {
    prefetchData(vehicleId)
    void loadVehiclePage()
    void loadCharts()
  }
  return <Link {...rest} to={`/vehicles/${vehicleId}`} onPointerDown={prefetch} onMouseEnter={prefetch} />
}
