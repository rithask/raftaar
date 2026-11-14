import { Trash, X } from '@phosphor-icons/react'
import { motion, type Transition, type Variants } from 'motion/react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---- motion ----------------------------------------------------------------------------------------------

/** The app's one spring: quick, with a little give at the end. */
export const spring: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }
export const softSpring: Transition = { type: 'spring', stiffness: 320, damping: 30 }

/** Lists that fade in one row after another. Put {@code variants={listParent}} on the list and
 * {@code variants={listItem}} on each row. */
export const listParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } } }
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: softSpring },
}

/** Pressed: quick in, springy out (the release overshoots a touch instead of snapping back). */
const press = 'transition-[transform,background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:duration-75 active:ease-out'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ variant = 'secondary', className, busy, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50',
        press,
        variant === 'primary' && 'bg-accent text-on-accent shadow-sm shadow-black/15 hover:bg-accent-hover active:bg-accent-hover active:shadow-none',
        variant === 'secondary' && 'bg-stone-200/80 text-stone-900 hover:bg-stone-300/80 active:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:active:bg-stone-700',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-200/70 active:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800 dark:active:bg-stone-800',
        variant === 'danger' && 'bg-red-600/10 text-red-700 hover:bg-red-600/20 active:bg-red-600/25 dark:text-red-400',
        className,
      )}
    >
      {busy ? (
        <>
          <Spinner /> <span className="sr-only">Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-900 dark:ring-white/10', className)}>{children}</div>
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
    </label>
  )
}

const control =
  'w-full rounded-xl border-0 bg-stone-100 px-3 py-2.5 text-stone-900 ring-1 ring-stone-900/10 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-accent dark:bg-stone-800 dark:text-stone-100 dark:ring-white/10'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, 'appearance-none', props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={cx(control, props.className)} />
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full select-none items-start gap-3 rounded-xl py-1 text-left"
    >
      <span className={cx('mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200', checked ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-700')}>
        {/* the knob springs across; it stretches a little while you hold it */}
        <motion.span
          initial={false}
          animate={{ x: checked ? 16 : 0 }}
          transition={spring}
          className={cx('h-5 w-5 rounded-full shadow transition-[width,margin] duration-150 group-active:w-6 group-aria-checked:group-active:-ml-1', checked ? 'bg-on-accent' : 'bg-white')}
        />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, tabs }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; tabs?: boolean }) {
  const pill = useId()
  return (
    <div
      role={tabs ? 'tablist' : undefined}
      className={cx(
        'flex gap-1 overflow-x-auto rounded-xl bg-stone-200/70 p-1 [scrollbar-width:none] dark:bg-stone-800 [&::-webkit-scrollbar]:hidden',
        // a soft right edge on phones says "there's more this way"
        tabs && 'max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)]',
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          role={tabs ? 'tab' : undefined}
          aria-selected={tabs ? value === o.value : undefined}
          aria-pressed={tabs ? undefined : value === o.value}
          ref={(el) => {
            // keep the chosen tab in view by scrolling the strip only (never the page)
            const strip = el?.parentElement
            if (!el || !strip || value !== o.value) return
            if (el.offsetLeft < strip.scrollLeft || el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
              strip.scrollLeft = el.offsetLeft - 8
            }
          }}
          className={cx(
            'relative flex-1 shrink-0 select-none whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium active:scale-95',
            press,
            value === o.value ? 'text-stone-900 dark:text-stone-100' : 'text-stone-600 active:bg-stone-300/60 dark:text-stone-400 dark:active:bg-stone-700',
          )}
        >
          {/* the white highlight slides to the chosen option */}
          {value === o.value && <motion.span layoutId={pill} transition={spring} className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-stone-950" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info'

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
        tone === 'ok' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        tone === 'bad' && 'bg-red-500/15 text-red-700 dark:text-red-400',
        tone === 'info' && 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
        className,
      )}
    >
      {children}
    </span>
  )
}

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
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      />
      <motion.form
        onSubmit={(e) => {
          e.preventDefault()
          if (!saving) onSave?.()
        }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: softSpring }}
        exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
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

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -6, 5, -3, 0] }} transition={{ duration: 0.35 }}
      className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </motion.p>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.05 }} className="text-stone-400 dark:text-stone-600">
          {icon}
        </motion.div>
      )}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-stone-500 dark:text-stone-400">{children}</div>}
    </motion.div>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-stone-400">
      <Spinner className="size-6" />
    </div>
  )
}

/** A tappable list row: highlights while pressed. */
export const rowPress = 'transition-[background-color,transform] duration-200 hover:bg-stone-50 active:scale-[0.99] active:bg-stone-100 active:duration-75 dark:hover:bg-stone-800/50 dark:active:bg-stone-800'

/** A tappable chip. */
export function Chip({ active, onClick, children, className }: { active?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 active:scale-95',
        press,
        active ? 'bg-accent text-on-accent ring-accent' : 'ring-stone-300 hover:bg-stone-100 active:bg-stone-200 dark:ring-stone-700 dark:hover:bg-stone-800 dark:active:bg-stone-700',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Page tabs: plain labels with an accent bar that slides under the chosen one. The strip sticks to the top while
 * the list below scrolls. A dot marks a tab that has something needing attention.
 */
export function Tabs<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; dot?: 'warn' | 'bad' }[]
}) {
  const bar = useId()
  return (
    <div
      role="tablist"
      className="sticky top-[var(--sticky-top,0px)] z-20 -mx-4 flex border-b border-stone-900/10 bg-stone-100/85 px-1 backdrop-blur-md sm:mx-0 sm:px-0 dark:border-white/10 dark:bg-stone-950/85"
    >
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative flex-1 select-none px-1 pt-3 pb-2.5 text-[13px] font-medium transition-colors duration-200 active:opacity-60 sm:text-sm',
              on ? 'font-semibold text-stone-900 dark:text-stone-50' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200',
            )}
          >
            <span className="relative inline-flex items-center gap-1">
              {o.label}
              {o.dot && <span className={cx('size-1.5 rounded-full', o.dot === 'bad' ? 'bg-red-500' : 'bg-amber-500')} aria-label="needs attention" />}
            </span>
            {on && <motion.span layoutId={bar} transition={spring} className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-accent-strong sm:inset-x-6" />}
          </button>
        )
      })}
    </div>
  )
}

/** A small heading above a list, with an action on the right ("+ Add"). */
export function SectionHeader({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">{title}</h2>
        {meta && <p className="num truncate text-xs text-stone-500">{meta}</p>}
      </div>
      {action}
    </div>
  )
}

/** The text-style "+ Add" button used in section headers. */
export function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-my-1 flex shrink-0 select-none items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-accent-strong transition active:scale-95 active:bg-accent-soft"
    >
      <span aria-hidden>+</span> {label}
    </button>
  )
}
