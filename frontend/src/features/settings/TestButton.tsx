import { PaperPlaneTilt } from '@phosphor-icons/react'
import { Button } from '@/ui'

/** Sends a test notification to one place (this device, another device, an Apprise channel); {@code to} names it for screen readers. */
export function TestButton({ to, busy, onClick }: { to: string; busy: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" className="shrink-0 !px-2.5 !py-1.5 text-xs" busy={busy} onClick={onClick} aria-label={`Send a test to ${to}`}>
      <PaperPlaneTilt size={14} /> Test
    </Button>
  )
}
