import type { Metadata } from 'next'
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { LanguageProvider } from '@/lib/language-context'
import ModalRoot from '@/components/modals/ModalRoot'
import RoleSwitcher from '@/components/RoleSwitcher'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600', '700'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HomeLink Ethiopia — A Trusted Digital Housing Platform',
  description:
    'HomeLink Ethiopia connects tenants, landlords, property managers, and platform administrators through one trusted digital rental environment.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="font-sans">
        <LanguageProvider>
          <AuthProvider>
            {children}
            <ModalRoot />
            <RoleSwitcher />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
