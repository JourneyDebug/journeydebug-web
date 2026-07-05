'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface Analysis {
  id: string
  externalIssueId?: string
  status: string
  diagnosisText?: string
  suggestedFix?: string
  confidence?: number
  primaryFile?: string
  primaryLine?: number
  deploySha?: string
  lastGoodSha?: string
  repoFullName?: string
  integrationType?: string
  errorTitle?: string
  culprit?: string
  eventCount?: string
  userCount?: number
  issueUrl?: string
  createdAt: string
}

const shortSha = (s?: string) => (s && s !== 'unknown' ? s.slice(0, 7) : null)
const repoShort = (full?: string) => (full ? full.split('/').pop() : '—')
const confPct = (c?: number) => (c == null ? null : Math.round(c > 1 ? c : c * 100))
const confClass = (pct: number | null) => (pct == null ? '' : pct >= 75 ? '' : pct >= 50 ? ' warn' : ' low')

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (sameDay(d, yesterday)) return 'Yesterday · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function AnalysesPage() {
  const { getToken, orgId } = useAuth()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!orgId) return
    let active = true
    async function load() {
      try {
        const token = await getToken({ template: 'default' })
        const res = await fetch(`${API_URL}/api/analyses`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok && active) {
          const data = await res.json()
          const list: Analysis[] = Array.isArray(data) ? data : (data.analyses ?? [])
          setAnalyses(list)
          setSelectedId((prev) => prev ?? list[0]?.id ?? null)
        }
      } catch {
        // non-fatal — keep whatever we have
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    // Poll so new/updated analyses appear without a manual refresh (the "live" pill).
    const timer = setInterval(load, 8000)
    return () => {
      active = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return analyses
    return analyses.filter((a) =>
      [a.errorTitle, a.repoFullName, a.deploySha, a.primaryFile, a.culprit, a.externalIssueId,
        a.diagnosisText, a.suggestedFix]
        .some((f) => f?.toLowerCase().includes(q)),
    )
  }, [analyses, query])

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null

  const stats = useMemo(() => {
    const confs = analyses.map((a) => confPct(a.confidence)).filter((p): p is number => p != null)
    const avg = confs.length ? Math.round(confs.reduce((s, p) => s + p, 0) / confs.length) : null
    return { count: analyses.length, avg }
  }, [analyses])

  // Group filtered list by day
  const groups = useMemo(() => {
    const out: { label: string; items: Analysis[] }[] = []
    for (const a of filtered) {
      const label = dayLabel(a.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(a)
      else out.push({ label, items: [a] })
    }
    return out
  }, [filtered])

  return (
    <div className="content" style={{ maxWidth: 1280 }}>
      <div className="page-title-row">
        <div>
          <h1>Analyses</h1>
          <p className="sub">Every diagnosis the agent has produced. Click a row to see the full reasoning, fix, and deploy context.</p>
        </div>
        <span className="pill accent"><span className="dot" /> live</span>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat">
          <div className="label">Diagnoses</div>
          <div className="value">{stats.count}</div>
        </div>
        <div className="stat">
          <div className="label">Avg confidence</div>
          <div className="value">{stats.avg == null ? '—' : stats.avg}<span className="unit">%</span></div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search">
          <span className="ico">⌕</span>
          <input placeholder="Search by error, SHA, file, or repo…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="md">
        <div className="list">
          <div className="list-head">
            <span className="ct">{`// ${filtered.length} results · sorted by recency`}</span>
          </div>
          <div className="list-body">
            {loading && <div style={{ padding: 16, color: 'var(--text-subtle)', fontSize: 13 }}>Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 16, color: 'var(--text-subtle)', fontSize: 13 }}>No analyses yet.</div>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <div className="day-sep">{g.label}</div>
                {g.items.map((a) => {
                  const pct = confPct(a.confidence)
                  return (
                    <div
                      key={a.id}
                      className={`row${selected?.id === a.id ? ' selected' : ''}`}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <div className="row-top">
                        <span className="time">{timeLabel(a.createdAt)}</span>
                        <span className="sep">·</span>
                        <span className="repo">{repoShort(a.repoFullName)}</span>
                        {pct != null && (
                          <span style={{ marginLeft: 'auto' }}>
                            <span className={`conf${confClass(pct)}`}>
                              <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                              <span className="pct">{pct}%</span>
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="errtype">{a.errorTitle ?? a.externalIssueId ?? 'Unknown error'}</div>
                      <div className="meta-line">
                        {shortSha(a.deploySha) && <span className="sha">{shortSha(a.deploySha)}</span>}
                        {a.eventCount && <span>{a.eventCount} events</span>}
                        {a.userCount != null && (<><span className="sep">·</span><span>{a.userCount} users</span></>)}
                        {a.status !== 'completed' && (<><span className="sep">·</span><span style={{ color: 'var(--text-subtle)' }}>{a.status}</span></>)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="detail">
          {!selected ? (
            <div style={{ padding: 40, color: 'var(--text-subtle)' }}>Select an analysis to see its diagnosis.</div>
          ) : (
            <AnalysisDetail a={selected} />
          )}
        </div>
      </div>
    </div>
  )
}

function AnalysisDetail({ a }: { a: Analysis }) {
  const pct = confPct(a.confidence)
  const githubDiff = a.repoFullName && shortSha(a.deploySha)
    ? `https://github.com/${a.repoFullName}/commit/${a.deploySha}`
    : null

  return (
    <>
      <div className="detail-head">
        <div className="crumb-row">
          <div className="left"><span>analyses/</span><span style={{ color: 'var(--text)' }}>{a.id.slice(0, 12)}</span></div>
        </div>
        <h2>
          <span className="alert">🚨</span>
          <span>{a.errorTitle ?? a.externalIssueId ?? 'Error'}</span>
          {shortSha(a.deploySha) && <code>{shortSha(a.deploySha)}</code>}
        </h2>
        <div className="meta">
          <strong>{a.repoFullName ?? '—'}</strong>
          {a.culprit && (<><span className="sep">·</span>{a.culprit}</>)}
          {a.eventCount && (<><span className="sep">·</span><strong>{a.eventCount} events</strong></>)}
          {a.userCount != null && (<><span className="sep">·</span><strong>{a.userCount} users</strong></>)}
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-meta">
          <div className="meta-card">
            <div className="h">{'// introduced in'}</div>
            <div className="v">{shortSha(a.deploySha) ? <code>{shortSha(a.deploySha)}</code> : <span style={{ color: 'var(--text-subtle)' }}>unknown</span>}</div>
          </div>
          <div className="meta-card">
            <div className="h">{'// last good deploy'}</div>
            <div className="v">{shortSha(a.lastGoodSha) ? <code>{shortSha(a.lastGoodSha)}</code> : <span style={{ color: 'var(--text-subtle)' }}>n/a</span>}</div>
          </div>
          <div className="meta-card">
            <div className="h">{'// primary file'}</div>
            <div className="v">{a.primaryFile ? <code>{a.primaryFile}{a.primaryLine != null ? `:${a.primaryLine}` : ''}</code> : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</div>
          </div>
          <div className="meta-card">
            <div className="h">{'// source'}</div>
            <div className="v" style={{ textTransform: 'capitalize' }}>{a.integrationType ?? '—'}</div>
          </div>
        </div>

        {a.status === 'completed' ? (
          <>
            <div className="dcard diagnosis">
              <div className="dcard-title">✦ Diagnosis</div>
              <div className="dcard-body">{a.diagnosisText ?? 'No diagnosis text.'}</div>
            </div>
            <div className="dcard fix">
              <div className="dcard-title">🎯 Suggested fix</div>
              <div className="dcard-body">{a.suggestedFix ?? 'No suggested fix.'}</div>
              {pct != null && (
                <div className="dcard-footer">
                  <span className={`conf${confClass(pct)}`}>
                    <span style={{ color: 'var(--text-muted)' }}>confidence</span>
                    <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                    <span className="pct">{pct}%</span>
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="dcard context">
            <div className="dcard-title">↻ Status</div>
            <div className="dcard-body">This analysis is <strong>{a.status}</strong>.</div>
          </div>
        )}
      </div>

      <div className="detail-foot">
        <div />
        <div className="links">
          {a.issueUrl && <a className="link-btn" href={a.issueUrl} target="_blank" rel="noreferrer">View in Sentry <span className="ext">↗</span></a>}
          {githubDiff && <a className="link-btn" href={githubDiff} target="_blank" rel="noreferrer">Commit on GitHub <span className="ext">↗</span></a>}
        </div>
      </div>
    </>
  )
}
