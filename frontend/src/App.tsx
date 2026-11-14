import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { api } from './api'
import { startOutbox } from './outbox'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { GaragePage } from './pages/Garage'
import { InboxPage } from './pages/Inbox'
import { Login } from './pages/Login'
import { PapersPage } from './pages/Papers'
import { SettingsPage } from './pages/Settings'
import { VehiclePage } from './pages/Vehicle'

export function App() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ username: string | null }>('/auth/me'), retry: false, staleTime: Infinity })
  useEffect(() => {
    const off = () => qc.setQueryData(['me'], null)
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
