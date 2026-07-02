import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { ClerkProvider, Show, UserButton } from '@clerk/nextjs'
import { OrgActivator } from '@/components/org-activator'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <OrgActivator />
          <Show when="signed-in">
            <header className="border-b border-border bg-card">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                <Link
                  href="/history"
                  className="text-base font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
                >
                  JourneyDebug
                </Link>
                <nav className="flex items-center gap-6">
                  <Link
                    href="/history"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    History
                  </Link>
                  <Link
                    href="/settings"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Settings
                  </Link>
                </nav>
                <UserButton />
              </div>
            </header>
          </Show>
          <main className="flex-1">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}
