'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, GitCompare, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GitDiffViewer } from '@/components/workspace/GitDiffViewer'
import { client } from '@/lib/api'
import type { PluginComponentProps } from '@/lib/types/tab'
import { cn } from '@/lib/utils'
import type { GitCompareFile, GitDiffPayload } from '@/types'

type DiffViewerContext = {
  projectId?: string
  base?: string
  head?: string
  path?: string
  status?: string | null
  oldPath?: string | null
  added?: number | null
  removed?: number | null
}

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

const formatPathLabel = (path?: string | null, oldPath?: string | null) => {
  if (path && oldPath && path !== oldPath) {
    return `${oldPath} → ${path}`
  }
  return path || 'Diff'
}

export default function GitDiffViewerPlugin({
  context,
  setTitle,
}: PluginComponentProps) {
  const custom = (context.customData ?? {}) as DiffViewerContext
  const projectId = normalizeString(custom.projectId)
  const base = normalizeString(custom.base)
  const head = normalizeString(custom.head)
  const path = normalizeString(custom.path)
  const status = normalizeString(custom.status)
  const oldPath = normalizeString(custom.oldPath)
  const added = normalizeNumber(custom.added)
  const removed = normalizeNumber(custom.removed)

  React.useEffect(() => {
    setTitle(formatPathLabel(path, oldPath))
  }, [oldPath, path, setTitle])

  const diffQuery = useQuery({
    queryKey: ['git-diff-viewer', projectId, base, head, path],
    queryFn: () => client.gitDiffFile(projectId!, base!, head!, path!),
    enabled: Boolean(projectId && base && head && path),
    staleTime: 30_000,
  })

  const mergedDiff = React.useMemo<GitDiffPayload | null>(() => {
    const payload = diffQuery.data ?? null
    if (!payload || !path || !base || !head) return payload
    return {
      ...payload,
      path,
      base,
      head,
      old_path: payload.old_path || oldPath || undefined,
      status: payload.status || status || undefined,
      added: payload.added ?? added ?? undefined,
      removed: payload.removed ?? removed ?? undefined,
    }
  }, [added, base, diffQuery.data, head, oldPath, path, removed, status])

  if (!projectId || !base || !head || !path) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
        Missing diff context.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[rgba(250,248,244,0.86)] dark:bg-[rgba(18,20,24,0.92)]">
      <div className="border-b border-black/[0.06] px-6 py-5 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <GitCompare className="h-3.5 w-3.5" />
                Diff
              </span>
              <span>·</span>
              <span>{status || 'modified'}</span>
            </div>
            <div className="mt-2 break-words text-[24px] font-semibold tracking-[-0.03em] text-foreground">
              {formatPathLabel(path, oldPath)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{base}</span>
              <span>→</span>
              <span>{head}</span>
              {added != null ? <span className="text-emerald-700 dark:text-emerald-300">+{added}</span> : null}
              {removed != null ? <span className="text-rose-700 dark:text-rose-300">-{removed}</span> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void diffQuery.refetch()
              }}
              className="h-9 rounded-full border-black/[0.08] bg-white/[0.86] px-3 text-[12px] shadow-none hover:bg-black/[0.03] dark:border-white/[0.1] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', diffQuery.isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white/[0.7] px-3 py-2 text-[11px] text-muted-foreground dark:border-white/[0.1] dark:bg-white/[0.03]">
              <ExternalLink className="h-3.5 w-3.5" />
              Central diff view
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {diffQuery.isLoading ? (
          <div className="text-sm leading-7 text-muted-foreground">Loading patch…</div>
        ) : diffQuery.isError ? (
          <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/70 px-4 py-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
            Failed to load diff.
          </div>
        ) : (
          <GitDiffViewer diff={mergedDiff} className="border border-black/[0.06] bg-white/[0.92] shadow-none dark:border-white/[0.08] dark:bg-[rgba(24,26,31,0.92)]" />
        )}
      </div>
    </div>
  )
}
