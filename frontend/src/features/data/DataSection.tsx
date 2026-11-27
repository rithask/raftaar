import { DownloadSimple, FileArchive, FileCsv } from '@phosphor-icons/react'
import { type ReactNode } from 'react'
import { IconBadge, List, rowPress, RowText, Section } from '@/ui'
import { EXPORTS, exportUrl } from './exports'
import { ImportSection } from './ImportSection'

/** Settings → Data: your records as files (for a spreadsheet, a backup or another app), and records from files. */
export function DataSection() {
  return (
    <div className="space-y-6">
      <Section title="Export" meta="CSV, opens in any spreadsheet">
        <List>
          <DownloadRow href={exportUrl('all')} icon={<FileArchive size={18} />} title="Everything" detail="Every kind below, in one zip" />
          {EXPORTS.map(({ file, title }) => (
            <DownloadRow key={file} href={exportUrl(file)} icon={<FileCsv size={18} />} title={title} detail={`${file}.csv`} />
          ))}
        </List>
        <p className="px-1 text-xs text-stone-500">One vehicle's records: Export, at the bottom of its Edit screen.</p>
      </Section>
      <ImportSection />
    </div>
  )
}

function DownloadRow({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <a href={href} download className={`flex items-center gap-3 px-4 py-3 ${rowPress}`}>
      <IconBadge tone="neutral" square>{icon}</IconBadge>
      <RowText title={title}>{detail}</RowText>
      <DownloadSimple size={18} className="shrink-0 text-stone-400" />
    </a>
  )
}
