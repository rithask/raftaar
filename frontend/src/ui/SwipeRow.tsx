import { motion, useMotionValue, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'

/** How far a row is swiped (in px of finger travel) before letting go does its action. */
const ENOUGH = 90

/**
 * A row in a list that can be swiped left to do something (put it back, say), like a mail app: the action shows
 * behind it as it slides, and letting go far enough does it; short of that, it springs back. Its sideways swipes are
 * its own (a tab pager around it leaves them alone); up and down still scroll. A drag that ends on a link in the row
 * isn't taken as a tap on it. {@code enabled} false: a plain row.
 */
export function SwipeRow({ enabled = true, action, onSwipe, children }: { enabled?: boolean; action: ReactNode; onSwipe: () => void; children: ReactNode }) {
  const x = useMotionValue(0)
  const reveal = useTransform(x, [-ENOUGH, -12, 0], [1, 0.4, 0])
  const dragged = useRef(false)
  if (!enabled) return <>{children}</>
  return (
    <div className="relative overflow-hidden" data-own-swipe>
      <motion.div aria-hidden style={{ opacity: reveal }}
        className="absolute inset-0 flex items-center justify-end gap-1.5 bg-emerald-600 px-5 text-sm font-semibold text-white">
        {action}
      </motion.div>
      <motion.div
        className="relative bg-white dark:bg-stone-900"
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.85, right: 0 }}
        dragSnapToOrigin
        onPointerDownCapture={() => { dragged.current = false }}
        onDragStart={() => { dragged.current = true }}
        onDragEnd={(_, info) => { if (info.offset.x < -ENOUGH) onSwipe() }}
        onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation() } }}
      >
        {children}
      </motion.div>
    </div>
  )
}
