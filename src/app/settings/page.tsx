'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

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

  const [repos, setRepos] = useState<Repo[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [githubConnecting, setGithubConnecting] = useState(false)

  const [channels, setChannels] = useState<DeliveryChannel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [slackConnecting, setSlackConnecting] = useState(false)

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [integrationType, setIntegrationType] = useState<IntegrationType>('sentry')
  const [newWebhook, setNewWebhook] = useState<{ url: string; secret: string } | null>(null)

  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [savingSecret, setSavingSecret] = useState<string | null>(null)
  const [savedSecret, setSavedSecret] = useState<string | null>(null)

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await getToken({ template: 'default' })
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
    })
  }

  useEffect(() => {
    if (!orgId) return
    authedFetch('/api/repos')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRepos(Array.isArray(d) ? d : (d.repos ?? [])))
      .catch(() => {})
      .finally(() => setReposLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    authedFetch('/api/integrations')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setIntegrations(Array.isArray(d) ? d : (d.integrations ?? [])))
      .catch(() => {})
      .finally(() => setIntegrationsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    authedFetch('/api/delivery-channels')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setChannels(Array.isArray(d) ? d : (d.channels ?? [])))
      .catch(() => {})
      .finally(() => setChannelsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  async function connectGitHub() {
    setGithubConnecting(true)
    try {
      const res = await authedFetch('/api/repos/github-install-url')
      if (res.ok) {
        const data = await res.json()
        const url = data.url ?? data.installUrl ?? data.installationUrl
        if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return }
      }
    } catch { /* fall through */ }
    setGithubConnecting(false)
  }

  async function connectSlack() {
    setSlackConnecting(true)
    try {
      const res = await authedFetch('/api/delivery-channels/slack/connect-url')
      if (res.ok) {
        const data = await res.json()
        const url = data.url ?? data.connectUrl
        if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return }
      }
    } catch { /* fall through */ }
    setSlackConnecting(false)
  }

  async function setChannelRepo(channelId: string, repoId: string | null) {
    const previous = channels
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, repoId } : c)))
    try {
      const res = await authedFetch(`/api/delivery-channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ repoId }),
      })
      if (!res.ok) setChannels(previous)
    } catch { setChannels(previous) }
  }

  async function submitIntegration(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSubmitting(true)
    setNewWebhook(null)
    try {
      const res = await authedFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ type: integrationType }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError(err.detail ?? err.message ?? `Request failed (${res.status})`)
        return
      }
      const created = await res.json()
      setIntegrations((prev) => [...prev.filter((i) => i.id !== created.id), created])
      if (created.webhookSecret) setNewWebhook({ url: created.webhookUrl, secret: created.webhookSecret })
    } catch {
      setFormError('Could not connect to backend. Make sure it is running.')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function saveIntegrationSecret(integrationId: string) {
    const secret = (secretDrafts[integrationId] ?? '').trim()
    if (!secret) return
    setSavingSecret(integrationId)
    setSavedSecret(null)
    try {
      const res = await authedFetch(`/api/integrations/${integrationId}/secret`, {
        method: 'PATCH',
        body: JSON.stringify({ webhookSecret: secret }),
      })
      if (res.ok) {
        setSavedSecret(integrationId)
        setSecretDrafts((prev) => ({ ...prev, [integrationId]: '' }))
      }
    } catch { /* leave draft to retry */ } finally {
      setSavingSecret(null)
    }
  }

  return (
    <div className="content">
      <div className="page-title-row">
        <div>
          <h1>Settings</h1>
          <p className="sub">Connect repositories, error sources, and where diagnoses get delivered.</p>
        </div>
      </div>

      {/* GitHub */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <h3>GitHub Repositories</h3>
            <div className="sub">So JourneyDebug can map errors to source files and the deploy diff.</div>
          </div>
          <button className="btn btn-ghost" onClick={connectGitHub} disabled={githubConnecting}>
            {githubConnecting ? 'Redirecting…' : '+ Connect GitHub'}
          </button>
        </div>
        <div className="conn-list">
          {reposLoading && <div className="card-body" style={{ color: 'var(--text-subtle)' }}>Loading…</div>}
          {!reposLoading && repos.length === 0 && (
            <div className="card-body" style={{ color: 'var(--text-subtle)' }}>No repositories connected yet.</div>
          )}
          {repos.map((repo) => (
            <div className="conn" key={repo.id}>
              <span className="ico gh">GH</span>
              <div className="info">
                <div className="name">{repo.repoFullName}</div>
              </div>
              <span className="badge-stats" />
              <span className={`pill ${repo.isActive ? 'success' : 'muted'}`}><span className="dot" /> {repo.isActive ? 'active' : 'inactive'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <h3>Error Monitoring</h3>
            <div className="sub">Generate a webhook to receive and analyse error events.</div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={submitIntegration} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="type">Provider</label>
              <select id="type" className="input mono" style={{ minWidth: 180 }} value={integrationType}
                onChange={(e) => setIntegrationType(e.target.value as IntegrationType)}>
                <option value="sentry">Sentry</option>
                <option value="bugsnag">Bugsnag</option>
                <option value="datadog">Datadog</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Generating…' : 'Generate Webhook'}
            </button>
          </form>
          {formError && <p style={{ color: '#fca5a5', fontSize: 12.5, marginTop: 10 }}>{formError}</p>}

          {newWebhook && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="label">Webhook URL — set this in your provider</div>
                <div className="code-block">{newWebhook.url}</div>
              </div>
              <div>
                <div className="label">Secret</div>
                <div className="code-block">{newWebhook.secret}</div>
              </div>
              <p className="field-hint">This secret won&apos;t be shown again.</p>
            </div>
          )}
        </div>

        {!integrationsLoading && integrations.length > 0 && (
          <div className="conn-list" style={{ borderTop: '1px solid var(--border)' }}>
            {integrations.map((it) => (
              <div className="conn" key={it.id} style={{ gridTemplateColumns: '36px 1fr' }}>
                <span className="ico sentry">{it.type.slice(0, 2).toUpperCase()}</span>
                <div className="info" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="name" style={{ textTransform: 'capitalize' }}>{it.type} <code>{it.webhookUrl}</code></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="password" className="input mono" style={{ maxWidth: 360, height: 34 }}
                      placeholder="Provider signing secret (e.g. Sentry client secret)"
                      value={secretDrafts[it.id] ?? ''}
                      onChange={(e) => setSecretDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))} />
                    <button className="btn btn-ghost" disabled={savingSecret === it.id || !(secretDrafts[it.id] ?? '').trim()}
                      onClick={() => saveIntegrationSecret(it.id)}>
                      {savingSecret === it.id ? 'Saving…' : 'Save secret'}
                    </button>
                    {savedSecret === it.id && <span style={{ fontSize: 12, color: '#6ee7b7' }}>Saved ✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slack delivery */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <h3>Slack Delivery</h3>
            <div className="sub">Where diagnoses get posted. Scope a channel to a repo, or leave it as the org-wide default.</div>
          </div>
          <button className="btn btn-ghost" onClick={connectSlack} disabled={slackConnecting}>
            {slackConnecting ? 'Redirecting…' : '+ Connect Slack'}
          </button>
        </div>
        <div className="conn-list">
          {channelsLoading && <div className="card-body" style={{ color: 'var(--text-subtle)' }}>Loading…</div>}
          {!channelsLoading && channels.length === 0 && (
            <div className="card-body" style={{ color: 'var(--text-subtle)' }}>No Slack channels connected yet.</div>
          )}
          {channels.map((channel) => (
            <div className="conn" key={channel.id}>
              <span className="ico slack">SL</span>
              <div className="info"><div className="name">{channel.name}</div></div>
              <span className="badge-stats" />
              <select aria-label={`Repository for ${channel.name}`} className="input mono" style={{ height: 34, maxWidth: 240 }}
                value={channel.repoId ?? ''} onChange={(e) => setChannelRepo(channel.id, e.target.value || null)}>
                <option value="">All repositories</option>
                {repos.map((repo) => (<option key={repo.id} value={repo.id}>{repo.repoFullName}</option>))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
