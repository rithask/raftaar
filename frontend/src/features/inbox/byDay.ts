import { date } from '@/lib/format'

/** Items grouped by the day of {@code when}, in the order they come: [the day as shown, its items]. */
export function byDay<T>(items: T[], when: (item: T) => string): [string, T[]][] {
  const days = new Map<string, T[]>()
  for (const item of items) {
    const day = date(when(item))
    days.set(day, [...(days.get(day) ?? []), item])
  }
  return [...days.entries()]
}
