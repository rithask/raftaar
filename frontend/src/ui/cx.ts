/** Joins class names, skipping the ones that are off: cx('a', on && 'b'). */
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
