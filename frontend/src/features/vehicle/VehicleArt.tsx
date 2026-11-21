import { Car, Cube, Motorcycle, Scooter } from '@phosphor-icons/react'
import { type Kind, type Vehicle } from '@/lib/types'
import { imageUrl } from './photo'
import { cx } from '@/ui'

export function KindIcon({ kind, size = 20, className }: { kind: Kind; size?: number; className?: string }) {
  const Icon = kind === 'CAR' ? Car : kind === 'SCOOTER' ? Scooter : kind === 'MOTORCYCLE' ? Motorcycle : Cube
  return <Icon size={size} className={className} />
}

/** The vehicle's photo, or its kind's icon on a tinted background. `small`: shown at icon size, so the small copy. */
export function VehicleArt({ vehicle, className, iconSize = 56, small }: { vehicle: Vehicle; className?: string; iconSize?: number; small?: boolean }) {
  const src = imageUrl(vehicle, small ? 'small' : undefined)
  if (src) return <img src={src} alt={vehicle.name} className={cx('object-cover', className)} loading="lazy" />
  return (
    <div className={cx('flex items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 text-stone-500 dark:from-stone-800 dark:to-stone-900 dark:text-stone-600', className)}>
      <KindIcon kind={vehicle.kind} size={iconSize} />
    </div>
  )
}
