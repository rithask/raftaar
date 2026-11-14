import '@fontsource-variable/inter'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toasts } from './components/toast'

// Offline is handled by the app itself: data loads are still tried (the service worker answers from what it
// kept), and saves always run (a fill-up goes to the outbox; others say there's no connection) instead of
// waiting silently for the network.
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ErrorBoundary fallback="app">
            <App />
          </ErrorBoundary>
          <Toasts />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)

// Lets the app open without a connection, so a fill-up can be logged at a pump with no signal (public/sw.js).
// Production builds only: in development it would serve stale files over the live reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
