import { CalendarBlank, CaretLeft, CaretRight, Clock } from '@phosphor-icons/react'
import { useAnimate } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from './ui'

/*
 * Date and time fields that work the same whether you type or tap.
 *
 * Typing: anything sensible, day first as in India — 13/11/2026, 13-11-26, 13/11, 13 nov, nov 13, 131126,
 * today, yesterday, tomorrow, +3 (days), -1w, +6m, +1y. The field shows what it understood as you type and
 * settles on Enter, Tab or leaving it. ↑/↓ move a day (PageUp/PageDown a month).
 * Tapping: the field or the calendar icon opens a month view; month and year can be picked straight away, so
 * an expiry five years out is two taps. In the calendar, arrows move, Enter picks, Esc closes.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ---- plain date helpers (yyyy-mm-dd strings, local time, no time zones involved) -------------------------

type YMD = { y: number; m: number; d: number } // m is 1-12

const pad = (n: number) => String(n).padStart(2, '0')
export const ymdToIso = ({ y, m, d }: YMD) => `${y}-${pad(m)}-${pad(d)}`
const isoToYmd = (s: string): YMD | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate()
const valid = ({ y, m, d }: YMD) => y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m)
const fromDate = (dt: Date): YMD => ({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() })
const toDate = ({ y, m, d }: YMD) => new Date(y, m - 1, d)
const todayYmd = () => fromDate(new Date())
const addDays = (v: YMD, n: number) => fromDate(new Date(v.y, v.m - 1, v.d + n))
/** Adds months, keeping the day where it can (31 Jan + 1 month = 28/29 Feb). */
const addMonths = (v: YMD, n: number): YMD => {
  const total = v.y * 12 + (v.m - 1) + n
  const y = Math.floor(total / 12), m = (total % 12) + 1
  return { y, m, d: Math.min(v.d, daysIn(y, m)) }
}
const same = (a: YMD | null, b: YMD | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d

export function formatDate(v: YMD | null) {
  if (!v) return ''
  return toDate(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
const longDate = (v: YMD) => `${toDate(v).toLocaleDateString('en-IN', { weekday: 'short' })}, ${formatDate(v)}`

/** '26' → 2026; more than 20 years ahead is taken as the 1900s ('47' → 1947). */
const fullYear = (y: number, twoDigit: boolean) => (twoDigit ? (y + 2000 > new Date().getFullYear() + 20 ? 1900 + y : 2000 + y) : y)

function monthIndex(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, '')
  if (w.length < 3) return null
  const i = MONTHS.findIndex((m) => w.startsWith(m) || (w === 'sept' && m === 'sep'))
  return i >= 0 ? i + 1 : null
}

/** Reads a typed date, day first. Returns null when it can't. */
export function parseDate(input: string, base: YMD = todayYmd()): YMD | null {
  const s = input.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!s) return null
  if (['today', 'tod', 'now', 't'].includes(s)) return todayYmd()
  if (['yesterday', 'yest', 'yday', 'y'].includes(s)) return addDays(todayYmd(), -1)
  if (['tomorrow', 'tmr', 'tom', 'tmrw'].includes(s)) return addDays(todayYmd(), 1)

  // relative: +3, -2d, +1w, +6m, +1y (from today)
  let m = /^([+-])\s*(\d{1,3})\s*(d|days?|w|weeks?|m|months?|y|years?)?$/.exec(s)
  if (m) {
    const n = (m[1] === '-' ? -1 : 1) * +m[2]
    const unit = (m[3] ?? 'd')[0]
    const t = todayYmd()
    return unit === 'd' ? addDays(t, n) : unit === 'w' ? addDays(t, n * 7) : unit === 'm' ? addMonths(t, n) : addMonths(t, n * 12)
  }

  // ISO: 2026-11-13
  m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)
  if (m) return check({ y: +m[1], m: +m[2], d: +m[3] })

  // 13/11/2026, 13-11-26, 13.11, 13 11 2026
  m = /^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2}|\d{4}))?$/.exec(s)
  if (m) return check({ y: m[3] ? fullYear(+m[3], m[3].length === 2) : base.y, m: +m[2], d: +m[1] })

  // digits only: 13112026, 131126, 1311
  m = /^(\d{2})(\d{2})(\d{4}|\d{2})?$/.exec(s)
  if (m) return check({ y: m[3] ? fullYear(+m[3], m[3].length === 2) : base.y, m: +m[2], d: +m[1] })

  // nov 2026 → 1st of the month (before "nov 20 26" below)
  m = /^([a-z]+\.?)\s*(\d{4})$/.exec(s)
  if (m && monthIndex(m[1])) return check({ y: +m[2], m: monthIndex(m[1])!, d: 1 })

  // 13 nov 2026, 13 november, 13nov26
  m = /^(\d{1,2})\s*(?:st|nd|rd|th)?\s*([a-z]+\.?)\s*(\d{2}|\d{4})?$/.exec(s)
  if (m && monthIndex(m[2])) return check({ y: m[3] ? fullYear(+m[3], m[3].length === 2) : base.y, m: monthIndex(m[2])!, d: +m[1] })

  // nov 13 2026, november 13
  m = /^([a-z]+\.?)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(\d{2}|\d{4})?$/.exec(s)
  if (m && monthIndex(m[1])) return check({ y: m[3] ? fullYear(+m[3], m[3].length === 2) : base.y, m: monthIndex(m[1])!, d: +m[2] })

  return null
}

const check = (v: YMD) => (valid(v) ? v : null)

/** Reads a typed time: 14:30, 1430, 2:30 pm, 2pm, 9, now. Returns minutes since midnight. */
export function parseTime(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, ':')
  if (!s) return null
  if (s === 'now') {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  }
  if (s === 'noon') return 12 * 60
  if (s === 'midnight') return 0
  const m = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(s)
  if (!m) return null
  let h = +m[1]
  const min = m[2] ? +m[2] : 0
  const ap = m[3]?.[0]
  if (min > 59) return null
  if (ap) {
    if (h < 1 || h > 12) return null
    if (ap === 'a' && h === 12) h = 0
    if (ap === 'p' && h !== 12) h += 12
  } else if (h > 23) return null
  return h * 60 + min
}

export function formatTime(minutes: number | null) {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60), m = minutes % 60
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${ap}`
}

// ---- shared bits -----------------------------------------------------------------------------------------

const box =
  'flex w-full items-center rounded-xl bg-stone-100 ring-1 ring-stone-900/10 transition focus-within:ring-2 focus-within:ring-accent dark:bg-stone-800 dark:ring-white/10'

function useOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [ref, open, close])
}

// ---- date ------------------------------------------------------------------------------------------------

export type Preset = { label: string; value: () => string }

export function DateInput({
  value,
  onChange,
  allowEmpty = false,
  placeholder,
  presets,
  ariaLabel,
}: {
  /** yyyy-mm-dd, or '' when empty */
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
  placeholder?: string
  presets?: Preset[]
  ariaLabel?: string
}) {
  const current = isoToYmd(value)
  const [text, setText] = useState(formatDate(current))
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  // how the calendar was opened: from the keyboard focus goes into it; on touch the phone keyboard stays away
  const [via, setVia] = useState<'keyboard' | 'mouse' | 'touch'>('mouse')
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()

  // Follow outside changes (e.g. "Today" elsewhere, or a renewal moving dates) unless you're typing.
  useEffect(() => {
    if (!editing) setText(formatDate(current))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const typed = editing ? text.trim() : ''
  const preview = typed ? parseDate(typed, current ?? todayYmd()) : null
  const invalid = editing && typed !== '' && !preview && typed !== formatDate(current)

  const commit = (v: YMD | null) => {
    setEditing(false)
    if (v) {
      onChange(ymdToIso(v))
      setText(formatDate(v))
    } else if (allowEmpty) {
      onChange('')
      setText('')
    } else setText(formatDate(current))
  }

  const settle = () => {
    if (!editing) return
    if (!typed) return commit(allowEmpty ? null : current)
    if (typed === formatDate(current)) return setEditing(false)
    if (preview) return commit(preview)
    // couldn't read it: keep what was there before
    setEditing(false)
    setText(formatDate(current))
  }

  const step = (fn: (v: YMD) => YMD) => {
    const base = preview ?? current ?? todayYmd()
    commit(fn(base))
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      settle()
      setOpen(false)
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation()
        setOpen(false)
      }
      setEditing(false)
      setText(formatDate(current))
    } else if ((e.key === 'ArrowDown' && e.altKey) || e.key === 'F4') {
      e.preventDefault()
      setVia('keyboard')
      setOpen(true)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      step((v) => addDays(v, e.key === 'ArrowUp' ? 1 : -1))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      step((v) => addMonths(v, e.key === 'PageUp' ? 1 : -1))
    }
  }

  useOutside(wrap, open, () => {
    setOpen(false)
    settle()
  })

  const done = () => {
    setOpen(false)
    if (via === 'touch') (document.activeElement as HTMLElement | null)?.blur()
    else input.current?.focus()
  }

  return (
    <div
      ref={wrap}
      className="relative min-w-0"
      onBlur={(e) => {
        // focus left the field and its calendar (Tab, or a tap elsewhere)
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
          settle()
        }
      }}
    >
      <div className={cx(box, invalid && '!ring-2 !ring-red-500')}>
        <input
          ref={input}
          value={text}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? 'e.g. 13/11 or today'}
          aria-label={ariaLabel}
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value)
            setEditing(true)
          }}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch' && !open) {
              // first tap: calendar only, no phone keyboard over it. Tap the field again to type.
              e.preventDefault()
              setVia('touch')
              setOpen(true)
            } else if (!open) {
              setVia('mouse')
              setOpen(true)
            }
          }}
          size={1}
          className="w-0 min-w-0 flex-1 bg-transparent py-2.5 pl-3 text-stone-900 outline-none placeholder:text-stone-400 dark:text-stone-100"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open calendar"
          onPointerDown={(e) => {
            e.preventDefault()
            setVia(e.pointerType === 'touch' ? 'touch' : 'mouse')
            setOpen((o) => !o)
          }}
          className="mr-1 shrink-0 rounded-lg p-2 text-stone-500 transition active:scale-90 active:bg-stone-200 dark:active:bg-stone-700"
        >
          <CalendarBlank size={18} />
        </button>
      </div>
      <p id={hintId} className={cx('mt-1 min-h-4 text-xs', invalid ? 'text-red-600' : 'text-stone-500')}>
        {invalid ? 'Try 13/11/2026, 13 Nov or today' : preview && !same(preview, current) ? `→ ${longDate(preview)}` : ''}
      </p>
      {open && (
        <Calendar
          // in a right-hand column the calendar would run off the screen: open it leftwards instead
          alignRight={!!wrap.current && wrap.current.getBoundingClientRect().left + 19 * 16 > window.innerWidth - 8}
          selected={preview ?? current}
          autoFocus={via === 'keyboard'}
          onPick={(v) => {
            commit(v)
            done()
          }}
          onClose={done}
          presets={[
            { label: 'Today', value: () => ymdToIso(todayYmd()) },
            ...(presets ?? []),
            ...(allowEmpty && current ? [{ label: 'Clear', value: () => '' }] : []),
          ]}
          onPreset={(v) => {
            if (v) commit(isoToYmd(v))
            else commit(null)
            done()
          }}
        />
      )}
    </div>
  )
}

function Calendar({ selected, alignRight, autoFocus, onPick, onClose, presets, onPreset }: {
  selected: YMD | null
  alignRight?: boolean
  autoFocus?: boolean
  onPick: (v: YMD) => void
  onClose: () => void
  presets: Preset[]
  onPreset: (iso: string) => void
}) {
  const today = todayYmd()
  const [focus, setFocus] = useState<YMD>(selected ?? today)
  const [view, setView] = useState({ y: (selected ?? today).y, m: (selected ?? today).m })
  // the same grid slides to the new month (not rebuilt, so keyboard focus stays in it)
  const [grid, animateGrid] = useAnimate<HTMLDivElement>()
  const panel = useRef<HTMLDivElement>(null)
  const lastView = useRef(view)
  useEffect(() => {
    const before = lastView.current.y * 12 + lastView.current.m
    const now = view.y * 12 + view.m
    lastView.current = view
    if (before === now || !grid.current) return
    const dir = now > before ? 1 : -1
    animateGrid(grid.current, { x: [dir * 28, 0], opacity: [0.2, 1] }, { type: 'spring', stiffness: 500, damping: 38 })
  }, [view, animateGrid, grid])

  // follow what's being typed
  useEffect(() => {
    if (selected) {
      setFocus(selected)
      setView({ y: selected.y, m: selected.m })
    }
  }, [selected?.y, selected?.m, selected?.d]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (autoFocus) grid.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1).getDay()
    const start = addDays({ y: view.y, m: view.m, d: 1 }, -first)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [view])

  const move = (v: YMD) => {
    setFocus(v)
    setView({ y: v.y, m: v.m })
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, () => YMD> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -toDate(focus).getDay()),
      End: () => addDays(focus, 6 - toDate(focus).getDay()),
    }
    if (map[e.key]) {
      e.preventDefault()
      move(map[e.key]())
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPick(focus)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  const years = useMemo(() => {
    const out: number[] = []
    for (let y = today.y - 30; y <= today.y + 20; y++) out.push(y)
    return out
  }, [today.y])

  const navBtn = 'rounded-lg p-2 text-stone-600 transition active:scale-90 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
  const sel = 'appearance-none rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent hover:bg-stone-100 dark:hover:bg-stone-800'

  return (
    <div
      ref={panel}
      className={cx(
        'absolute z-50 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] animate-[pop_120ms_ease-out]',
        alignRight ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
      ) + ' rounded-2xl bg-white p-3 shadow-xl ring-1 ring-stone-900/10 dark:bg-stone-900 dark:ring-white/10'}
      role="dialog"
      aria-label="Choose a date"
      onPointerDown={(e) => {
        // keep focus where it is (no blur, no phone keyboard flicker), except for the month/year menus
        if (!(e.target instanceof HTMLSelectElement)) e.preventDefault()
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button type="button" className={navBtn} aria-label="Previous month" onClick={() => move(addMonths(focus, -1))}><CaretLeft size={16} /></button>
        <div className="flex items-center">
          <select aria-label="Month" className={sel} value={view.m} onChange={(e) => move({ ...focus, m: +e.target.value, y: view.y, d: Math.min(focus.d, daysIn(view.y, +e.target.value)) })}>
            {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
          <select aria-label="Year" className={sel} value={view.y} onChange={(e) => move({ y: +e.target.value, m: view.m, d: Math.min(focus.d, daysIn(+e.target.value, view.m)) })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className={navBtn} aria-label="Next month" onClick={() => move(addMonths(focus, 1))}><CaretRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-stone-400">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div ref={grid} role="grid" tabIndex={0} onKeyDown={onKey} className="grid grid-cols-7 gap-0.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60" aria-activedescendant={`d-${ymdToIso(focus)}`}>
        {cells.map((c) => {
          const inMonth = c.m === view.m
          const isSel = same(c, selected)
          const isToday = same(c, today)
          const isFocus = same(c, focus)
          return (
            <button
              key={ymdToIso(c)}
              id={`d-${ymdToIso(c)}`}
              type="button"
              tabIndex={-1}
              role="gridcell"
              aria-selected={isSel}
              aria-label={longDate(c)}
              onClick={() => onPick(c)}
              className={cx(
                'num relative h-9 rounded-lg text-sm transition active:scale-90',
                inMonth ? 'text-stone-800 dark:text-stone-200' : 'text-stone-300 dark:text-stone-600',
                isSel ? 'bg-accent font-semibold !text-on-accent' : 'hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700',
                isFocus && !isSel && 'ring-1 ring-accent',
                isToday && !isSel && 'font-semibold text-accent-strong',
              )}
            >
              {c.d}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-stone-900/5 pt-2 dark:border-white/10">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => onPreset(p.value())}
            className="rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-stone-300 transition active:scale-95 active:bg-stone-200 dark:ring-stone-700 dark:active:bg-stone-700">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- time ------------------------------------------------------------------------------------------------

export function TimeInput({ value, onChange, ariaLabel }: { value: number; onChange: (minutes: number) => void; ariaLabel?: string }) {
  const [text, setText] = useState(formatTime(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setText(formatTime(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const typed = editing ? text.trim() : ''
  const preview = typed ? parseTime(typed) : null
  const invalid = editing && typed !== '' && preview == null

  const commit = (m: number | null) => {
    setEditing(false)
    if (m != null) {
      onChange(m)
      setText(formatTime(m))
    } else setText(formatTime(value))
  }
  const step = (by: number) => commit((((preview ?? value) + by) % 1440 + 1440) % 1440)

  return (
    <div className="min-w-0">
      <div className={cx(box, invalid && '!ring-2 !ring-red-500')}>
        <input
          value={text}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel ?? 'Time'}
          aria-invalid={invalid || undefined}
          placeholder="6:30 pm"
          onChange={(e) => {
            setText(e.target.value)
            setEditing(true)
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => editing && commit(preview)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(preview ?? value)
            } else if (e.key === 'Escape' && editing) {
              e.stopPropagation()
              commit(null)
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              step((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 60 : 5))
            }
          }}
          size={1}
          className="w-0 min-w-0 flex-1 bg-transparent py-2.5 pl-3 text-stone-900 outline-none placeholder:text-stone-400 dark:text-stone-100"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => commit(parseTime('now'))}
          aria-label="Now"
          title="Now"
          className="mr-1 shrink-0 rounded-lg p-2 text-stone-500 transition active:scale-90 active:bg-stone-200 dark:active:bg-stone-700"
        >
          <Clock size={18} />
        </button>
      </div>
      <p className={cx('mt-1 min-h-4 text-xs', invalid ? 'text-red-600' : 'text-stone-500')}>
        {invalid ? 'Try 6:30 pm' : preview != null && preview !== value ? `→ ${formatTime(preview)}` : ''}
      </p>
    </div>
  )
}

// ---- date + time -----------------------------------------------------------------------------------------

/** value: local "yyyy-mm-ddTHH:mm" */
export function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [date, time] = value.split('T')
  const [h, m] = (time ?? '00:00').split(':').map(Number)
  const minutes = h * 60 + m
  return (
    <div className="grid grid-cols-1 gap-x-2 min-[360px]:grid-cols-[minmax(0,1fr)_8.5rem]">
      <DateInput value={date} onChange={(d) => onChange(`${d}T${time ?? '00:00'}`)} ariaLabel="Date" />
      <TimeInput value={minutes} onChange={(t) => onChange(`${date}T${pad(Math.floor(t / 60))}:${pad(t % 60)}`)} />
    </div>
  )
}

/** For presets: a date some months/years after another one (or after today). */
export function plusMonths(fromIso: string | null | undefined, months: number) {
  const base = (fromIso && isoToYmd(fromIso)) || todayYmd()
  return ymdToIso(addMonths(base, months))
}
