import { animate, motion, motionValue, useDragControls, useMotionValue, type MotionValue, type PanInfo } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Tabs } from './Tabs'

/** Marks something whose sideways swipes are its own (a SwipeRow): the pager doesn't start a drag on it. */
export const OWN_SWIPE = '[data-own-swipe]'

/** Lands without bouncing, like a page in iOS: quick to leave, smooth to arrive. */
const SETTLE = { type: 'spring', stiffness: 380, damping: 40, mass: 0.9 } as const
/** How far a flick carries: the release velocity times this many seconds decides where it lands. */
const FLICK_SECONDS = 0.18

export interface PagerTab<T extends string> {
  value: T
  label: string
  dot?: 'warn' | 'bad'
  content: ReactNode
  /** Rendered only once it's first shown, or a swipe heads its way: for a page that loads data of its own. */
  lazy?: boolean
}

/**
 * Tabs whose pages sit side by side, like iOS: tapping a tab slides the row of pages to it, and a page can be swiped
 * to the next one with the finger (the row follows it, and a flick carries on). Every page is rendered up front, so
 * nothing loads or lays out mid-slide, except a lazy one, which waits until it's first wanted.
 *
 * Each page keeps its own scroll position. While the strip is stuck to the top, the page coming in is shown from
 * where you left it (from its top the first time): it's offset while it slides, and once it's settled the offset is
 * swapped for a window scroll in the same frame, so nothing visibly moves. The pages' box is the height of the one
 * showing, so a short page doesn't leave a long blank below it.
 *
 * The pager keeps which tab is showing itself: switching re-renders the strip and the pager, never the pages, whose
 * content is passed in once and reused as it is.
 */
export function TabPager<T extends string>({ tabs, initial }: { tabs: PagerTab<T>[]; initial?: T }) {
  const [value, onChange] = useState<T>(initial ?? tabs[0].value)
  const viewport = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const panels = useRef<(HTMLDivElement | null)[]>([])
  const width = useMeasure(viewport, elementWidth)
  const stripHeight = useMeasure(strip, elementHeight)
  const x = useMotionValue(0)
  const dragControls = useDragControls()
  const height = useMotionValue<number | 'auto'>('auto')
  const offsets = useOffsets(tabs.length)
  const index = Math.max(0, tabs.findIndex((tab) => tab.value === value))
  const settled = useRef(index) // the page showing once any slide finishes
  const scrolledInto = useRef<number[]>(tabs.map(() => 0)) // how far into each page you'd scrolled when you left it
  const slide = useRef<ReturnType<typeof animate> | null>(null)
  const sliding = useRef(false)
  const dragged = useRef(false) // a drag just ended: the click that follows isn't a tap on a row
  const [opened, setOpened] = useState(() => new Set([index])) // pages shown at least once (for lazy ones)
  const open = useCallback((...pages: number[]) => {
    setOpened((current) => (pages.every((page) => current.has(page)) ? current : new Set([...current, ...pages])))
  }, [])

  /** How far the page showing is scrolled under the strip (0 while the strip isn't stuck). */
  const scrolledIntoShowing = useCallback(() => {
    if (!viewport.current || !strip.current) return 0
    return Math.max(0, strip.current.getBoundingClientRect().bottom - viewport.current.getBoundingClientRect().top)
  }, [])

  const heightOf = (page: number) => panels.current[page]?.offsetHeight ?? 0
  /**
   * The box's height for a page: the page's own, but at least the screen below the stuck strip, so the strip can stay
   * where it is over a page shorter than the screen (as in iOS) instead of the window scrolling back to fit.
   */
  const boxHeightFor = useCallback((page: number) => {
    const stickyTop = strip.current ? parseFloat(getComputedStyle(strip.current).top) || 0 : 0
    const belowStrip = window.innerHeight - stickyTop - (strip.current?.offsetHeight ?? 0)
    return Math.max(heightOf(page), belowStrip)
  }, [])

  /** Before pages come into view: each one is offset to show where you left it, and the box fits all of them. */
  const prepare = useCallback(() => {
    const into = scrolledIntoShowing()
    scrolledInto.current[settled.current] = into
    let tallest = boxHeightFor(settled.current)
    offsets.forEach((offset, page) => {
      if (page === settled.current) return offset.set(0)
      const remembered = Math.min(scrolledInto.current[page], Math.max(0, heightOf(page) - 1))
      offset.set(into - remembered)
      tallest = Math.max(tallest, into - remembered + heightOf(page))
    })
    height.set(tallest)
  }, [boxHeightFor, height, offsets, scrolledIntoShowing])

  /** Slides to {@code page}; once there, swaps its offset for the window's scroll and fits the box to it. */
  const slideTo = useCallback((page: number) => {
    slide.current?.stop()
    sliding.current = true
    slide.current = animate(x, -page * width, {
      ...SETTLE,
      onComplete: () => {
        sliding.current = false
        const shift = offsets[page].get()
        offsets.forEach((offset) => offset.set(0))
        settled.current = page
        // scroll first, then fit the box: shrinking it first would cut the page short under the scroll position
        if (shift) window.scrollBy({ top: -shift, behavior: 'instant' })
        height.set(boxHeightFor(page))
      },
    })
  }, [boxHeightFor, height, offsets, width, x])

  // a tab tapped in the strip
  useEffect(() => {
    if (index === settled.current && !sliding.current) return
    open(index)
    prepare()
    slideTo(index)
  }, [index, open, prepare, slideTo])

  // the row follows the width (rotating the phone, resizing the window)
  useLayoutEffect(() => {
    if (sliding.current) return
    x.set(-settled.current * width)
  }, [width, x])

  // the box follows the showing page's height as its content changes (a row added, a chart drawn)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (!sliding.current) height.set(boxHeightFor(settled.current))
    })
    panels.current.forEach((panel) => panel && observer.observe(panel))
    return () => observer.disconnect()
  }, [boxHeightFor, height, tabs.length])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const landing = -(x.get() + info.velocity.x * FLICK_SECONDS) / Math.max(1, width)
    // one page at a time, like iOS: a hard flick never skips a page
    const page = Math.min(tabs.length - 1, Math.max(0, Math.min(settled.current + 1, Math.max(settled.current - 1, Math.round(landing)))))
    if (page !== settled.current) onChange(tabs[page].value)
    slideTo(page)
  }

  return (
    // --below-strip: where the stuck strip ends, for a heading in a page to stick under it (sticky top-[var(--below-strip)])
    <div className="space-y-5" style={{ '--below-strip': `calc(var(--sticky-top, 0px) + ${stripHeight}px)` } as CSSProperties}>
      <div ref={strip} className="sticky top-[var(--sticky-top,0px)] z-20">
        <Tabs value={value} onChange={onChange} options={tabs} />
      </div>
      {/* clip, not hidden: the page underneath still scrolls the window, and the strip above still sticks */}
      <motion.div ref={viewport} className="-mx-4 overflow-clip sm:mx-0" style={{ height }}>
        <motion.div
          className="flex items-start"
          style={{ x, touchAction: 'pan-y' }}
          drag="x"
          // the pager starts its own drags, so it can leave alone one that begins on a row with a swipe of its own
          dragListener={false}
          dragControls={dragControls}
          onPointerDown={(event) => { if (!(event.target as Element).closest(OWN_SWIPE)) dragControls.start(event) }}
          dragDirectionLock
          dragMomentum={false}
          dragElastic={0.18}
          dragConstraints={{ left: -(tabs.length - 1) * width, right: 0 }}
          onPointerDownCapture={() => { dragged.current = false }}
          // a mouse swipe that starts on a link or an image would drag that (the browser's own drag) instead of the page
          onDragStartCapture={(event) => event.preventDefault()}
          onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation() } }}
          onDragStart={() => { dragged.current = true; open(settled.current - 1, settled.current + 1); slide.current?.stop(); sliding.current = true; prepare() }}
          onDragEnd={onDragEnd}
        >
          {tabs.map((tab, page) => (
            <Panel key={tab.value} offset={offsets[page]} hidden={page !== index} refCallback={(el) => { panels.current[page] = el }}>
              {(!tab.lazy || opened.has(page)) && <ErrorBoundary resetKey={tab.value} fallback="section">{tab.content}</ErrorBoundary>}
            </Panel>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

function Panel({ offset, hidden, refCallback, children }: { offset: MotionValue<number>; hidden: boolean; refCallback: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    // the pages beside the one showing can't be focused or read out, but stay rendered for the slide
    <motion.div ref={refCallback} style={{ y: offset }} className="w-full shrink-0 space-y-6 px-4 sm:px-0" aria-hidden={hidden} inert={hidden}>
      {children}
    </motion.div>
  )
}

/** A size of the element ({@code measure}: its width, its height), kept current as it changes. */
function useMeasure(ref: React.RefObject<HTMLElement | null>, measure: (el: HTMLElement) => number) {
  const [size, setSize] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setSize(measure(el))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setSize(measure(el)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, measure])
  return size
}
const elementWidth = (el: HTMLElement) => el.clientWidth
const elementHeight = (el: HTMLElement) => el.offsetHeight

/** One vertical offset per page (see TabPager), made once. */
function useOffsets(count: number): MotionValue<number>[] {
  const offsets = useRef<MotionValue<number>[]>([])
  if (offsets.current.length !== count) offsets.current = Array.from({ length: count }, () => motionValue(0))
  return offsets.current
}
