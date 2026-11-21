import { type Vehicle } from '@/lib/types'

/** The vehicle's photo; `small` is a 192 px copy for where it's shown as an icon (a few KB instead of a few hundred). */
export const imageUrl = (vehicle: Vehicle, size?: 'small') =>
  vehicle.imageFile ? `/api/vehicles/${vehicle.id}/image?v=${vehicle.imageVersion}${size ? `&size=${size}` : ''}` : null
