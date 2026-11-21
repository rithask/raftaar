import { CaretDoubleLeft, Garage, Gear, Scroll, SignOut, Tray } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { signOut } from '@/features/auth/session'
import { KindIcon } from '@/features/vehicle/VehicleArt'
import { imageUrl } from '@/features/vehicle/photo'
import { api } from '@/lib/api'
import { type Garage as GarageData } from '@/lib/types'
import { useHidden } from '@/lib/undo'
import { OutboxBar } from './OutboxBar'
import { cx, ErrorBoundary, exitFast, Logo, pageSpring, slideSpring, spring } from '@/ui'

const tabs = [
  { to: '/', label: 'Garage', Icon: Garage, end: true },
  { to: '/inbox', label: 'Inbox', Icon: Tray },
  { to: '/papers', label: 'Papers', Icon: Scroll },
  { to: '/settings', label: 'Settings', Icon: Gear },
]

const depth = (path: string) => (path.startsWith('/vehicles/') ? 1 : 0)

export function Layout() {
  const garage = useQuery({ queryKey: ['garage'], queryFn: () => api<GarageData>('/garage') })
  const waiting = (garage.data?.tripsToSort ?? 0) + (garage.data?.toConfirm ?? 0)
  const location = useLocation()
  const outlet = useOutlet()

  // Going into a vehicle slides in from the right; coming back slides in from the left; switching sections fades up.
  const prev = useRef(location.pathname)
  const from = prev.current
  const dir = depth(location.pathname) - depth(from)
  useEffect(() => {
    prev.current = location.pathname
    window.scrollTo(0, 0) // a new page starts at the top
  }, [location.pathname])
  const enter = dir > 0 ? { opacity: 0, x: 40 } : dir < 0 ? { opacity: 0, x: -40 } : { opacity: 0, y: 10 }

  const [collapsed, toggle] = useCollapsed()

  return (
    <div className={cx('min-h-dvh overflow-x-clip pb-28 transition-[padding] duration-300 ease-out sm:pb-10 sm:pl-[92px]', !collapsed && 'lg:pl-[280px]')}>
      <Sidebar garage={garage.data} waiting={waiting} collapsed={collapsed} onToggle={toggle} />
      {/* vehicle pages use the width for a second column; collapsing the sidebar gives the page the room */}
      <main className={cx('mx-auto max-w-4xl px-4 pt-4 sm:px-8 sm:pt-6 2xl:max-w-6xl', collapsed && 'lg:max-w-5xl',
        location.pathname.startsWith('/vehicles/') && 'xl:max-w-6xl')}>
        <OutboxBar />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname.startsWith('/settings') ? '/settings' : location.pathname}
            initial={enter}
            animate={{ opacity: 1, x: 0, y: 0, transition: pageSpring }}
            exit={{ opacity: 0, transition: exitFast }}
          >
            {/* a page that fails shows a message in its place; the navigation around it keeps working */}
            <ErrorBoundary resetKey={location.pathname}>{outlet}</ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomBar waiting={waiting} />
    </div>
  )
}

/** Whether you've collapsed the sidebar to icons; remembered in this browser. Ctrl/⌘ + B toggles it. */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('raftaar.sidebar') === 'icons'
    } catch {
      return false
    }
  })
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('raftaar.sidebar', c ? 'full' : 'icons')
      } catch {
        // private window: it just won't be remembered
      }
      return !c
    })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !typing) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
  return [collapsed, toggle]
}

/**
 * On tablets and computers: a floating panel on the left with the sections and your vehicles. One soft highlight
 * slides to where you are — a section, or the vehicle you're looking at — so there's never more than one selection.
 * On tablets, or when you collapse it, it's an icon rail.
 */
/**
 * The one "you are here" mark in the sidebar: a soft fill with a hairline edge, sliding between rows. Rows share
 * one grid — icons and vehicle thumbnails on the same centre line, labels starting at the same x.
 */
function Highlight() {
  return (
    <motion.span layoutId="side-here" transition={spring}
      className="absolute inset-0 rounded-xl bg-stone-900/[0.045] ring-1 ring-stone-900/[0.07] ring-inset dark:bg-white/[0.07] dark:ring-white/[0.08]" />
  )
}

function Sidebar({ garage, waiting, collapsed, onToggle }: { garage?: GarageData; waiting: number; collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const current = pathname.startsWith('/settings') ? '/settings' : pathname
  const hidden = useHidden()
  const vehicles = (garage?.vehicles ?? []).filter((c) => !c.vehicle.archived && !hidden(`vehicle:${c.vehicle.id}`))
  const leave = async () => {
    await signOut()
    qc.setQueryData(['me'], { username: null })
  }
  // "wide" styles only apply on large screens, and only when not collapsed
  const wide = (cls: string) => (collapsed ? '' : cls)
  const label = cx('relative hidden whitespace-nowrap', wide('lg:inline'))
  const item = cx('relative flex h-10 items-center justify-center gap-3 rounded-xl text-sm', wide('lg:justify-start lg:px-3'))
  const quiet = 'font-medium text-stone-500 hover:bg-stone-900/[0.04] hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-stone-100'
  const chosen = 'font-semibold text-stone-950 dark:text-white'

  return (
    <aside className={cx(
      'fixed inset-y-3 left-3 z-30 hidden w-[72px] flex-col overflow-hidden rounded-3xl bg-white/80 p-2.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)] ring-1 ring-stone-900/[0.06] backdrop-blur-xl backdrop-saturate-150 transition-[width,padding] duration-300 ease-out sm:flex dark:bg-stone-900/80 dark:ring-white/10',
      wide('lg:w-64 lg:p-3'),
    )}>
      <Link to="/" title="Raftaar" className={cx('mb-4 flex items-center justify-center gap-2.5 rounded-2xl p-1.5 transition active:scale-95', wide('lg:justify-start lg:px-2'))}>
        <Logo size={40} />
        <span className={cx('hidden text-[22px] leading-none font-bold tracking-tight whitespace-nowrap', wide('lg:inline'))}>Raftaar</span>
      </Link>

      <nav aria-label="Sections" className="flex flex-col gap-1">
        {tabs.map(({ to, label: name, Icon }) => {
          const on = current === to
          return (
            <Link key={to} to={to} title={name} aria-current={on ? 'page' : undefined} className={cx(item, 'transition-colors', on ? chosen : quiet)}>
              {on && <Highlight />}
              <motion.span className="relative" whileTap={{ scale: 0.88 }}>
                <Icon size={20} weight={on ? 'bold' : 'regular'} />
                {to === '/inbox' && waiting > 0 && (
                  <span className={cx('num absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2', wide('lg:hidden'),
                    'bg-red-500 text-white ring-white dark:ring-stone-900')}>{waiting}</span>
                )}
              </motion.span>
              <span className={cx(label, 'flex-1')}>{name}</span>
              {to === '/inbox' && waiting > 0 && (
                <span className={cx('num relative hidden rounded-full px-2 py-0.5 text-xs font-semibold', wide('lg:inline'), 'bg-stone-900/[0.07] text-stone-700 dark:bg-white/10 dark:text-stone-200')}>{waiting}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {vehicles.length > 0 && (
        <div className="mt-6 hidden min-h-0 flex-1 flex-col lg:flex">
          {collapsed ? <div className="mx-auto mb-2 h-px w-8 bg-stone-900/10 dark:bg-white/10" /> : (
            <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-stone-400 uppercase">Vehicles</div>
          )}
          <div className="-mx-1 flex flex-col gap-1 overflow-y-auto px-1">
            {vehicles.map((c) => {
              const v = c.vehicle
              const on = pathname === `/vehicles/${v.id}`
              const bad = c.attention.some((r) => r.status.state === 'OVERDUE') || c.papers.some((d) => d.state === 'EXPIRED')
              const warn = c.attention.length + c.papers.length > 0
              const dot = warn && <span className={cx('relative size-2 shrink-0 rounded-full', bad ? 'bg-red-500' : 'bg-amber-500')} aria-label="needs attention" />
              return (
                <Link key={v.id} to={`/vehicles/${v.id}`} title={v.name} aria-current={on ? 'page' : undefined}
                  className={cx('relative flex h-10 items-center rounded-xl text-sm transition-colors active:scale-[0.97]', collapsed ? 'justify-center' : 'gap-2 px-2',
                    on ? chosen : 'font-medium text-stone-600 hover:bg-stone-900/[0.04] hover:text-stone-900 dark:text-stone-300 dark:hover:bg-white/5 dark:hover:text-stone-100')}>
                  {on && <Highlight />}
                  <span className="relative shrink-0">
                    {imageUrl(v) ? (
                      <img src={imageUrl(v, 'small')!} alt="" className="size-7 rounded-lg object-cover ring-1 ring-stone-900/10 dark:ring-white/10" />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong"><KindIcon kind={v.kind} size={16} /></span>
                    )}
                    {collapsed && warn && <span className={cx('absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white dark:ring-stone-900', bad ? 'bg-red-500' : 'bg-amber-500')} />}
                  </span>
                  {!collapsed && <span className="relative min-w-0 flex-1 truncate">{v.name}</span>}
                  {!collapsed && dot}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1 pt-3">
        <button type="button" onClick={onToggle} title={collapsed ? 'Expand sidebar (Ctrl/⌘ B)' : 'Collapse to icons (Ctrl/⌘ B)'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}
          className={cx(item, quiet, 'hidden transition active:scale-95 lg:flex')}>
          <motion.span className="relative" animate={{ rotate: collapsed ? 180 : 0 }} transition={spring}>
            <CaretDoubleLeft size={20} />
          </motion.span>
          <span className={label}>Collapse</span>
        </button>
        <button type="button" onClick={leave} title="Sign out" className={cx(item, quiet, 'transition active:scale-95')}>
          <SignOut size={20} /> <span className={label}>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

/**
 * A floating, frosted pill at the bottom of the phone screen. The current section shows its label in an accent
 * pill that slides between tabs; the others are icons. It tucks away while you scroll down and comes back as
 * soon as you scroll up.
 */
function BottomBar({ waiting }: { waiting: number }) {
  const hidden = useHideOnScroll()
  const { pathname } = useLocation()
  // a vehicle's page belongs to the Garage
  const current = pathname.startsWith('/vehicles/') ? '/' : pathname.startsWith('/settings') ? '/settings' : pathname
  return (
    <motion.nav
      aria-label="Sections"
      initial={false}
      animate={{ y: hidden ? 'calc(100% + 24px)' : 0, opacity: hidden ? 0 : 1 }}
      transition={slideSpring}
      className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4 sm:hidden"
    >
      <div className="flex items-center gap-1 rounded-full bg-white/75 p-1.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.25)] ring-1 ring-stone-900/[0.07] backdrop-blur-xl backdrop-saturate-150 dark:bg-stone-900/75 dark:ring-white/10">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} aria-label={label} aria-current={current === to ? 'page' : undefined} className="relative select-none rounded-full">
            {({ isActive: exact }) => {
              const isActive = exact || current === to
              return (
              <motion.span
                layout
                transition={spring}
                whileTap={{ scale: 0.92 }}
                className={cx('relative flex h-12 items-center justify-center gap-2 rounded-full', isActive ? 'px-4 text-on-accent' : 'w-14 text-stone-500 dark:text-stone-400')}
              >
                {isActive && <motion.span layoutId="bar-pill" transition={spring} className="absolute inset-0 rounded-full bg-accent shadow-sm shadow-black/20" />}
                <span className="relative">
                  <Icon size={24} weight={isActive ? 'bold' : 'regular'} />
                  <AnimatePresence>
                    {to === '/inbox' && waiting > 0 && (
                      <motion.span
                        key="count"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={spring}
                        className={cx(
                          'num absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2',
                          isActive ? 'bg-on-accent text-accent ring-accent' : 'bg-red-500 text-white ring-white dark:ring-stone-900',
                        )}
                      >
                        {waiting > 99 ? '99+' : waiting}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      key="label"
                      className="relative overflow-hidden text-sm font-semibold whitespace-nowrap"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={spring}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              )
            }}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}

/** True while you're scrolling down a page (and past its top); false as soon as you scroll up or reach the end. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  const location = useLocation()
  useEffect(() => setHidden(false), [location.pathname])
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 8
        if (y < 80 || atEnd) setHidden(false)
        else if (y > last + 6) setHidden(true)
        else if (y < last - 6) setHidden(false)
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return hidden
}
