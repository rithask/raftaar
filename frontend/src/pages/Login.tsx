import { Key, LinkSimple, Lock, SignIn } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { api, clearSignedOut, markSignedOut, wasSignedOut, type AuthOptions } from '../api'
import { Logo } from '../components/Logo'
import { Button, ErrorText, Field, Input, spring } from '../components/ui'

type Me = { username: string }

/**
 * The way in. With no account yet it's onboarding (create one with a password, or by signing in with the OIDC
 * provider). Otherwise: sign in with the provider and/or a password, going straight to the provider when that's
 * set up, unless you just signed out or something went wrong. After a first sign-in with the provider it asks
 * before linking that account.
 */
export function Login() {
  const qc = useQueryClient()
  const opts = useQuery({ queryKey: ['auth-options'], queryFn: () => api<AuthOptions>('/auth/options'), retry: 1 })
  const params = new URLSearchParams(window.location.search)
  const linking = params.has('link')
  const loginError = params.get('login_error')
  const signedOut = wasSignedOut()
  // ?password shows the sign-in page even when it would otherwise go straight to the provider
  const stay = linking || params.has('password') || signedOut || !!loginError
  // If the options can't be loaded, fall back to the password form rather than an empty screen.
  const o: AuthOptions | undefined = opts.data ?? (opts.isError ? { setup: false, passwordLogin: true, autoRedirect: false } : undefined)
  const redirecting = !!o?.oidc && o.autoRedirect && !o.setup && !stay

  useEffect(() => {
    if (redirecting) window.location.assign(o!.oidc!.startUrl)
  }, [redirecting]) // eslint-disable-line react-hooks/exhaustive-deps

  const signedIn = (me: Me) => {
    clearSignedOut()
    window.history.replaceState(null, '', '/')
    qc.setQueryData(['me'], me)
    qc.invalidateQueries()
  }
  const startOidc = () => {
    clearSignedOut()
    window.location.assign(o!.oidc!.startUrl)
  }

  let body: ReactNode = null
  if (linking) body = <LinkPrompt onDone={signedIn} />
  else if (o?.setup) body = <Onboarding o={o} error={loginError} onDone={signedIn} onOidc={startOidc} />
  else if (o && !redirecting) body = <SignInForm o={o} error={loginError} signedOut={signedOut} onDone={signedIn} onOidc={startOidc} />

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={88} className="drop-shadow-sm" />
          <h1 className="text-3xl font-bold tracking-tight">{o?.setup && !linking ? 'Welcome to Raftaar' : 'Raftaar'}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {redirecting ? `Taking you to ${o!.oidc!.name}…` : o?.setup && !linking ? 'Create your account to get started.' : 'Your vehicles, in one place.'}
          </p>
        </div>
        {body}
      </motion.div>
    </div>
  )
}

function Card({ children, onSubmit }: { children: ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  const cls = 'space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10'
  return onSubmit ? <form onSubmit={onSubmit} className={cls}>{children}</form> : <div className={cls}>{children}</div>
}

function Or() {
  return (
    <div className="flex items-center gap-3 text-xs text-stone-400">
      <span className="h-px flex-1 bg-stone-900/10 dark:bg-white/10" /> or <span className="h-px flex-1 bg-stone-900/10 dark:bg-white/10" />
    </div>
  )
}

function Notice({ children, tone = 'bad' }: { children: ReactNode; tone?: 'bad' | 'quiet' }) {
  return tone === 'bad'
    ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">{children}</p>
    : <p className="text-center text-sm text-stone-500 dark:text-stone-400">{children}</p>
}

/** Runs a sign-in call with busy and error state. */
function useSubmit(call: () => Promise<Me>, onDone: (me: Me) => void) {
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onDone(await call())
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return { error, busy, submit }
}

function SignInForm({ o, error, signedOut, onDone, onOidc }: { o: AuthOptions; error: string | null; signedOut: boolean; onDone: (me: Me) => void; onOidc: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const s = useSubmit(() => api<Me>('/auth/login', { body: { username, password } }), onDone)
  const showPassword = o.passwordLogin || !o.oidc
  return (
    <Card>
      {error && <Notice>{error}</Notice>}
      {signedOut && !error && <Notice tone="quiet">You're signed out.</Notice>}
      {o.oidc && (
        <Button variant="primary" className="w-full" onClick={onOidc}><SignIn size={18} /> Sign in with {o.oidc.name}</Button>
      )}
      {o.oidc && showPassword && <Or />}
      {showPassword && (
        <form onSubmit={s.submit} className="space-y-4">
          <Field label="Username"><Input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus={!o.oidc} autoCapitalize="none" spellCheck={false} /></Field>
          <Field label="Password"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <ErrorText error={s.error} />
          <Button type="submit" variant={o.oidc ? 'secondary' : 'primary'} className="w-full" busy={s.busy}><Lock size={16} /> Sign in{o.oidc ? ' with password' : ''}</Button>
        </form>
      )}
    </Card>
  )
}

/** First visit: create the account, with a password or by signing in with the provider. */
function Onboarding({ o, error, onDone, onOidc }: { o: AuthOptions; error: string | null; onDone: (me: Me) => void; onOidc: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const mismatch = again.length > 0 && again !== password
  const s = useSubmit(() => {
    if (password !== again) return Promise.reject(new Error("The passwords don't match"))
    return api<Me>('/auth/setup', { body: { username, password } })
  }, onDone)
  return (
    <Card>
      {error && <Notice>{error}</Notice>}
      {o.oidc && (
        <div className="space-y-2">
          <Button variant="primary" className="w-full" onClick={onOidc}><SignIn size={18} /> Continue with {o.oidc.name}</Button>
          <p className="text-center text-xs text-stone-500 dark:text-stone-400">Your {o.oidc.name} account becomes the owner of this Raftaar.</p>
        </div>
      )}
      {o.oidc && o.passwordLogin && <Or />}
      {o.passwordLogin && (
        <form onSubmit={s.submit} className="space-y-4">
          <Field label="Username"><Input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus={!o.oidc} autoCapitalize="none" spellCheck={false} /></Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          <Field label="Password again" hint={mismatch ? <span className="text-red-600 dark:text-red-400">Doesn't match yet</span> : undefined}>
            <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
          </Field>
          <ErrorText error={s.error} />
          <Button type="submit" variant={o.oidc ? 'secondary' : 'primary'} className="w-full" busy={s.busy} disabled={!username.trim() || password.length < 8 || mismatch}>
            <Key size={16} /> Create account
          </Button>
        </form>
      )}
    </Card>
  )
}

interface PendingLink {
  email?: string
  name?: string
  provider: string
  username: string
  passwordRequired: boolean
}

/** First sign-in with the provider: ask before linking that account. Your password confirms it's really you. */
function LinkPrompt({ onDone }: { onDone: (me: Me) => void }) {
  const pending = useQuery({ queryKey: ['pending-link'], queryFn: () => api<PendingLink>('/auth/link'), retry: false })
  const [password, setPassword] = useState('')
  const s = useSubmit(() => api<Me>('/auth/link', { body: { password } }), onDone)
  const leave = () => window.location.assign('/')
  const cancel = async () => {
    await api('/auth/link/cancel', { method: 'POST' }).catch(() => undefined)
    markSignedOut() // otherwise the sign-in page would go straight back to the provider and ask again
    leave()
  }

  if (pending.isError)
    return (
      <Card>
        <Notice tone="quiet">That sign-in has expired. Please sign in again.</Notice>
        <Button variant="primary" className="w-full" onClick={leave}>Back to sign in</Button>
      </Card>
    )
  const p = pending.data
  if (!p) return null
  return (
    <Card onSubmit={s.submit}>
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><LinkSimple size={20} /></span>
        <div className="min-w-0">
          <p className="font-semibold">Link your {p.provider} account?</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            <b className="font-semibold text-stone-900 dark:text-stone-100">{p.email ?? p.name ?? 'This account'}</b> isn't linked to Raftaar yet. Once it is, you can sign in with {p.provider}.
          </p>
        </div>
      </div>
      {p.passwordRequired && (
        <Field label={`Password for “${p.username}”`} hint="Confirms this Raftaar is yours.">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Field>
      )}
      <ErrorText error={s.error} />
      <Button type="submit" variant="primary" className="w-full" busy={s.busy} disabled={p.passwordRequired && !password}>Link and sign in</Button>
      <Button variant="ghost" className="w-full" onClick={cancel}>Don't link</Button>
    </Card>
  )
}
