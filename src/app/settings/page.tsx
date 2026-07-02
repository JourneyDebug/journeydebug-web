'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface Repo {
  id: string
  name: string
  fullName?: string
}

interface Integration {
  id: string
  type: string
  externalOrgId: string
  projectSlugs?: string[]
}

type IntegrationType = 'sentry' | 'bugsnag' | 'datadog'

export default function SettingsPage() {
  const { getToken } = useAuth()

  // GitHub section state
  const [repos, setRepos] = useState<Repo[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [githubConnecting, setGithubConnecting] = useState(false)

  // Integrations section state
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  const [integrationType, setIntegrationType] = useState<IntegrationType>('sentry')
  const [externalOrgId, setExternalOrgId] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [projectSlugs, setProjectSlugs] = useState('')

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await getToken({ template: 'default' })
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })
  }

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await authedFetch('/api/repos')
        if (res.ok) {
          const data = await res.json()
          setRepos(Array.isArray(data) ? data : (data.repos ?? []))
        }
      } catch {
        // Non-fatal: leave empty
      } finally {
        setReposLoading(false)
      }
    }
    loadRepos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function loadIntegrations() {
      try {
        const res = await authedFetch('/api/integrations')
        if (res.ok) {
          const data = await res.json()
          setIntegrations(Array.isArray(data) ? data : (data.integrations ?? []))
        }
      } catch {
        // Non-fatal: leave empty
      } finally {
        setIntegrationsLoading(false)
      }
    }
    loadIntegrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectGitHub() {
    setGithubConnecting(true)
    try {
      const res = await authedFetch('/api/repos/github/install-url')
      if (res.ok) {
        const data = await res.json()
        const url = data.url ?? data.installUrl ?? data.installationUrl
        if (url) {
          window.location.href = url
          return
        }
      }
    } catch {
      // Fall through
    }
    setGithubConnecting(false)
  }

  async function submitIntegration(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)
    setFormSubmitting(true)

    try {
      const slugs = projectSlugs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await authedFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({
          type: integrationType,
          externalOrgId,
          apiToken,
          projectSlugs: slugs,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError(err.message ?? `Request failed (${res.status})`)
        return
      }

      const created = await res.json()
      setIntegrations((prev) => [...prev, created])
      setExternalOrgId('')
      setApiToken('')
      setProjectSlugs('')
      setFormSuccess(true)
    } catch {
      setFormError('Could not connect to backend. Make sure it is running.')
    } finally {
      setFormSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your integrations and connected repositories
        </p>
      </div>

      {/* GitHub section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitHub Repository</CardTitle>
          <CardDescription>
            Connect a GitHub repository so JourneyDebug can map errors to source files and commits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={connectGitHub}
            disabled={githubConnecting}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {githubConnecting ? 'Redirecting…' : 'Connect GitHub'}
          </Button>

          {!reposLoading && repos.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Connected repositories</p>
                <ul className="space-y-1">
                  {repos.map((repo) => (
                    <li key={repo.id} className="text-sm text-muted-foreground">
                      {repo.fullName ?? repo.name}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {!reposLoading && repos.length === 0 && (
            <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Sentry Integration section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Error Monitoring Integration</CardTitle>
          <CardDescription>
            Connect Sentry, Bugsnag, or Datadog to start receiving and analysing error events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={submitIntegration} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="type">Provider</Label>
              <select
                id="type"
                value={integrationType}
                onChange={(e) => setIntegrationType(e.target.value as IntegrationType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="sentry">Sentry</option>
                <option value="bugsnag">Bugsnag</option>
                <option value="datadog">Datadog</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="externalOrgId">Organization ID</Label>
              <Input
                id="externalOrgId"
                placeholder="your-org-slug"
                value={externalOrgId}
                onChange={(e) => setExternalOrgId(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="••••••••••••••••"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="projectSlugs">
                Project Slugs{' '}
                <span className="text-muted-foreground font-normal">(comma-separated)</span>
              </Label>
              <Input
                id="projectSlugs"
                placeholder="my-project, another-project"
                value={projectSlugs}
                onChange={(e) => setProjectSlugs(e.target.value)}
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            {formSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">Integration connected.</p>
            )}

            <Button type="submit" disabled={formSubmitting}>
              {formSubmitting ? 'Connecting…' : 'Connect Integration'}
            </Button>
          </form>

          {!integrationsLoading && integrations.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Connected integrations</p>
                <ul className="space-y-2">
                  {integrations.map((integration) => (
                    <li key={integration.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="capitalize">
                        {integration.type}
                      </Badge>
                      <span className="text-muted-foreground">{integration.externalOrgId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {!integrationsLoading && integrations.length === 0 && (
            <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
