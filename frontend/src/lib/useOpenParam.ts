import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A record to open named in the address (?open=fuel:12, from a search result). Once the page's data is {@code ready},
 * {@code find} turns it into what to open and {@code open} opens it; then it's dropped from the address (with ?tab=),
 * so going back or reloading doesn't open it again. One that's no longer there is just dropped.
 */
export function useOpenParam<T>(ready: boolean, find: (kind: string, id: number) => T | null | undefined, open: (found: T) => void) {
  const [params, setParams] = useSearchParams()
  const value = params.get('open')
  // the latest find and open, without making the effect run again whenever the page re-renders
  const latest = useRef({ find, open })
  latest.current = { find, open }
  useEffect(() => {
    if (!value || !ready) return
    const [kind, id] = value.split(':')
    const found = latest.current.find(kind, Number(id))
    if (found) latest.current.open(found)
    setParams((current) => {
      current.delete('open')
      current.delete('tab')
      return current
    }, { replace: true })
  }, [value, ready, setParams])
}
