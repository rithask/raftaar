import { DeviceMobile, DownloadSimple, Export } from '@phosphor-icons/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'
import { ago } from '@/lib/format'
import { canInstall, currentSubscription, deviceLabel, install, isInstalled, isIos, onInstallChange, pushSupport, subscribe, unsubscribe, type PushSupport } from '@/lib/push'
import { refresh, usePush } from '@/lib/queries'
import { type PushDevice } from '@/lib/types'
import { deleteWithUndo } from '@/lib/undo'
import { failed, useSave } from '@/lib/useSave'
import { Button, Card, ErrorText, IconBadge, RowText, Toggle } from '@/ui'
import { DestinationRow, RemoveButton } from './DestinationRow'
import { TestButton } from './TestButton'

/**
 * This phone or computer and its notifications by Web Push: what it can do, the server's key, and which of the
 * devices on the server it is (by its push address).
 */
export function useThisDevice() {
  const push = usePush()
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  useEffect(() => { void pushSupport().then(setSupport) }, [])
  useEffect(() => {
    if (support === 'ready') void currentSubscription().then((subscription) => setEndpoint(subscription?.endpoint ?? null))
  }, [support])
  const devices = push.data?.devices ?? []
  return { push, support, endpoint, setEndpoint, devices, mine: devices.find((device) => device.endpoint === endpoint) }
}
type ThisDeviceState = ReturnType<typeof useThisDevice>

/**
 * Settings → Notifications, first: notifications on this phone or computer itself, and installing the app, which an
 * iPhone needs before it can have them.
 */
export function ThisDevice({ state: { push, support, setEndpoint, mine } }: { state: ThisDeviceState }) {
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
    <Card padded raised className="space-y-3">
      <div className="flex items-center gap-3">
        <IconBadge tone="neutral" square><DeviceMobile size={20} /></IconBadge>
        <RowText title="This device">{deviceLabel()}</RowText>
        {mine && <TestButton to="this device" busy={test.isPending} onClick={() => test.mutate(mine.id)} />}
      </div>
      <InstallHint support={support} />
      {support === 'ready' && (
        <Toggle checked={mine != null} onChange={(on) => (on ? turnOn.mutate(undefined) : turnOff.mutate(undefined))}
          label="Notifications here" hint="Reminders and expiring papers, as notifications on this device." />
      )}
      {support === 'unsupported' && <p className="text-sm text-stone-500">This browser can't show notifications from a site.</p>}
      {support === 'no-service-worker' && <p className="text-sm text-stone-500">Notifications on a device work in the app as installed, not here on the development server.</p>}
      <ErrorText error={turnOn.error ?? turnOff.error ?? test.error ?? push.error} />
    </Card>
  )
}

/** Another phone or browser with notifications on: how its last one went, a test, and removing it. */
export function DeviceRow({ device, test }: { device: PushDevice; test: ReturnType<typeof useTestDevice> }) {
  return (
    <DestinationRow icon={<DeviceMobile size={18} />} title={device.label} failed={device.lastOk === false}
      detail={device.lastError ?? (device.lastSentAt ? `Last sent ${ago(device.lastSentAt)}` : `Added ${ago(device.createdAt)}`)}>
      <TestButton to={device.label} busy={test.isPending && test.variables === device.id} onClick={() => test.mutate(device.id)} />
      <RemoveButton what={`notifications on ${device.label}`} onClick={() => deleteWithUndo({
        text: 'Device removed', what: 'the device', hide: `push:${device.id}`, refresh: refresh.push,
        run: () => api(`/push/devices/${device.id}`, { method: 'DELETE' }),
      })} />
    </DestinationRow>
  )
}

/** A test notification to one device. A device's row shows how its last one went, failed or not. */
export function useTestDevice() {
  return useSave((id: number) => api<PushDevice>(`/push/devices/${id}/test`, { method: 'POST' }), {
    refresh: refresh.push,
    done: (device) => (device.lastOk ? `Test sent to ${device.label}` : failed(`Test to ${device.label} failed: ${device.lastError}`)),
  })
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
