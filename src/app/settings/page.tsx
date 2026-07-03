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
  repoFullName: string
  isActive: boolean
}

interface Integration {
  id: string
  type: string
  webhookUrl: string
  webhookSecret?: string
}

interface DeliveryChannel {
  id: string
  name: string
  type: string
  repoId: string | null
}

type IntegrationType = 'sentry' | 'bugsnag' | 'datadog'

export default function SettingsPage() {
  const { getToken, orgId } = useAuth()

  // GitHub section state
  const [repos, setRepos] = useState<Repo[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [githubConnecting, setGithubConnecting] = useState(false)

  // Slack section state
  const [channels, setChannels] = useState<DeliveryChannel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [slackConnecting, setSlackConnecting] = useState(false)

  // Integrations section state
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  const [integrationType, setIntegrationType] = useState<IntegrationType>('sentry')
  const [newWebhook, setNewWebhook] = useState<{ url: string; secret: string } | null>(null)

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
    if (!orgId) return
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
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
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
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    async function loadChannels() {
      try {
        const res = await authedFetch('/api/delivery-channels')
        if (res.ok) {
          const data = await res.json()
          setChannels(Array.isArray(data) ? data : (data.channels ?? []))
        }
      } catch {
        // Non-fatal: leave empty
      } finally {
        setChannelsLoading(false)
      }
    }
    loadChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  async function connectGitHub() {
    setGithubConnecting(true)
    try {
      const res = await authedFetch('/api/repos/github-install-url')
      if (res.ok) {
        const data = await res.json()
        const url = data.url ?? data.installUrl ?? data.installationUrl
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
          return
        }
      }
    } catch {
      // Fall through
    }
    setGithubConnecting(false)
  }

  async function connectSlack() {
    setSlackConnecting(true)
    try {
      const res = await authedFetch('/api/delivery-channels/slack/connect-url')
      if (res.ok) {
        const data = await res.json()
        const url = data.url ?? data.connectUrl
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
          return
        }
      }
    } catch {
      // Fall through
    }
    setSlackConnecting(false)
  }

  async function setChannelRepo(channelId: string, repoId: string | null) {
    // Optimistic update; revert on failure
    const previous = channels
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, repoId } : c)))
    try {
      const res = await authedFetch(`/api/delivery-channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ repoId }),
      })
      if (!res.ok) setChannels(previous)
    } catch {
      setChannels(previous)
    }
  }

  async function submitIntegration(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)
    setFormSubmitting(true)
    setNewWebhook(null)

    try {
      const res = await authedFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ type: integrationType }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError(err.message ?? `Request failed (${res.status})`)
        return
      }

      const created = await res.json()
      setIntegrations((prev) => [...prev.filter((i) => i.id !== created.id), created])
      if (created.webhookSecret) {
        setNewWebhook({ url: created.webhookUrl, secret: created.webhookSecret })
      }
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
                      {repo.repoFullName}
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

      {/* Slack delivery section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slack Delivery</CardTitle>
          <CardDescription>
            Connect a Slack workspace so JourneyDebug can post diagnoses to a channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={connectSlack}
            disabled={slackConnecting}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {slackConnecting ? 'Redirecting…' : 'Connect Slack'}
          </Button>

          {!channelsLoading && channels.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Connected channels</p>
                <ul className="space-y-2">
                  {channels.map((channel) => (
                    <li key={channel.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{channel.name}</span>
                      <select
                        aria-label={`Repository for ${channel.name}`}
                        value={channel.repoId ?? ''}
                        onChange={(e) => setChannelRepo(channel.id, e.target.value || null)}
                        className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">All repositories</option>
                        {repos.map((repo) => (
                          <option key={repo.id} value={repo.id}>
                            {repo.repoFullName}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Scope a channel to a repository to receive only that repo&apos;s diagnoses. &ldquo;All repositories&rdquo; is the org-wide default.
                </p>
              </div>
            </>
          )}

          {!channelsLoading && channels.length === 0 && (
            <p className="text-sm text-muted-foreground">No Slack channels connected yet.</p>
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

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button type="submit" disabled={formSubmitting}>
              {formSubmitting ? 'Generating…' : 'Generate Webhook'}
            </Button>
          </form>

          {newWebhook && (
            <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3 text-sm">
              <p className="font-medium text-foreground">Configure this in your Sentry project settings:</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Webhook URL</p>
                <code className="block break-all text-xs bg-background border border-border rounded px-2 py-1.5">
                  {newWebhook.url}
                </code>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Secret</p>
                <code className="block break-all text-xs bg-background border border-border rounded px-2 py-1.5">
                  {newWebhook.secret}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">This secret will not be shown again.</p>
            </div>
          )}

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
                      <span className="text-muted-foreground truncate text-xs">{integration.webhookUrl}</span>
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
