'use client'

import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  arbeitsberichte: 'Arbeitsberichte',
  neu: 'Neu',
}

function deriveCrumbs(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return ['Start']
  const crumbs: string[] = ['Start']
  for (const seg of segments) {
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(seg)
    if (looksLikeId) {
      crumbs.push('Detail')
      continue
    }
    crumbs.push(SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1))
  }
  return crumbs
}

export function TopBar() {
  const pathname = usePathname()
  const crumbs = deriveCrumbs(pathname)

  return (
    <div className="kb-top hidden md:flex">
      <div className="kb-crumbs">
        {crumbs.map((c, i) => (
          <Fragment key={`${i}-${c}`}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'now' : ''}>{c}</span>
          </Fragment>
        ))}
      </div>
      <div className="flex-1" />
    </div>
  )
}
