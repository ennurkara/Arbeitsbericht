import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  height?: number
  onDark?: boolean
  className?: string
}

export function Logo({ height = 22, onDark = false, className }: LogoProps) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ height, lineHeight: 0 }}
    >
      <Image
        src="/brand/kassen-buch-logo.png"
        alt="Kassen Buch"
        width={height * 8}
        height={height}
        priority
        style={{
          height: '100%',
          width: 'auto',
          display: 'block',
          filter: onDark ? 'brightness(0) invert(1)' : undefined,
        }}
      />
    </span>
  )
}
