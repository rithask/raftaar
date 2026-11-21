import { motion } from 'motion/react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'
import { press, spring } from './motion'

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
