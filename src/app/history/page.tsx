import { apiFetch } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type AnalysisStatus = 'completed' | 'failed' | 'pending' | 'processing'

interface Analysis {
  id: string
  status: AnalysisStatus
  repo?: string
  integration?: string
  confidence?: number
  primaryFile?: string
  createdAt: string
}

function StatusBadge({ status }: { status: AnalysisStatus }) {
  const variants: Record<AnalysisStatus, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${variants[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

export default async function HistoryPage() {
  let analyses: Analysis[] = []
  let fetchError: string | null = null

  try {
    const res = await apiFetch('/api/analyses?limit=50')
    if (!res.ok) {
      fetchError = `Failed to load analyses (${res.status})`
    } else {
      const data = await res.json()
      analyses = Array.isArray(data) ? data : (data.analyses ?? data.items ?? [])
    }
  } catch {
    fetchError = 'Could not connect to the backend. Make sure it is running on port 8080.'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Analysis History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All error analyses run through JourneyDebug
        </p>
      </div>

      {fetchError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No analyses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a Sentry integration and trigger your first analysis.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[140px]">Issue ID</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead>Repo</TableHead>
                <TableHead>Integration</TableHead>
                <TableHead className="w-[100px]">Confidence</TableHead>
                <TableHead>Primary File</TableHead>
                <TableHead className="w-[160px]">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((analysis) => (
                <TableRow key={analysis.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {analysis.id}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={analysis.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {analysis.repo ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {analysis.integration ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {analysis.confidence != null ? (
                      `${Math.round(analysis.confidence * 100)}%`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[240px] truncate">
                    {analysis.primaryFile ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(analysis.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
