'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useOrganization, useUser } from '@clerk/nextjs'

const NAV = [
  { href: '/analyses', label: 'Analyses', ico: '◆' },
  { href: '/settings', label: 'Settings', ico: '⚙', section: 'Account' as const },
]

function Logo() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="jd-spike" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <path
          d="M 6 60 L 36 60 L 42 18 L 50 72 L 56 60 L 82 60"
          stroke="url(#jd-spike)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="42" cy="18" r="9" fill="#ef4444" />
      </svg>
    </span>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const { user } = useUser()

  const orgName = organization?.name ?? 'Personal'
  const orgInitial = orgName.charAt(0).toUpperCase()
  const primary = NAV.filter((n) => !n.section)
  const account = NAV.filter((n) => n.section === 'Account')
  const current = NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'Dashboard'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-logo">
          <Logo />
          JourneyDebug
        </div>

        <div className="sb-workspace">
          <span className="ws-mark">{orgInitial}</span>
          <span className="name">{orgName}</span>
          <span className="chev">▾</span>
        </div>

        {primary.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={`sb-link${active ? ' active' : ''}`}>
              <span className="ico">{item.ico}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="sb-section-title">Account</div>
        {account.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={`sb-link${active ? ' active' : ''}`}>
              <span className="ico">{item.ico}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="sb-bottom">
          <div className="sb-user">
            <UserButton />
            <div className="info">
              <div className="name">{user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? 'Account'}</div>
              <div className="plan">{orgName}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>{orgName}</span>
            <span className="sep">/</span>
            <span className="current">{current}</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
