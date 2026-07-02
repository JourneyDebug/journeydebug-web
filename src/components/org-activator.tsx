'use client'

import { useEffect } from 'react'
import { useAuth, useClerk, useOrganizationList } from '@clerk/nextjs'

/**
 * Silently activates the user's first organization if no org is active in the
 * current session. Clerk only includes `org_id` in the JWT when an org is
 * active — without this, server components calling auth().getToken() receive
 * a token with no org_id, which the backend rejects with 400.
 */
export function OrgActivator() {
  const { orgId } = useAuth()
  const { setActive } = useClerk()
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  })

  useEffect(() => {
    if (orgId) return
    const memberships = userMemberships?.data
    if (!memberships || memberships.length === 0) return
    const firstOrg = memberships[0].organization
    setActive({ organization: firstOrg.id }).catch(() => {})
  }, [orgId, userMemberships?.data, setActive])

  return null
}
