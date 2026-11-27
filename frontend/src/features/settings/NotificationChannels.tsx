import { CheckCircle, Plus, Trash, XCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { ago } from '@/lib/format'
import { type Channel } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Badge, Button, Card, ErrorText, Field, Input, List, Loading, Toggle , Code } from '@/ui'
import { refresh, useChannels } from '@/lib/queries'

import { ThisDevice } from './ThisDevice'

/** Where notifications go: this device and others (Web Push), then Apprise URLs, only ever shown masked (they hold tokens). */
export function NotificationChannels() {
  const list = useChannels()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const add = useSave(() => api('/notifications/channels', { body: { label, url } }), { refresh: refresh.channels, onDone: () => {
    setLabel('')
    setUrl('')
  }, done: 'Channel added' })
  const test = useSave((id: number) => api<Channel>(`/notifications/channels/${id}/test`, { method: 'POST' }), { refresh: refresh.channels, done: (channel) => (channel.lastOk ? 'Test sent' : 'Test failed') })
  const toggle = useSave((c: { id: number; enabled: boolean }) => api(`/notifications/channels/${c.id}`, { method: 'PUT', body: { enabled: c.enabled } }), { refresh: refresh.channels })
  const hidden = useHidden()
  const remove = (channel: Channel) => deleteWithUndo({ refresh: refresh.channels, text: 'Channel removed', what: 'the channel', hide: `channel:${channel.id}`, run: () => api(`/notifications/channels/${channel.id}`, { method: 'DELETE' }) })
  const data = list.data

  return (
    <section className="space-y-3">
      <ThisDevice />
      <h3 className="pt-3 text-sm font-semibold">Other places, through Apprise</h3>
      <p className="text-sm text-stone-500">
        Add an Apprise URL for each place you want reminders, e.g. <Code>ntfys://ntfy.sh/your-topic</Code>.{' '}
        <a className="underline active:opacity-60" href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank" rel="noreferrer">See all services</a>
      </p>
      {data && !data.apprise && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">Apprise isn't available, so these channels can't be sent to (notifications on devices still work). Use the Docker image, or set <Code>APPRISE_BIN</Code>.</p>
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
          {data.channels.filter((channel) => channel.id == null || !hidden(`channel:${channel.id}`)).map((channel, i) => (
            <div key={channel.id ?? `env-${i}`} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {channel.label ?? channel.service}
                    {channel.fromEnvironment && <Badge>fixed</Badge>}
                    {channel.lastOk === true && <Badge tone="ok"><CheckCircle size={12} /> worked</Badge>}
                    {channel.lastOk === false && <Badge tone="bad"><XCircle size={12} /> failed</Badge>}
                  </div>
                  <div className="truncate font-mono text-xs text-stone-500">{channel.masked}</div>
                </div>
                {channel.id != null && (
                  <>
                    <Button variant="ghost" className="!py-1.5 text-xs" busy={test.isPending && test.variables === channel.id} onClick={() => test.mutate(channel.id!)}>Test</Button>
                    <button onClick={() => remove(channel)} className="-m-1 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600" aria-label="Remove channel"><Trash size={16} /></button>
                  </>
                )}
              </div>
              {channel.id != null && <Toggle checked={channel.enabled} onChange={(v) => toggle.mutate({ id: channel.id!, enabled: v })} label="Send reminders here" />}
              {channel.lastError && <p className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-400">{channel.lastError}</p>}
              {channel.lastSentAt && <p className="text-xs text-stone-500">Last sent {ago(channel.lastSentAt)}</p>}
            </div>
          ))}
        </List>
      )}
      {data?.apprise && <p className="text-xs text-stone-500">{data.apprise}</p>}
      <ErrorText error={test.error ?? toggle.error} />
    </section>
  )
}
