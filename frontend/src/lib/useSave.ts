import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/ui'

/**
 * A save: runs {@code save}, then fetches again what it made out of date ({@code refresh}, from refresh in
 * queries.ts), shows {@code done} as a short confirmation, and calls {@code onDone}.
 */
export function useSave<Input, Result = unknown>(
  save: (input: Input) => Promise<Result>,
  { refresh, onDone, done }: { refresh: readonly QueryKey[]; onDone?: (result: Result) => void; done?: string | ((result: Result) => string) },
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: save,
    onSuccess: (result) => {
      for (const queryKey of refresh) void queryClient.invalidateQueries({ queryKey })
      if (done) toast(typeof done === 'function' ? done(result) : done)
      onDone?.(result)
    },
  })
}
