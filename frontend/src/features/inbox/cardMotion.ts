import { easeOut, softSpring } from '@/ui'

/** Cards come in softly, and slide off to the left when they're dealt with; the rest close the gap. */
export const cardMotion = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, x: 0, transition: softSpring },
  exit: { opacity: 0, x: -90, transition: { duration: 0.22, ease: easeOut } },
} as const
