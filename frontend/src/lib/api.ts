export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type Opts = { method?: string; body?: unknown; form?: FormData }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'), credentials: 'same-origin' }
  if (init.method === 'DELETE') init.keepalive = true // a delete sent as the page closes (see undo.ts) still goes through
  if (opts.form) init.body = opts.form
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  let res: Response
  try {
    res = await fetch('/api' + path, init)
  } catch {
    throw new ApiError(0, navigator.onLine ? "Can't reach Raftaar. Try again in a moment." : "You're offline.")
  }
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('raftaar:unauthorized'))
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`)
  return data as T
}
