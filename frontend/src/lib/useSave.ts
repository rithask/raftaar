import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast, undoToast } from '@/ui'

/**
 * A save: runs {@code save}, then fetches again what it made out of date ({@code refresh}, from refresh in
 * queries.ts), shows {@code done} as a short confirmation (given what the save returned and what it was given), and
 * calls {@code onDone}.
 *
 * {@code undo}: the confirmation offers Undo (see undoToast), which runs this with what the save returned and what it
 * was given, then fetches {@code refresh} again. {@code canUndo} leaves Undo off for a save that can't be undone.
 */
export function useSave<Input, Result = unknown>(
  save: (input: Input) => Promise<Result>,
  { refresh, onDone, done, undo, canUndo = () => true }: {
    refresh: readonly QueryKey[]
    onDone?: (result: Result) => void
    done?: string | ((result: Result, input: Input) => string)
    undo?: (result: Result, input: Input) => Promise<unknown>
    canUndo?: (result: Result, input: Input) => boolean
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
        const text = typeof done === 'function' ? done(result, input) : done
        if (undo && canUndo(result, input)) undoToast(text, () => void undoSave(result, input))
        else toast(text)
      }
      onDone?.(result)
    },
  })
}
