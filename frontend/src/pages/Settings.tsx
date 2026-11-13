import { ArrowsClockwise, Bell, CheckCircle, GasPump, MapPin, Path, Plus, SignOut, Trash, Wallet, XCircle } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api, type Channel, type ChannelList, type FuelPrice, type FuelType, type Integration } from '../api'
import { Badge, Button, ErrorText, Field, Input, Loading, Panel, Select, Toggle } from '../components/ui'
import { ago, date, fuelLabel, money2, num } from '../format'
import { INDIAN_STATES, useSave } from '../hooks'

const META: Record<Integration['name'], { title: string; icon: ReactNode; off: ReactNode; what: string; run?: string }> = {
  geopulse: { title: 'GeoPulse', icon: <Path size={20} />, off: <>Set <Code>GEOPULSE_URL</Code> and <Code>GEOPULSE_TOKEN</Code> to connect.</>, what: 'Brings in your trips and spots stops at fuel pumps.', run: 'Sync now' },
  hisaab: { title: 'Hisaab', icon: <Wallet size={20} />, off: <>Set <Code>HISAAB_URL</Code> and <Code>HISAAB_TOKEN</Code> to connect.</>, what: 'Brings in your fuel payments.', run: 'Sync now' },
  alerts: { title: 'Daily reminders', icon: <Bell size={20} />, off: 'Add a notification channel below to turn these on.', what: 'Due services and expiring papers, every morning.', run: 'Check now' },
  osm: { title: 'Pump & state lookup', icon: <MapPin size={20} />, off: <>Turned off with <Code>OSM_LOOKUPS_ENABLED</Code>.</>, what: 'Uses OpenStreetMap to name the pump and state for a fill-up.' },
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 text-[11px] dark:bg-stone-800">{children}</code>
}

export function SettingsPage() {
  const qc = useQueryClient()
  const integrations = useQuery({ queryKey: ['integrations'], queryFn: () => api<Integration[]>('/integrations'), refetchInterval: 10_000 })
  const run = useSave((name: string) => api<{ result: string }>(`/integrations/${name}/run`, { method: 'POST' }), undefined, (r) => r.result)
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    qc.setQueryData(['me'], null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] leading-none font-bold tracking-tight">Settings</h1>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-500">Connections</h2>
        {integrations.isLoading && <Loading />}
        {integrations.data?.map((i) => {
          const m = META[i.name]
          const s = i.status
          return (
            <Panel key={i.name} className="space-y-2">
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
            </Panel>
          )
        })}
        <ErrorText error={run.error} />
      </section>

      <NotificationChannels />

      <FuelPrices />

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={logout}><SignOut size={16} /> Sign out</Button>
        <Version />
      </div>
    </div>
  )
}

function FuelPrices() {
  const prices = useQuery({ queryKey: ['fuel-prices'], queryFn: () => api<FuelPrice[]>('/fuel-prices') })
  const [f, setF] = useState({ region: '', district: '', fuelType: 'PETROL' as FuelType, price: '' })
  const add = useSave(() => api('/fuel-prices', { body: { ...f, district: f.district || null, price: num(f.price) } }), () => setF((o) => ({ ...o, price: '' })), 'Price saved')
  const del = useSave((id: number) => api(`/fuel-prices/${id}`, { method: 'DELETE' }), undefined, 'Price removed')
  const src = { MANUAL: 'you', FILL_UP: 'fill-up', LOOKUP: 'looked up' } as const
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-stone-500"><GasPump size={16} /> Fuel prices</h2>
      <p className="text-sm text-stone-500">Picked up from your fill-ups. Set one here when prices change.</p>
      <Panel className="space-y-3">
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
      </Panel>
      {(prices.data?.length ?? 0) > 0 && (
        <div className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">
          {prices.data!.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.region}{p.district ? `, ${p.district}` : ''} · {fuelLabel[p.fuelType]}</div>
                <div className="text-xs text-stone-500">{date(p.effectiveAt)} · {src[p.source]}</div>
              </div>
              <div className="num font-semibold">{money2(p.price)}</div>
              <button onClick={() => del.mutate(p.id)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove price"><Trash size={16} /></button>
            </div>
          ))}
        </div>
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
  const del = useSave((id: number) => api(`/notifications/channels/${id}`, { method: 'DELETE' }), undefined, 'Channel removed')
  const data = list.data

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-stone-500"><Bell size={16} /> Notifications</h2>
      <p className="text-sm text-stone-500">
        Add an Apprise URL for each place you want reminders, e.g. <Code>ntfys://ntfy.sh/your-topic</Code>.{' '}
        <a className="underline active:opacity-60" href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank" rel="noreferrer">See all services</a>
      </p>
      {data && !data.apprise && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">Apprise isn't available, so nothing can be sent. Use the Docker image, or set <Code>APPRISE_BIN</Code>.</p>
      )}
      <Panel className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My phone" /></Field>
          <Field label="Apprise URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ntfys://ntfy.sh/my-topic" autoComplete="off" spellCheck={false} autoCapitalize="none" /></Field>
        </div>
        <Button variant="primary" busy={add.isPending} disabled={!url.trim()} onClick={() => add.mutate(undefined)}><Plus size={16} /> Add channel</Button>
        <ErrorText error={add.error} />
      </Panel>
      {list.isLoading && <Loading />}
      {data && data.channels.length > 0 && (
        <div className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5 dark:divide-white/5 dark:bg-stone-900 dark:ring-white/10">
          {data.channels.map((c, i) => (
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
                    <button onClick={() => confirm('Remove this channel?') && del.mutate(c.id!)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove channel"><Trash size={16} /></button>
                  </>
                )}
              </div>
              {c.id != null && <Toggle checked={c.enabled} onChange={(v) => toggle.mutate({ id: c.id!, enabled: v })} label="Send reminders here" />}
              {c.lastError && <p className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-400">{c.lastError}</p>}
              {c.lastSentAt && <p className="text-xs text-stone-500">Last sent {ago(c.lastSentAt)}</p>}
            </div>
          ))}
        </div>
      )}
      {data?.apprise && <p className="text-xs text-stone-500">{data.apprise}</p>}
      <ErrorText error={test.error ?? toggle.error ?? del.error} />
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
