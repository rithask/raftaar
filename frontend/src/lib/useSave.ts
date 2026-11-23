import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from '@/ui'
import { UNDO_WAIT } from './undo'

/**
 * A save: runs {@code save}, then fetches again what it made out of date ({@code refresh}, from refresh in
 * queries.ts), shows {@code done} as a short confirmation, and calls {@code onDone}.
 *
 * {@code undo}: the confirmation offers Undo for a few seconds, which runs this (given what the save returned and what
 * it was given) and fetches {@code refresh} again.
 */
export function useSave<Input, Result = unknown>(
  save: (input: Input) => Promise<Result>,
  { refresh, onDone, done, undo }: {
    refresh: readonly QueryKey[]
    onDone?: (result: Result) => void
    done?: string | ((result: Result) => string)
    undo?: (result: Result, input: Input) => Promise<unknown>
  },
) {
  const queryClient = useQueryClient()
  const refetch = () => Promise.all(refresh.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  const undoSave = async (result: Result, input: Input) => {
    try {
      await undo!(result, input)
      await refetch()
      toast('Undone')
    } catch (e) {
      toast(`Couldn't undo: ${e instanceof Error ? e.message : 'try again'}`, 'bad')
    }
  }
  return useMutation({
    mutationFn: save,
    onSuccess: (result, input) => {
      void refetch()
      if (done) {
        const text = typeof done === 'function' ? done(result) : done
        if (!undo) toast(text)
        else toast(text, 'ok', { duration: UNDO_WAIT, action: { label: 'Undo', onClick: () => void undoSave(result, input) } })
      }
      onDone?.(result)
    },
  })
}
