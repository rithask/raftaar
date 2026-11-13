import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from './components/toast'

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

/** Shrinks a photo before upload: phones take 12 MP pictures and a card needs far less. */
export async function shrinkImage(file: File, max = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file // a format the browser can't draw (e.g. HEIC outside Safari): send it as it is
  }
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]
