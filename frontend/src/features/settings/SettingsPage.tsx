import { ArrowsClockwise, Bell, CaretLeft, CaretRight, CheckCircle, GasPump, LinkSimple, MapPin, Path, Plus, SignOut, Trash, UserCircle, Wallet, XCircle } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { ago, date, fuelLabel, money2, num } from '@/lib/format'
import { INDIAN_STATES } from '@/lib/states'
import { type AccountView, type Channel, type ChannelList, type FuelPrice, type FuelType, type Integration } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { signOut } from '@/features/auth/session'
import { Badge, Button, Card, cx, ErrorText, Field, IconBadge, Input, List, Loading, PageHeader, rowPress, Select, Toggle } from '@/ui'

const META: Record<Integration['name'], { title: string; icon: ReactNode; off: ReactNode; what: string; run?: string }> = {
  geopulse: { title: 'GeoPulse', icon: <Path size={20} />, off: <>Set <Code>GEOPULSE_URL</Code> and <Code>GEOPULSE_TOKEN</Code> to connect.</>, what: 'Brings in your trips and spots stops at fuel pumps.', run: 'Sync now' },
  hisaab: { title: 'Hisaab', icon: <Wallet size={20} />, off: <>Set <Code>HISAAB_URL</Code> and <Code>HISAAB_TOKEN</Code> to connect.</>, what: 'Brings in your fuel payments.', run: 'Sync now' },
  alerts: { title: 'Daily reminders', icon: <Bell size={20} />, off: 'Add a notification channel below to turn these on.', what: 'Due services and expiring papers, every morning.', run: 'Check now' },
  osm: { title: 'Pump & state lookup', icon: <MapPin size={20} />, off: <>Set <Code>OVERPASS_URL</Code> to name pumps, <Code>NOMINATIM_URL</Code> to find the state.</>, what: 'Uses OpenStreetMap to name the pump and state for a fill-up.' },
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 text-[11px] dark:bg-stone-800">{children}</code>
}

type Key = 'connections' | 'notifications' | 'fuel-prices' | 'account'
const SECTIONS: { key: Key; title: string; icon: ReactNode }[] = [
  { key: 'connections', title: 'Connections', icon: <LinkSimple size={20} /> },
  { key: 'notifications', title: 'Notifications', icon: <Bell size={20} /> },
  { key: 'fuel-prices', title: 'Fuel prices', icon: <GasPump size={20} /> },
  { key: 'account', title: 'Account', icon: <UserCircle size={20} /> },
]

/**
 * Settings as a short list. On a phone each section opens on its own (/settings/notifications), so the back
 * gesture returns to the list; on larger screens the list stays on the left and the section shows beside it.
 */
export function SettingsPage() {
  const { section } = useParams()
  const active = SECTIONS.find((x) => x.key === section)
  if (section && !active) return <Navigate to="/settings" replace />
  const open = active ?? SECTIONS[0]
  return (
    <div className="sm:grid sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-start sm:gap-8">
      {/* the list: the whole page on a phone with no section open; always on the left on larger screens */}
      <div className={cx('space-y-5 sm:sticky sm:top-6', active && 'max-sm:hidden')}>
        <PageHeader title="Settings" />
        <SectionList active={active?.key} />
      </div>
      <div className={cx('min-w-0', !active && 'max-sm:hidden')}>
        {active && (
          <Link to="/settings" className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-full py-1.5 pr-3 pl-2 text-sm font-medium text-stone-600 transition active:scale-95 active:bg-stone-200 sm:hidden dark:text-stone-300 dark:active:bg-stone-800">
            <CaretLeft size={16} /> Settings
          </Link>
        )}
        <h2 className="mb-4 text-2xl font-bold tracking-tight sm:mt-1 sm:text-xl">{open.title}</h2>
        {open.key === 'connections' && <Connections />}
        {open.key === 'notifications' && <NotificationChannels />}
        {open.key === 'fuel-prices' && <FuelPrices />}
        {open.key === 'account' && <AccountSection />}
      </div>
    </div>
  )
}

/** Each section with a one-line summary, then sign out and the version. */
function SectionList({ active }: { active?: Key }) {
  const qc = useQueryClient()
  const integrations = useQuery({ queryKey: ['integrations'], queryFn: () => api<Integration[]>('/integrations') })
  const channels = useQuery({ queryKey: ['channels'], queryFn: () => api<ChannelList>('/notifications/channels') })
  const prices = useQuery({ queryKey: ['fuel-prices'], queryFn: () => api<FuelPrice[]>('/fuel-prices') })
  const account = useQuery({ queryKey: ['account'], queryFn: () => api<AccountView>('/account') })
  const failing = (integrations.data ?? []).filter((i) => i.status.lastError)
  const on = (integrations.data ?? []).filter((i) => i.configured).length
  const nChannels = channels.data?.channels.length ?? 0
  const summary: Record<Key, ReactNode> = {
    connections: !integrations.data ? '' : failing.length
      ? <span className="text-red-600 dark:text-red-400">{META[failing[0].name].title} is failing</span>
      : `${on} of ${integrations.data.length} on`,
    notifications: !channels.data ? '' : nChannels === 0 ? 'No channels yet' : nChannels === 1 ? '1 channel' : `${nChannels} channels`,
    'fuel-prices': !prices.data ? '' : prices.data.length === 0 ? 'None yet' : prices.data.length === 1 ? '1 state' : `${prices.data.length} prices`,
    account: account.data?.username ?? '',
  }
  const logout = async () => {
    await signOut()
    qc.setQueryData(['me'], null)
  }
  return (
    <>
      <List as="nav" label="Settings sections">
        {SECTIONS.map((x) => (
          <Link key={x.key} to={`/settings/${x.key}`} aria-current={x.key === active ? 'page' : undefined}
            className={cx('flex items-center gap-3 px-4 py-3.5', rowPress, 'sm:aria-[current=page]:bg-stone-900/[0.05] sm:dark:aria-[current=page]:bg-white/[0.07]')}>
            <IconBadge tone="neutral" square>{x.icon}</IconBadge>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{x.title}</span>
              <span className="block truncate text-xs text-stone-500">{summary[x.key]}</span>
            </span>
            <CaretRight size={16} className="shrink-0 text-stone-300 sm:hidden" />
          </Link>
        ))}
      </List>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={logout}><SignOut size={16} /> Sign out</Button>
        <Version />
      </div>
    </>
  )
}

function Connections() {
  const integrations = useQuery({ queryKey: ['integrations'], queryFn: () => api<Integration[]>('/integrations'), refetchInterval: 10_000 })
  const run = useSave((name: string) => api<{ result: string }>(`/integrations/${name}/run`, { method: 'POST' }), undefined, (r) => r.result)
  return (
    <section className="space-y-3">
      {integrations.isLoading && <Loading />}
      {integrations.data?.map((i) => {
        const m = META[i.name]
        const s = i.status
        return (
          <Card padded raised key={i.name} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-stone-100 p-2 dark:bg-stone-800">{m.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                  {m.title}
                  {i.configured ? <Badge tone="ok"><CheckCircle size={12} /> on</Badge> : <Badge><XCircle size={12} /> off</Badge>}
                </div>
                <div className="text-xs text-stone-500">{m.what}</div>
              </div>
              {i.configured && m.run && (
                <Button variant="ghost" className="shrink-0 !px-2.5 sm:!px-4" aria-label={m.run} busy={(run.isPending && run.variables === i.name) || s.running} onClick={() => run.mutate(i.name)}>
                  <ArrowsClockwise size={18} /> <span className="hidden sm:inline">{m.run}</span>
                </Button>
              )}
            </div>
            {!i.configured && <p className="text-xs text-stone-500">{m.off}</p>}
            {i.configured && (i.target || s.lastRun) && (
              <p className="text-xs text-stone-500">
                {i.target}{i.target && s.lastRun ? ' · ' : ''}{s.lastRun && `Last ${ago(s.lastRun)}${s.lastResult && !s.lastError ? `: ${s.lastResult}` : ''}`}
              </p>
            )}
            {s.lastError && <p className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-400">{s.lastError}</p>}
          </Card>
        )
      })}
      <ErrorText error={run.error} />
    </section>
  )
}

function FuelPrices() {
  const prices = useQuery({ queryKey: ['fuel-prices'], queryFn: () => api<FuelPrice[]>('/fuel-prices') })
  const [f, setF] = useState({ region: '', district: '', fuelType: 'PETROL' as FuelType, price: '' })
  const add = useSave(() => api('/fuel-prices', { body: { ...f, district: f.district || null, price: num(f.price) } }), () => setF((o) => ({ ...o, price: '' })), 'Price saved')
  const hiddenPrice = useHidden()
  const remove = (p: FuelPrice) => deleteWithUndo({ text: 'Price removed', what: 'the price', hide: `price:${p.id}`, run: () => api(`/fuel-prices/${p.id}`, { method: 'DELETE' }) })
  const src = { MANUAL: 'you', FILL_UP: 'fill-up', LOOKUP: 'looked up' } as const
  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">Picked up from your fill-ups. Set one here when prices change.</p>
      <Card padded raised className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="State">
            <Input list="states-s" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
            <datalist id="states-s">{INDIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="District (optional)"><Input value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></Field>
          <Field label="Fuel">
            <Select value={f.fuelType} onChange={(e) => setF({ ...f, fuelType: e.target.value as FuelType })}>
              {(Object.keys(fuelLabel) as FuelType[]).map((t) => <option key={t} value={t}>{fuelLabel[t]}</option>)}
            </Select>
          </Field>
          <Field label="₹ per unit"><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        </div>
        <Button variant="primary" busy={add.isPending} disabled={!f.region.trim() || !f.price.trim()} onClick={() => add.mutate(undefined)}><Plus size={16} /> Set price</Button>
        <ErrorText error={add.error} />
      </Card>
      {(prices.data?.length ?? 0) > 0 && (
        <List>
          {prices.data!.filter((p) => !hiddenPrice(`price:${p.id}`)).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.region}{p.district ? `, ${p.district}` : ''} · {fuelLabel[p.fuelType]}</div>
                <div className="text-xs text-stone-500">{date(p.effectiveAt)} · {src[p.source]}</div>
              </div>
              <div className="num font-semibold">{money2(p.price)}</div>
              <button onClick={() => remove(p)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove price"><Trash size={16} /></button>
            </div>
          ))}
        </List>
      )}
    </section>
  )
}

/** Where notifications go: Apprise URLs. Saved URLs are only ever shown masked, as they contain tokens. */
function NotificationChannels() {
  const list = useQuery({ queryKey: ['channels'], queryFn: () => api<ChannelList>('/notifications/channels') })
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const add = useSave(() => api('/notifications/channels', { body: { label, url } }), () => {
    setLabel('')
    setUrl('')
  }, 'Channel added')
  const test = useSave((id: number) => api<Channel>(`/notifications/channels/${id}/test`, { method: 'POST' }), undefined, (c) => (c.lastOk ? 'Test sent' : 'Test failed'))
  const toggle = useSave((c: { id: number; enabled: boolean }) => api(`/notifications/channels/${c.id}`, { method: 'PUT', body: { enabled: c.enabled } }))
  const hidden = useHidden()
  const remove = (c: Channel) => deleteWithUndo({ text: 'Channel removed', what: 'the channel', hide: `channel:${c.id}`, run: () => api(`/notifications/channels/${c.id}`, { method: 'DELETE' }) })
  const data = list.data

  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">
        Add an Apprise URL for each place you want reminders, e.g. <Code>ntfys://ntfy.sh/your-topic</Code>.{' '}
        <a className="underline active:opacity-60" href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank" rel="noreferrer">See all services</a>
      </p>
      {data && !data.apprise && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">Apprise isn't available, so nothing can be sent. Use the Docker image, or set <Code>APPRISE_BIN</Code>.</p>
      )}
      <Card padded raised className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My phone" /></Field>
          <Field label="Apprise URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ntfys://ntfy.sh/my-topic" autoComplete="off" spellCheck={false} autoCapitalize="none" /></Field>
        </div>
        <Button variant="primary" busy={add.isPending} disabled={!url.trim()} onClick={() => add.mutate(undefined)}><Plus size={16} /> Add channel</Button>
        <ErrorText error={add.error} />
      </Card>
      {list.isLoading && <Loading />}
      {data && data.channels.length > 0 && (
        <List>
          {data.channels.filter((c) => c.id == null || !hidden(`channel:${c.id}`)).map((c, i) => (
            <div key={c.id ?? `env-${i}`} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {c.label ?? c.service}
                    {c.fromEnvironment && <Badge>fixed</Badge>}
                    {c.lastOk === true && <Badge tone="ok"><CheckCircle size={12} /> worked</Badge>}
                    {c.lastOk === false && <Badge tone="bad"><XCircle size={12} /> failed</Badge>}
                  </div>
                  <div className="truncate font-mono text-xs text-stone-500">{c.masked}</div>
                </div>
                {c.id != null && (
                  <>
                    <Button variant="ghost" className="!py-1.5 text-xs" busy={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id!)}>Test</Button>
                    <button onClick={() => remove(c)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove channel"><Trash size={16} /></button>
                  </>
                )}
              </div>
              {c.id != null && <Toggle checked={c.enabled} onChange={(v) => toggle.mutate({ id: c.id!, enabled: v })} label="Send reminders here" />}
              {c.lastError && <p className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-400">{c.lastError}</p>}
              {c.lastSentAt && <p className="text-xs text-stone-500">Last sent {ago(c.lastSentAt)}</p>}
            </div>
          ))}
        </List>
      )}
      {data?.apprise && <p className="text-xs text-stone-500">{data.apprise}</p>}
      <ErrorText error={test.error ?? toggle.error} />
    </section>
  )
}

/** Your username and password, and the identity-provider account you sign in with. */
function AccountSection() {
  const acc = useQuery({ queryKey: ['account'], queryFn: () => api<AccountView>('/account') })
  const [name, setName] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const rename = useSave(() => api('/account/username', { method: 'PUT', body: { username: name } }), () => setName(null), 'Username changed')
  const password = useSave(() => {
    if (next !== again) return Promise.reject(new Error("The new passwords don't match"))
    return api('/account/password', { method: 'PUT', body: { current, password: next } })
  }, () => {
    setCurrent('')
    setNext('')
    setAgain('')
  }, 'Password changed')
  const unlink = useSave(() => api('/account/oidc-link', { method: 'DELETE' }), undefined, 'Unlinked')
  const a = acc.data
  if (!a) return acc.isLoading ? <Loading /> : null
  const username = name ?? a.username

  return (
    <section className="space-y-3">
      <Card padded raised className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="Username" className="flex-1">
            <Input value={username} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </Field>
          {name != null && name.trim() !== a.username && (
            <Button variant="primary" busy={rename.isPending} disabled={!name.trim()} onClick={() => rename.mutate(undefined)}>Save</Button>
          )}
        </div>
        <ErrorText error={rename.error} />

        <form onSubmit={(e) => { e.preventDefault(); password.mutate(undefined) }} className="space-y-3 border-t border-stone-900/5 pt-4 dark:border-white/10">
          <p className="text-sm font-medium">{a.hasPassword ? 'Change password' : 'Set a password'}</p>
          {!a.hasPassword && <p className="text-xs text-stone-500">You signed up with {a.provider ?? 'your identity provider'}. A password gives you a second way in.</p>}
          {!a.passwordLogin && <p className="text-xs text-stone-500">Password sign-in is turned off with <Code>PASSWORD_LOGIN=false</Code>, so this only matters if you turn it back on.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {a.hasPassword && (
              <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
            )}
            <Field label="New password"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></Field>
            <Field label="New password again"><Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
          </div>
          <ErrorText error={password.error} />
          <Button type="submit" busy={password.isPending} disabled={next.length < 8 || !again || (a.hasPassword && !current)}>{a.hasPassword ? 'Change password' : 'Set password'}</Button>
        </form>

        {a.provider && (
          <div className="flex items-center gap-3 border-t border-stone-900/5 pt-4 dark:border-white/10">
            <IconBadge square><LinkSimple size={18} /></IconBadge>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {a.provider} {a.link.linked ? <Badge tone="ok"><CheckCircle size={12} /> linked</Badge> : <Badge>not linked</Badge>}
              </div>
              <p className="truncate text-xs text-stone-500">
                {a.link.linked ? `${a.link.email || 'Account'}${a.link.linkedAt ? ` · since ${date(a.link.linkedAt.slice(0, 10))}` : ''}` : `You'll be asked to link it the first time you sign in with ${a.provider}.`}
              </p>
            </div>
            {a.link.linked && (
              <Button variant="ghost" className="shrink-0 !py-1.5 text-xs" busy={unlink.isPending}
                onClick={() => confirm(`Unlink this ${a.provider} account? Signing in with ${a.provider} will ask to link again.`) && unlink.mutate(undefined)}>
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

/** The running version (the image's release tag), so you know what you're on before upgrading. */
function Version() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<{ version: string }>('/health'), staleTime: Infinity })
  if (!health.data) return null
  const v = health.data.version
  return <span className="num text-xs text-stone-500">Raftaar {v === 'dev' ? 'dev build' : `v${v}`}</span>
}
