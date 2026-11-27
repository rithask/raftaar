import { CheckCircle, LinkSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { date } from '@/lib/format'
import { useSave } from '@/lib/useSave'
import { Badge, Button, Card, ErrorText, Field, IconBadge, Input, Loading , Code } from '@/ui'
import { refresh, useAccount } from '@/lib/queries'

/** Your username and password, and the identity-provider account you sign in with. */
export function AccountSection() {
  const acc = useAccount()
  const [name, setName] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const rename = useSave(() => api('/account/username', { method: 'PUT', body: { username: name } }), { refresh: refresh.account, onDone: () => setName(null), done: 'Username changed' })
  const password = useSave(() => {
    if (next !== again) return Promise.reject(new Error("The new passwords don't match"))
    return api('/account/password', { method: 'PUT', body: { current, password: next } })
  }, { refresh: refresh.account, onDone: () => {
    setCurrent('')
    setNext('')
    setAgain('')
  }, done: 'Password changed' })
  const unlink = useSave(() => api('/account/oidc-link', { method: 'DELETE' }), { refresh: refresh.account, done: 'Unlinked' })
  const account = acc.data
  if (!account) return acc.isLoading ? <Loading /> : null
  const username = name ?? account.username

  return (
    <section className="space-y-3">
      <Card padded raised className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="Username" className="flex-1">
            <Input value={username} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </Field>
          {name != null && name.trim() !== account.username && (
            <Button variant="primary" busy={rename.isPending} disabled={!name.trim()} onClick={() => rename.mutate(undefined)}>Save</Button>
          )}
        </div>
        <ErrorText error={rename.error} />

        <form onSubmit={(e) => { e.preventDefault(); password.mutate(undefined) }} className="space-y-3 border-t border-stone-900/5 pt-4 dark:border-white/10">
          <p className="text-sm font-medium">{account.hasPassword ? 'Change password' : 'Set a password'}</p>
          {!account.hasPassword && <p className="text-xs text-stone-500">You signed up with {account.provider ?? 'your identity provider'}. A password gives you a second way in.</p>}
          {!account.passwordLogin && <p className="text-xs text-stone-500">Password sign-in is turned off with <Code>PASSWORD_LOGIN=false</Code>, so this only matters if you turn it back on.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {account.hasPassword && (
              <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
            )}
            <Field label="New password"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></Field>
            <Field label="New password again"><Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
          </div>
          <ErrorText error={password.error} />
          <Button type="submit" busy={password.isPending} disabled={next.length < 8 || !again || (account.hasPassword && !current)}>{account.hasPassword ? 'Change password' : 'Set password'}</Button>
        </form>

        {account.provider && (
          <div className="flex items-center gap-3 border-t border-stone-900/5 pt-4 dark:border-white/10">
            <IconBadge square><LinkSimple size={18} /></IconBadge>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {account.provider} {account.link.linked ? <Badge tone="ok"><CheckCircle size={12} /> linked</Badge> : <Badge>not linked</Badge>}
              </div>
              <p className="truncate text-xs text-stone-500">
                {account.link.linked ? `${account.link.email || 'Account'}${account.link.linkedAt ? ` · since ${date(account.link.linkedAt.slice(0, 10))}` : ''}` : `You'll be asked to link it the first time you sign in with ${account.provider}.`}
              </p>
            </div>
            {account.link.linked && (
              <Button variant="ghost" className="shrink-0 !py-1.5 text-xs" busy={unlink.isPending}
                onClick={() => confirm(`Unlink this ${account.provider} account? Signing in with ${account.provider} will ask to link again.`) && unlink.mutate(undefined)}>
                Unlink
              </Button>
            )}
          </div>
        )}
        <ErrorText error={unlink.error} />
      </Card>
    </section>
  )
}
