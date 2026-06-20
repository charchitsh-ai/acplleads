import type { Metadata, Viewport } from 'next'
import { Inter, Public_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' })

export const metadata: Metadata = {
  title: 'AYKA CRM',
  description: 'Lead Management System for AYKA Alliance',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
