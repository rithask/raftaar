import { type Vehicle } from '@/lib/types'

/** The vehicle's photo; `small` is a 192 px copy for where it's shown as an icon (a few KB instead of a few hundred). */
export const imageUrl = (v: Vehicle, size?: 'small') =>
  v.imageFile ? `/api/vehicles/${v.id}/image?v=${v.imageVersion}${size ? `&size=${size}` : ''}` : null
