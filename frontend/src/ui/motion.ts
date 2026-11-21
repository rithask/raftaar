import type { Transition, Variants } from 'motion/react'

/**
 * The app's motion, named by what it's for, so every part of the app moves the same way. Springs rather than
 * durations: they follow the finger and settle naturally when interrupted.
 */

/** Small things reacting to a tap: a toggle's knob, a highlight sliding to the chosen tab, a menu opening. */
export const spring: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }

/** Content arriving: a list row, a card, a form's fields. Gentler, no overshoot to speak of. */
export const softSpring: Transition = { type: 'spring', stiffness: 320, damping: 30 }

/** Bars and pills moving out of the way or back (the bottom bar, a selection bar). */
export const slideSpring: Transition = { type: 'spring', stiffness: 420, damping: 38 }

/** A whole page sliding in: critically damped, so it lands without bouncing. */
export const pageSpring: Transition = { type: 'spring', stiffness: 380, damping: 36 }

/** A tick or a count popping in. */
export const popSpring: Transition = { type: 'spring', stiffness: 600, damping: 25 }

/** Leaving is quicker than arriving: what goes away shouldn't hold you up. */
export const exitFast: Transition = { duration: 0.12 }
export const exitSoft: Transition = { duration: 0.18 }
/** Accelerating out, for things that leave the screen. */
export const easeOut = [0.4, 0, 1, 1] as const

/** Lists that fade in one row after another: {@code variants={listParent}} on the list, {@code listItem} on each row. */
export const listParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } } }
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: softSpring },
}

/** Pressed: quick in, springy out (the release overshoots a touch instead of snapping back). For Tailwind classes. */
export const press = 'transition-[transform,background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:duration-75 active:ease-out'

/** A tappable row: highlights while pressed. */
export const rowPress = 'transition-[background-color,transform] duration-200 hover:bg-stone-50 active:scale-[0.99] active:bg-stone-100 active:duration-75 dark:hover:bg-stone-800/50 dark:active:bg-stone-800'
