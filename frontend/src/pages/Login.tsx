import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Logo } from '../components/Logo'
import { Button, ErrorText, Field, Input } from '../components/ui'

export function Login() {
  const qc = useQueryClient()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const me = await api<{ username: string }>('/auth/login', { body: { username, password } })
      qc.setQueryData(['me'], me)
      qc.invalidateQueries()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={96} className="drop-shadow-sm" />
          <h1 className="text-3xl font-bold tracking-tight">Raftaar</h1>
        </div>
        <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></Field>
        <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus /></Field>
        <ErrorText error={error} />
        <Button variant="primary" type="submit" className="w-full" busy={busy}>Sign in</Button>
      </form>
    </div>
  )
}
