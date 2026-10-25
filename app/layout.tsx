import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { LanguageProvider } from '@/lib/language-context'
import AutoTranslate from '@/lib/auto-translate'
import ModalRoot from '@/components/modals/ModalRoot'
import LeafletErrorGuard from '@/components/shared/LeafletErrorGuard'
import RoleSwitcher from '@/components/RoleSwitcher'

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
    <html lang="en">
      <body className="font-sans">
        <LanguageProvider>
          <AuthProvider>
            <LeafletErrorGuard />
            {children}
            <AutoTranslate />
            <ModalRoot />
            <RoleSwitcher />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
