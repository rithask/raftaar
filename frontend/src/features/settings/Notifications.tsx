import { BellSimple, Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { ago } from '@/lib/format'
import { refresh, useChannels } from '@/lib/queries'
import { type Channel } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { failed, useSave } from '@/lib/useSave'
import { AddLink, Badge, Button, Card, Code, ErrorText, Field, Input, List, Loading, Section, softSpring, Switch } from '@/ui'
import { DestinationRow, RemoveButton } from './DestinationRow'
import { TestButton } from './TestButton'
import { DeviceRow, ThisDevice, useTestDevice, useThisDevice } from './ThisDevice'

/**
 * Settings → Notifications: this device first (its notifications, and installing the app), then one list of every
 * other place they go, the other devices and the Apprise channels, each with its test; then adding a channel, when
 * you ask for it. Saved Apprise URLs are only ever shown masked: they hold tokens.
 */
export function NotificationsSection() {
  const device = useThisDevice()
  const channels = useChannels()
  const [adding, setAdding] = useState(false)
  const hidden = useHidden()
  const testDevice = useTestDevice()
  const otherDevices = device.devices.filter((other) => other.endpoint !== device.endpoint && !hidden(`push:${other.id}`))
  const channelList = (channels.data?.channels ?? []).filter((channel) => channel.id == null || !hidden(`channel:${channel.id}`))
  const count = otherDevices.length + channelList.length

  return (
    <section className="space-y-5">
      <ThisDevice state={device} />
      <Section title="Also sent to" meta={count ? String(count) : undefined} action={!adding && <AddLink label="Add channel" onClick={() => setAdding(true)} />}>
        {channels.isLoading ? <Loading /> : count > 0 ? (
          <List label="Where notifications go">
            {otherDevices.map((other) => <DeviceRow key={`device-${other.id}`} device={other} test={testDevice} />)}
            {channelList.map((channel, i) => <ChannelRow key={channel.id ?? `env-${i}`} channel={channel} />)}
          </List>
        ) : !adding && (
          <p className="px-1 text-sm text-stone-500">Nowhere else yet. Turn notifications on on your other devices, or add a channel: Telegram, ntfy, email and many more, through Apprise.</p>
        )}
        <AnimatePresence initial={false}>
          {adding && <AddChannel key="add" appriseAvailable={channels.data?.apprise != null} onClose={() => setAdding(false)} />}
        </AnimatePresence>
        {channelList.length > 0 && !channels.data?.apprise && <AppriseMissing />}
        {channels.data?.apprise && channelList.length > 0 && <p className="px-1 text-xs text-stone-500">{channels.data.apprise}</p>}
      </Section>
    </section>
  )
}

/** An Apprise channel: its masked URL and how the last one went, a test, on or off, and removing it. */
function ChannelRow({ channel }: { channel: Channel }) {
  const name = channel.label ?? channel.service
  const test = useSave(() => api<Channel>(`/notifications/channels/${channel.id}/test`, { method: 'POST' }), {
    refresh: refresh.channels,
    done: (tested) => (tested.lastOk ? `Test sent to ${name}` : failed(`Test to ${name} failed: ${tested.lastError}`)),
  })
  const toggle = useSave((enabled: boolean) => api(`/notifications/channels/${channel.id}`, { method: 'PUT', body: { enabled } }), {
    refresh: refresh.channels, done: (_, enabled) => (enabled ? `Reminders go to ${name} again` : `${name} paused`),
  })
  const editable = channel.id != null
  return (
    <DestinationRow icon={<BellSimple size={18} />} title={name} failed={channel.lastOk === false}
      badges={<>{channel.fromEnvironment && <Badge className="shrink-0">fixed</Badge>}{editable && !channel.enabled && <Badge className="shrink-0">paused</Badge>}</>}
      detail={channel.lastError ?? [channel.masked, channel.lastSentAt ? `last sent ${ago(channel.lastSentAt)}` : null].filter(Boolean).join(' · ')}>
      {editable && (
        <>
          <TestButton to={name} busy={test.isPending} onClick={() => test.mutate(undefined)} />
          <Switch checked={channel.enabled} onChange={(on) => toggle.mutate(on)} label={`Send reminders to ${name}`} />
          <RemoveButton what={name} onClick={() => deleteWithUndo({
            refresh: refresh.channels, text: 'Channel removed', what: 'the channel', hide: `channel:${channel.id}`,
            run: () => api(`/notifications/channels/${channel.id}`, { method: 'DELETE' }),
          })} />
        </>
      )}
    </DestinationRow>
  )
}

/** Adding an Apprise channel: a name and its URL, with where to find the URL for a service. */
function AddChannel({ appriseAvailable, onClose }: { appriseAvailable: boolean; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const add = useSave(() => api('/notifications/channels', { body: { label, url } }), { refresh: refresh.channels, onDone: onClose, done: 'Channel added' })
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
      <Card padded raised className="space-y-3">
        <p className="text-sm text-stone-500">
          An Apprise URL for where you want reminders, e.g. <Code>ntfys://ntfy.sh/your-topic</Code>.{' '}
          <a className="underline active:opacity-60" href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank" rel="noreferrer">See all services</a>
        </p>
        {!appriseAvailable && <AppriseMissing />}
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My phone" /></Field>
          <Field label="Apprise URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ntfys://ntfy.sh/my-topic" autoComplete="off" spellCheck={false} autoCapitalize="none" autoFocus /></Field>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" busy={add.isPending} disabled={!url.trim()} onClick={() => add.mutate(undefined)}><Plus size={16} /> Add channel</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
        <ErrorText error={add.error} />
      </Card>
    </motion.div>
  )
}

function AppriseMissing() {
  return (
    <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
      Apprise isn't available, so channels can't be sent to (notifications on devices still work). Use the Docker image, or set <Code>APPRISE_BIN</Code>.
    </p>
  )
}
