import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AYKA CRM',
  description: 'Lead Management System for AYKA Alliance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
