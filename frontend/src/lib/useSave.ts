import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/ui'

/**
 * A mutation that refreshes everything afterwards (small app: simpler than tracking which lists changed).
 * {@code done} is shown as a short confirmation when it works.
 */
export function useSave<A, R = unknown>(fn: (a: A) => Promise<R>, onDone?: (r: R) => void, done?: string | ((r: R) => string)) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries()
      if (done) toast(typeof done === 'function' ? done(r) : done)
      onDone?.(r)
    },
  })
}
