import { ArrowsClockwise, Bell, CheckCircle, MapPin, Path, Wallet, XCircle } from '@phosphor-icons/react'
import { type ReactNode } from 'react'
import { api } from '@/lib/api'
import { ago } from '@/lib/format'
import { type Integration } from '@/lib/types'
import { useSave } from '@/lib/useSave'
import { Badge, Button, Card, ErrorText, Loading , Code } from '@/ui'
import { refresh, useIntegrations } from '@/lib/queries'

/** What each connection is, how to turn it on, and what running it now does. */
export const META: Record<Integration['name'], { title: string; icon: ReactNode; off: ReactNode; what: string; run?: string }> = {
  geopulse: { title: 'GeoPulse', icon: <Path size={20} />, off: <>Set <Code>GEOPULSE_URL</Code> and <Code>GEOPULSE_TOKEN</Code> to connect.</>, what: 'Brings in your trips and spots stops at fuel pumps.', run: 'Sync now' },
  hisaab: { title: 'Hisaab', icon: <Wallet size={20} />, off: <>Set <Code>HISAAB_URL</Code> and <Code>HISAAB_TOKEN</Code> to connect.</>, what: 'Brings in your fuel payments.', run: 'Sync now' },
  alerts: { title: 'Daily reminders', icon: <Bell size={20} />, off: 'Add a notification channel below to turn these on.', what: 'Due services and expiring papers, every morning.', run: 'Check now' },
  osm: { title: 'Pump & state lookup', icon: <MapPin size={20} />, off: <>Set <Code>OVERPASS_URL</Code> to name pumps, <Code>NOMINATIM_URL</Code> to find the state.</>, what: 'Uses OpenStreetMap to name the pump and state for a fill-up.' },
}

/** GeoPulse, Hisaab, the daily reminders and the pump lookup: whether each is on, and its last run. */
export function Connections() {
  const integrations = useIntegrations(true)
  const run = useSave((name: string) => api<{ result: string }>(`/integrations/${name}/run`, { method: 'POST' }), { refresh: refresh.integrations, done: (r) => r.result })
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
