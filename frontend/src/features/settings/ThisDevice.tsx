import { DeviceMobile, DownloadSimple, Export, PaperPlaneTilt, Trash } from '@phosphor-icons/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'
import { ago } from '@/lib/format'
import { canInstall, currentSubscription, deviceLabel, install, isInstalled, isIos, onInstallChange, pushSupport, subscribe, unsubscribe, type PushSupport } from '@/lib/push'
import { refresh, usePush } from '@/lib/queries'
import { type PushDevice } from '@/lib/types'
import { deleteWithUndo, useHidden } from '@/lib/undo'
import { useSave } from '@/lib/useSave'
import { Badge, Button, Card, ErrorText, IconBadge, List, RowText, Toggle } from '@/ui'

/**
 * Settings → Notifications, first: notifications on this phone or computer itself (Web Push), and installing the
 * app, which an iPhone needs before it can have them. Then the other devices that have them on.
 */
export function ThisDevice() {
  const push = usePush()
  const support = usePushSupport()
  const [endpoint, setEndpoint] = useState<string | null>(null)
  useEffect(() => {
    if (support === 'ready') void currentSubscription().then((subscription) => setEndpoint(subscription?.endpoint ?? null))
  }, [support])
  const devices = push.data?.devices ?? []
  const mine = devices.find((device) => device.endpoint === endpoint)

  const turnOn = useSave(async () => {
    const subscription = await subscribe(push.data!.publicKey)
    if (!subscription) throw new Error('Notifications are blocked for this site. Allow them in the browser\'s settings, then try again.')
    const device = await api<PushDevice>('/push/devices', { body: { ...subscription, label: deviceLabel() } })
    setEndpoint(device.endpoint)
    return device
  }, { refresh: refresh.push, done: 'Notifications on for this device' })
  const turnOff = useSave(async () => {
    if (mine) await api(`/push/devices/${mine.id}`, { method: 'DELETE' })
    await unsubscribe()
    setEndpoint(null)
  }, { refresh: refresh.push, done: 'Notifications off for this device' })
  const test = useTestDevice()

  return (
    <div className="space-y-3">
      <Card padded raised className="space-y-3">
        <div className="flex items-center gap-3">
          <IconBadge tone="neutral" square><DeviceMobile size={20} /></IconBadge>
          <RowText title="This device">{deviceLabel()}</RowText>
        </div>
        <InstallHint support={support} />
        {support === 'ready' && (
          <>
            <Toggle checked={mine != null} onChange={(on) => (on ? turnOn.mutate(undefined) : turnOff.mutate(undefined))}
              label="Notifications here" hint="Reminders and expiring papers, as notifications on this device." />
            {mine && <Button variant="ghost" className="!py-1.5 text-xs" busy={test.isPending} onClick={() => test.mutate(mine.id)}><PaperPlaneTilt size={14} /> Send a test here</Button>}
          </>
        )}
        {support === 'unsupported' && <p className="text-sm text-stone-500">This browser can't show notifications from a site.</p>}
        {support === 'no-service-worker' && <p className="text-sm text-stone-500">Notifications on a device work in the app as installed, not here on the development server.</p>}
        <ErrorText error={turnOn.error ?? turnOff.error ?? test.error ?? push.error} />
      </Card>
      <OtherDevices devices={devices.filter((device) => device.endpoint !== endpoint)} />
    </div>
  )
}

/** Installing the app: one button where the browser offers it, the steps on an iPhone (needed there for notifications). */
function InstallHint({ support }: { support: PushSupport | null }) {
  const installable = useSyncExternalStore(onInstallChange, canInstall)
  if (isInstalled()) return null
  if (installable) {
    return <Button className="w-full" onClick={() => void install()}><DownloadSimple size={16} /> Install the app</Button>
  }
  if (isIos()) {
    return (
      <div className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm dark:bg-stone-800">
        <div className="font-medium">{support === 'add-to-home-screen' ? 'Add it to your Home Screen first' : 'Add it to your Home Screen'}</div>
        <div className="mt-1 text-stone-600 dark:text-stone-300">
          In Safari, tap <Export size={14} className="inline align-text-bottom" /> Share, then <b>Add to Home Screen</b>. Open Raftaar from there
          {support === 'add-to-home-screen' ? ', and notifications can be turned on here.' : ': it opens full screen, like an app.'}
        </div>
      </div>
    )
  }
  return null
}

/** The other phones and browsers with notifications on, each with a test and removable. */
function OtherDevices({ devices }: { devices: PushDevice[] }) {
  const hidden = useHidden()
  const test = useTestDevice()
  const list = devices.filter((device) => !hidden(`push:${device.id}`))
  if (!list.length) return null
  return (
    <List label="Other devices">
      {list.map((device) => (
        <div key={device.id} className="flex items-center gap-3 py-3 pr-2 pl-4">
          <IconBadge tone="neutral" square><DeviceMobile size={18} /></IconBadge>
          <RowText title={<span className="flex items-center gap-2">{device.label}{device.lastOk === false && <Badge tone="bad">failed</Badge>}</span>}>
            {device.lastError ?? (device.lastSentAt ? `Last sent ${ago(device.lastSentAt)}` : `Added ${ago(device.createdAt)}`)}
          </RowText>
          <Button variant="ghost" className="shrink-0 !px-2.5 !py-1.5 text-xs" busy={test.isPending && test.variables === device.id}
            onClick={() => test.mutate(device.id)} aria-label={`Send a test to ${device.label}`}>Test</Button>
          <button type="button" aria-label={`Stop notifications on ${device.label}`}
            onClick={() => deleteWithUndo({ text: 'Device removed', what: 'the device', hide: `push:${device.id}`, refresh: refresh.push,
              run: () => api(`/push/devices/${device.id}`, { method: 'DELETE' }) })}
            className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:text-red-600 active:scale-90 active:bg-red-500/10 active:text-red-600">
            <Trash size={16} />
          </button>
        </div>
      ))}
    </List>
  )
}

/** A test notification to one device. A device's row shows how its last one went, failed or not. */
function useTestDevice() {
  return useSave((id: number) => api<PushDevice>(`/push/devices/${id}/test`, { method: 'POST' }), {
    refresh: refresh.push,
    done: (device) => (device.lastOk ? `Test sent to ${device.label}: it should show in a moment` : `Test to ${device.label} failed: ${device.lastError}`),
  })
}

function usePushSupport() {
  const [support, setSupport] = useState<PushSupport | null>(null)
  useEffect(() => { void pushSupport().then(setSupport) }, [])
  return support
}
