import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Arbeitsbericht · Kassen Buch',
  description: 'Digitale Arbeitsberichte',
}

// Explicit viewport prevents iOS Safari from auto-zooming on input focus
// without restoring; `initialScale: 1` is the canonical baseline.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
