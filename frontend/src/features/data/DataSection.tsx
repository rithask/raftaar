import { CaretDown, DownloadSimple, FileArchive, FileCsv, Files } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { cx, IconBadge, List, rowPress, RowText, Section, softSpring } from '@/ui'
import { EXPORTS, exportUrl } from './exports'
import { ImportSection } from './ImportSection'

/**
 * Settings → Data: your records as files (for a spreadsheet, a backup or another app), and records from files.
 * Export is one row for everything, with each kind on its own folded away beneath it, so Import is in view too.
 */
export function DataSection() {
  const [oneKind, setOneKind] = useState(false)
  return (
    <div className="space-y-6">
      <Section title="Export" meta="CSV, opens in any spreadsheet">
        <List>
          <DownloadRow href={exportUrl('all')} icon={<FileArchive size={18} />} title="Everything" detail="Each kind of record as its own file, in one zip" />
          <button type="button" aria-expanded={oneKind} onClick={() => setOneKind((open) => !open)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left', rowPress)}>
            <IconBadge tone="neutral" square><Files size={18} /></IconBadge>
            <RowText title="Just one kind…">Fill-ups, services, expenses and the rest, each a CSV</RowText>
            <CaretDown size={16} className={cx('shrink-0 text-stone-400 transition-transform duration-200', oneKind && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {oneKind && (
              <motion.div key="kinds" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={softSpring} className="divide-y divide-stone-900/5 overflow-hidden dark:divide-white/5">
                {EXPORTS.map(({ file, title }) => (
                  <DownloadRow key={file} href={exportUrl(file)} icon={<FileCsv size={18} />} title={title} detail={`${file}.csv`} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </List>
        <p className="px-1 text-xs text-stone-500">One vehicle's records: Export, at the bottom of its Edit screen.</p>
      </Section>
      <ImportSection />
    </div>
  )
}

function DownloadRow({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <a href={href} download className={cx('flex items-center gap-3 px-4 py-3', rowPress)}>
      <IconBadge tone="neutral" square>{icon}</IconBadge>
      <RowText title={title}>{detail}</RowText>
      <DownloadSimple size={18} className="shrink-0 text-stone-400" />
    </a>
  )
}
