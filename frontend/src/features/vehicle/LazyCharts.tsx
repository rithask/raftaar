import { lazy, Suspense, type ComponentProps, type ComponentType } from 'react'
import { cx, Skeleton } from '@/ui'
import type * as Charts from './charts'

/**
 * The vehicle's charts, loaded on their own: the charting library is about a third of the app's code, and only
 * these need it. Until it's here, a placeholder of the same size holds the chart's place, so nothing moves when it
 * arrives. {@link loadCharts} starts loading early (when you touch a vehicle).
 */
export const loadCharts = () => import('./charts')

function lazyChart<Props extends object>(load: () => Promise<ComponentType<Props>>, height = 'h-40') {
  const Chart = lazy(() => load().then((component) => ({ default: component })))
  return function LazyChart(props: Props) {
    return (
      <Suspense fallback={<Skeleton className={cx(height, 'rounded-2xl')} />}>
        <Chart {...props} />
      </Suspense>
    )
  }
}

export const MileageChart = lazyChart<ComponentProps<typeof Charts.MileageChart>>(() => loadCharts().then((charts) => charts.MileageChart))
export const PriceChart = lazyChart<ComponentProps<typeof Charts.PriceChart>>(() => loadCharts().then((charts) => charts.PriceChart))
export const MonthlyChart = lazyChart<ComponentProps<typeof Charts.MonthlyChart>>(() => loadCharts().then((charts) => charts.MonthlyChart))
export const OdometerChart = lazyChart<ComponentProps<typeof Charts.OdometerChart>>(() => loadCharts().then((charts) => charts.OdometerChart), 'h-32')
