import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider, Show } from '@clerk/nextjs'
import { OrgActivator } from '@/components/org-activator'
import { AppShell } from '@/components/app-shell'
import './globals.css'
import './design-system.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'JourneyDebug',
  description: 'Journey-aware error monitoring for engineering teams',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body suppressHydrationWarning>
          <OrgActivator />
          <Show when="signed-in">
            <AppShell>{children}</AppShell>
          </Show>
          <Show when="signed-out">
            <div className="auth-viewport">{children}</div>
          </Show>
        </body>
      </html>
    </ClerkProvider>
  )
}
