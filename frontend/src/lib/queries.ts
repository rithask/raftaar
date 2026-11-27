import { queryOptions, useInfiniteQuery, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from './api'
import type { AccountView, ChannelList, DocView, FuelPrice, Garage, HandledPage, ImportBatch, Inbox, SearchHit, Integration, OdometerReading, Vehicle, VehiclePageData } from './types'

/**
 * Every piece of server data the app reads, by name: its cache key and where it comes from. A key that's a prefix
 * of another covers it too (keys.vehiclePages covers every vehicle's page).
 */
export const keys = {
  me: ['me'] as const,
  garage: ['garage'] as const,
  vehicles: ['vehicles'] as const,
  vehiclePages: ['vehicle-page'] as const,
  vehiclePage: (vehicleId: number) => ['vehicle-page', vehicleId] as const,
  odometerHistories: ['odometer'] as const,
  odometerHistory: (vehicleId: number) => ['odometer', vehicleId] as const,
  documents: ['documents'] as const,
  inbox: ['inbox'] as const,
  handled: ['inbox', 'handled'] as const, // under inbox: whatever refreshes the Inbox refreshes this too
  integrations: ['integrations'] as const,
  searches: ['search'] as const,
  imports: ['imports'] as const,
  search: (words: string) => ['search', words] as const,
  channels: ['channels'] as const,
  fuelPrices: ['fuel-prices'] as const,
  account: ['account'] as const,
  health: ['health'] as const,
}

/**
 * What a change can make out of date, for useSave and deleteWithUndo: only these are fetched again (the ones on
 * screen straight away, the rest when next shown), rather than everything.
 */
export const refresh = {
  /** A fill-up, service, reminder, expense or reading: the vehicle's page, the garage's figures, the inbox's issues, search results. */
  vehicleRecords: [keys.vehiclePages, keys.garage, keys.odometerHistories, keys.inbox, keys.searches],
  /** A paper: also the Papers page. */
  papers: [keys.vehiclePages, keys.garage, keys.documents, keys.searches],
  /** A vehicle itself (name, photo, order, removed): everywhere it's shown. */
  vehicles: [keys.vehicles, keys.garage, keys.vehiclePages, keys.documents, keys.inbox, keys.searches],
  /** Trips and suggestions sorted in the Inbox: they land on vehicles. */
  inbox: [keys.inbox, keys.garage, keys.vehiclePages],
  integrations: [keys.integrations, keys.inbox, keys.garage],
  channels: [keys.channels, keys.integrations],
  fuelPrices: [keys.fuelPrices],
  account: [keys.account, keys.me],
  /** An import, or removing one: records and vehicles anywhere. */
  imported: [keys.imports, keys.vehicles, keys.garage, keys.vehiclePages, keys.documents, keys.odometerHistories, keys.inbox, keys.searches],
} satisfies Record<string, readonly QueryKey[]>

export const garageQuery = queryOptions({ queryKey: keys.garage, queryFn: () => api<Garage>('/garage') })
export const vehiclePageQuery = (vehicleId: number) =>
  queryOptions({ queryKey: keys.vehiclePage(vehicleId), queryFn: () => api<VehiclePageData>(`/vehicles/${vehicleId}/page`) })

export const useGarage = () => useQuery(garageQuery)
export const useVehicles = () => useQuery({ queryKey: keys.vehicles, queryFn: () => api<Vehicle[]>('/vehicles') })
export const useVehiclePage = (vehicleId: number) => useQuery(vehiclePageQuery(vehicleId))
export const useOdometerHistory = (vehicleId: number) =>
  useQuery({ queryKey: keys.odometerHistory(vehicleId), queryFn: () => api<OdometerReading[]>(`/vehicles/${vehicleId}/odometer`) })
export const useDocuments = () => useQuery({ queryKey: keys.documents, queryFn: () => api<DocView[]>('/documents') })
export const useInbox = () => useQuery({ queryKey: keys.inbox, queryFn: () => api<Inbox>('/inbox') })
/** Records matching {@code words} (2 letters or more), keeping the last results on screen while the next arrive. */
export const useSearch = (words: string) =>
  useQuery({
    queryKey: keys.search(words),
    queryFn: () => api<SearchHit[]>(`/search?q=${encodeURIComponent(words)}`),
    enabled: words.length >= 2,
    placeholderData: (previous) => previous,
  })
export const useImports = () => useQuery({ queryKey: keys.imports, queryFn: () => api<ImportBatch[]>('/imports') })
/** The Inbox's Done list, a page at a time, newest first. */
export const useHandled = () =>
  useInfiniteQuery({
    queryKey: keys.handled,
    queryFn: ({ pageParam }) => api<HandledPage>(`/inbox/handled${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
  })
/** {@code live}: checked every 10 seconds, for the screen that shows a sync running. */
export const useIntegrations = (live = false) =>
  useQuery({ queryKey: keys.integrations, queryFn: () => api<Integration[]>('/integrations'), refetchInterval: live ? 10_000 : false })
export const useChannels = () => useQuery({ queryKey: keys.channels, queryFn: () => api<ChannelList>('/notifications/channels') })
export const useFuelPrices = () => useQuery({ queryKey: keys.fuelPrices, queryFn: () => api<FuelPrice[]>('/fuel-prices') })
export const useAccount = () => useQuery({ queryKey: keys.account, queryFn: () => api<AccountView>('/account') })
export const useHealth = () => useQuery({ queryKey: keys.health, queryFn: () => api<{ version: string }>('/health'), staleTime: Infinity })

/**
 * Starts loading a vehicle's page as soon as a finger or pointer lands on a link to it, so it's usually there by the
 * time the tap ends. Does nothing when it's already loaded and fresh.
 */
export function usePrefetchVehicle() {
  const queryClient = useQueryClient()
  return useCallback((vehicleId: number) => void queryClient.prefetchQuery({ ...vehiclePageQuery(vehicleId), staleTime: 30_000 }), [queryClient])
}
