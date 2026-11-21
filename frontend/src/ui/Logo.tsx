import { cx } from './ui'

/**
 * The Raftaar mark: a classic scooter in profile, white line on a graphite tile with blue details — the same
 * in light and dark mode, like the app icon. Below 48 px it switches to the simplified drawing.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  const small = size < 48
  const tile = 'fill-[#18181b] stroke-[#18181b] dark:stroke-[#3f3f46]'
  const line = 'stroke-[#f4f4f5]'
  const lineFill = 'fill-[#f4f4f5]'
  const cut = 'fill-[#18181b]'
  const blue = 'fill-[#3b82f6]'
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Raftaar" className={cx('shrink-0', className)}>
      <rect x="2" y="2" width="508" height="508" rx="116" className={tile} strokeWidth={small ? 8 : 4} />
      {small ? (
        <>
          <circle cx="178" cy="372" r="44" fill="none" className={line} strokeWidth="30" />
          <circle cx="368" cy="372" r="44" fill="none" className={line} strokeWidth="30" />
          <path d={BODY} className={cx(lineFill, line)} strokeWidth="22" strokeLinejoin="round" />
          <path d={SHIELD} className={cx(lineFill, line)} strokeWidth="22" strokeLinejoin="round" />
          <path d="M290 350L336 350" fill="none" className={line} strokeWidth="26" strokeLinecap="round" />
          <circle cx="358" cy="138" r="28" className={blue} />
        </>
      ) : (
        <>
          <circle cx="178" cy="370" r="42" className={cx(cut, line)} strokeWidth="14" />
          <circle cx="368" cy="370" r="42" className={cx(cut, line)} strokeWidth="14" />
          <circle cx="178" cy="370" r="9" className={blue} />
          <circle cx="368" cy="370" r="9" className={blue} />
          <path d={BODY} className={cx(cut, line)} strokeWidth="13" strokeLinejoin="round" />
          <path d="M140 300C172 282 230 278 272 282" fill="none" className="stroke-[#3b82f6]" strokeWidth="6" strokeLinecap="round" />
          <path d="M290 350L336 350" fill="none" className={line} strokeWidth="13" strokeLinecap="round" />
          <path d={SHIELD} className={cx(cut, line)} strokeWidth="12" strokeLinejoin="round" />
          <path d={SEAT} className={lineFill} />
          <path d="M328 162L388 162" fill="none" className={line} strokeWidth="13" strokeLinecap="round" />
          <circle cx="358" cy="143" r="18" className={blue} />
        </>
      )}
    </svg>
  )
}


const BODY = 'M106 350C98 292 136 252 200 248L284 248C302 248 306 264 300 282L290 350Z'
const SHIELD = 'M334 352C350 296 354 228 340 172L358 168C374 228 370 300 354 352Z'
const SEAT = 'M182 244C182 228 196 220 214 220L270 220C286 220 292 230 288 244Z'
