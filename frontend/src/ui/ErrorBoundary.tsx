import { ArrowClockwise, WarningOctagon } from '@phosphor-icons/react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Keeps one broken part of the page from blanking the whole app. Without this React unmounts everything on an
 * error while rendering, navigation included.
 *
 * - {@code resetKey}: when it changes (e.g. the route), the boundary tries again by itself.
 * - {@code fallback}: "section" (a card in place of the part that failed), "page" (in place of the page, the
 *   navigation around it stays), or "app" (the whole screen, with a reload).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown; fallback?: 'section' | 'page' | 'app' }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Raftaar: a part of the page failed', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const kind = this.props.fallback ?? 'page'
    const retry = () => (kind === 'app' ? window.location.reload() : this.setState({ error: null }))
    return <Failed kind={kind} message={this.state.error.message} onRetry={retry} />
  }
}

function Failed({ kind, message, onRetry }: { kind: 'section' | 'page' | 'app'; message: string; onRetry: () => void }) {
  const what = kind === 'section' ? "This part couldn't be shown." : kind === 'page' ? "This page couldn't be shown." : 'Raftaar ran into a problem.'
  return (
    <div role="alert" className={kind === 'app' ? 'flex min-h-dvh items-center justify-center p-6' : kind === 'page' ? 'py-16' : ''}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-white px-6 py-8 text-center ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10">
        <WarningOctagon size={36} className="text-red-500" />
        <p className="font-medium">{what}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {kind === 'app' ? 'Reloading usually fixes it.' : 'Your data is safe. Try again, or go to another page.'}
        </p>
        <details className="w-full text-left text-xs text-stone-400">
          <summary className="cursor-pointer text-center">Details</summary>
          <p className="mt-2 break-words font-mono">{message || 'Unknown error'}</p>
        </details>
        <button type="button" onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition active:scale-95">
          <ArrowClockwise size={16} /> {kind === 'app' ? 'Reload' : 'Try again'}
        </button>
      </div>
    </div>
  )
}
