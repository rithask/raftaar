import { Bell, CaretLeft, CaretRight, Database, GasPump, LinkSimple, SignOut, UserCircle } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { signOut } from '@/features/auth/session'
import { DataSection } from '@/features/data/DataSection'
import { AccountSection } from './AccountSection'
import { Connections, META } from './Connections'
import { FuelPrices } from './FuelPrices'
import { NotificationChannels } from './NotificationChannels'
import { Button, cx, IconBadge, List, PageHeader, rowPress } from '@/ui'
import { keys, useAccount, useChannels, useFuelPrices, useHealth, useIntegrations, usePush } from '@/lib/queries'

type Key = 'connections' | 'notifications' | 'fuel-prices' | 'data' | 'account'
const SECTIONS: { key: Key; title: string; icon: ReactNode }[] = [
  { key: 'connections', title: 'Connections', icon: <LinkSimple size={20} /> },
  { key: 'notifications', title: 'Notifications', icon: <Bell size={20} /> },
  { key: 'fuel-prices', title: 'Fuel prices', icon: <GasPump size={20} /> },
  { key: 'data', title: 'Data', icon: <Database size={20} /> },
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
        {open.key === 'data' && <DataSection />}
        {open.key === 'account' && <AccountSection />}
      </div>
    </div>
  )
}

/** Each section with a one-line summary, then sign out and the version. */
function SectionList({ active }: { active?: Key }) {
  const queryClient = useQueryClient()
  const integrations = useIntegrations()
  const channels = useChannels()
  const prices = useFuelPrices()
  const account = useAccount()
  const failing = (integrations.data ?? []).filter((i) => i.status.lastError)
  const on = (integrations.data ?? []).filter((i) => i.configured).length
  const push = usePush()
  const nChannels = channels.data?.channels.length ?? 0
  const nDevices = push.data?.devices.length ?? 0
  const summary: Record<Key, ReactNode> = {
    connections: !integrations.data ? '' : failing.length
      ? <span className="text-red-600 dark:text-red-400">{META[failing[0].name].title} is failing</span>
      : `${on} of ${integrations.data.length} on`,
    notifications: !channels.data ? '' : nChannels + nDevices === 0 ? 'Not set up yet'
      : [nDevices ? `${nDevices} device${nDevices === 1 ? '' : 's'}` : null, nChannels ? `${nChannels} channel${nChannels === 1 ? '' : 's'}` : null].filter(Boolean).join(', '),
    'fuel-prices': !prices.data ? '' : prices.data.length === 0 ? 'None yet' : prices.data.length === 1 ? '1 state' : `${prices.data.length} prices`,
    data: 'Export and import',
    account: account.data?.username ?? '',
  }
  const logout = async () => {
    await signOut()
    queryClient.setQueryData(keys.me, null)
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

/** The running version (the image's release tag), so you know what you're on before upgrading. */
function Version() {
  const health = useHealth()
  if (!health.data) return null
  const v = health.data.version
  return <span className="num text-xs text-stone-500">Raftaar {v === 'dev' ? 'dev build' : `v${v}`}</span>
}
