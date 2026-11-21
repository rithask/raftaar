import { Trash, X } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { cx } from './cx'
import { easeOut, exitSoft, softSpring } from './motion'

const pendingBack = new Map<string, number>()

/**
 * A form screen. On a phone it fills the screen like a page: ✕ on the left, the title, and Save on the right,
 * where the keyboard can't cover it. On wider screens it's a centred dialog with the same bar.
 * The phone's back gesture closes it, and Enter in a field saves.
 */
export function FormScreen({
  open,
  onClose,
  title,
  children,
  onSave,
  saving,
  saveLabel = 'Save',
  onDelete,
  deleting,
  deleteLabel = 'Delete',
  saveAtBottom = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  onSave?: () => void
  saving?: boolean
  saveLabel?: string
  onDelete?: () => void
  deleting?: boolean
  deleteLabel?: string
  /** On phones, a full-width Save at the bottom, in reach of the thumb, instead of the one in the corner. */
  saveAtBottom?: boolean
}) {
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Back gesture / back button closes the form instead of leaving the page: opening adds a history entry,
  // and closing any other way removes it again.
  useEffect(() => {
    if (!open) return
    const pending = pendingBack.get(id)
    if (pending !== undefined) {
      // Unmounted and mounted again at once (React does this in development): keep the entry we already have.
      clearTimeout(pending)
      pendingBack.delete(id)
    } else {
      window.history.pushState({ ...(window.history.state ?? {}), formScreen: id }, '')
    }
    const onPop = (e: PopStateEvent) => {
      if ((e.state as { formScreen?: string } | null)?.formScreen === id) return // still on our entry
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if ((window.history.state as { formScreen?: string } | null)?.formScreen !== id) return
      // Wait a moment: if this was only a remount, the effect above cancels it.
      pendingBack.set(
        id,
        window.setTimeout(() => {
          pendingBack.delete(id)
          if ((window.history.state as { formScreen?: string } | null)?.formScreen === id) window.history.back()
        }, 0),
      )
    }
  }, [open, id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  // Rendered into <body>: a page that's mid-slide mustn't carry the form along with it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        className="absolute inset-0 hidden bg-stone-950/50 backdrop-blur-[2px] sm:block"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: exitSoft }}
      />
      <motion.form
        onSubmit={(e) => {
          e.preventDefault()
          if (!saving) onSave?.()
        }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: softSpring }}
        exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16, ease: easeOut } }}
        className="relative flex h-dvh w-full origin-bottom flex-col bg-white sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:origin-center sm:rounded-3xl sm:shadow-2xl dark:bg-stone-900"
      >
        <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-stone-900/5 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-3 sm:pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2.5 text-stone-600 transition active:scale-90 active:bg-stone-200 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 dark:active:bg-stone-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <h2 className="truncate text-center text-base font-semibold">{title}</h2>
          {onSave ? (
            <Button type="submit" variant="primary" className={cx('!rounded-full !px-4 !py-2', saveAtBottom && 'max-sm:invisible')} busy={saving} tabIndex={saveAtBottom ? -1 : undefined}>
              {saveLabel}
            </Button>
          ) : (
            <span className="w-10" />
          )}
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
          <motion.div className="mx-auto max-w-lg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...softSpring, delay: 0.04 } }}>
            {children}
            {onDelete && (
              <div className="mt-8 border-t border-stone-900/5 pt-4 dark:border-white/10">
                <Button variant="danger" className="w-full" busy={deleting} onClick={onDelete}>
                  <Trash size={16} /> {deleteLabel}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
        {onSave && saveAtBottom && (
          <div className="shrink-0 border-t border-stone-900/5 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden dark:border-white/10 dark:bg-stone-900">
            <Button type="submit" variant="primary" className="w-full !rounded-2xl !py-3.5 text-base" busy={saving}>{saveLabel}</Button>
          </div>
        )}
      </motion.form>
    </div>,
    document.body,
  )
}
