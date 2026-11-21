import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Login } from '@/features/auth/LoginPage'
import { GaragePage } from '@/features/garage/GaragePage'
import { InboxPage } from '@/features/inbox/InboxPage'
import { PapersPage } from '@/features/papers/PapersPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { VehiclePage } from '@/features/vehicle/VehiclePage'
import { api } from '@/lib/api'
import { startOutbox } from '@/lib/outbox'
import { Layout } from './Layout'
import { Loading } from '@/ui'
import { keys } from '@/lib/queries'

export function App() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: keys.me, queryFn: () => api<{ username: string | null }>('/auth/me'), retry: false, staleTime: Infinity })
  useEffect(() => {
    const off = () => qc.setQueryData(keys.me, null)
    window.addEventListener('raftaar:unauthorized', off)
    return () => window.removeEventListener('raftaar:unauthorized', off)
  }, [qc])

  // fill-ups saved offline are sent once signed in (and whenever the connection comes back)
  const signedIn = !!me.data?.username
  useEffect(() => (signedIn ? startOutbox(qc) : undefined), [signedIn, qc])

  if (me.isLoading) return <Loading />
  if (!me.data?.username) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<GaragePage />} />
        <Route path="vehicles/:id" element={<VehiclePage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/:section" element={<SettingsPage />} />
        <Route path="*" element={<GaragePage />} />
      </Route>
    </Routes>
  )
}
