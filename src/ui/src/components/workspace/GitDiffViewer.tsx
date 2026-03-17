'use client'

import * as React from 'react'
import {
  Decoration,
  Diff,
  Hunk,
  parseDiff,
  type DiffType,
  type FileData as ParsedDiffFile,
} from 'react-diff-view'

import { cn } from '@/lib/utils'
import type { GitDiffPayload } from '@/types'

function mapDiffType(status?: string | null): DiffType {
  switch (String(status || '').trim().toLowerCase()) {
    case 'added':
    case 'add':
      return 'add'
    case 'deleted':
    case 'delete':
      return 'delete'
    case 'renamed':
    case 'rename':
      return 'rename'
    case 'copied':
    case 'copy':
      return 'copy'
    default:
      return 'modify'
  }
}

function buildFallbackDiff(payload: GitDiffPayload): string {
  const oldPath = payload.old_path || payload.path
  const newPath = payload.path
  const header = [
    `diff --git a/${oldPath} b/${newPath}`,
    `--- a/${oldPath}`,
    `+++ b/${newPath}`,
  ]
  return [...header, ...payload.lines].join('\n')
}

function buildUnifiedDiff(payload: GitDiffPayload): string {
  if (!payload.lines.length) return ''
  const firstLine = String(payload.lines[0] || '')
  if (firstLine.startsWith('diff --git ')) {
    return payload.lines.join('\n')
  }
  return buildFallbackDiff(payload)
}

function formatPathLabel(diff: GitDiffPayload) {
  if (diff.old_path && diff.old_path !== diff.path) {
    return `${diff.old_path} → ${diff.path}`
  }
  return diff.path
}

function parseSingleFile(text: string): ParsedDiffFile | null {
  if (!text.trim()) return null
  try {
    const files = parseDiff(text, { nearbySequences: 'zip' })
    return files[0] ?? null
  } catch {
    return null
  }
}

export function GitDiffViewer({
  diff,
  className,
}: {
  diff: GitDiffPayload | null | undefined
  className?: string
}) {
  const diffText = React.useMemo(() => (diff ? buildUnifiedDiff(diff) : ''), [diff])
  const parsed = React.useMemo(() => parseSingleFile(diffText), [diffText])

  if (!diff) {
    return <div className="text-sm leading-7 text-muted-foreground">No patch selected.</div>
  }

  if (diff.binary) {
    return (
      <div className={cn('ds-stage-diff-shell', className)}>
        <div className="ds-stage-diff-filehead">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{formatPathLabel(diff)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Binary file changed.</div>
          </div>
        </div>
      </div>
    )
  }

  if (!parsed || !parsed.hunks.length) {
    return (
      <div className={cn('ds-stage-diff-shell', className)}>
        <div className="ds-stage-diff-filehead">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{formatPathLabel(diff)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {String(diff.status || 'modified')}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-700 dark:text-emerald-300">+{diff.added || 0}</span>
            <span className="text-rose-700 dark:text-rose-300">-{diff.removed || 0}</span>
          </div>
        </div>
        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] leading-6 text-foreground">
          {diff.lines.join('\n') || 'No patch lines available.'}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn('ds-stage-diff-shell', className)}>
      <div className="ds-stage-diff-filehead">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{formatPathLabel(diff)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {String(diff.status || 'modified')} · {diff.base} → {diff.head}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-700 dark:text-emerald-300">+{diff.added || 0}</span>
          <span className="text-rose-700 dark:text-rose-300">-{diff.removed || 0}</span>
        </div>
      </div>

      <div className="max-h-[36rem] overflow-auto">
        <Diff
          viewType="unified"
          diffType={parsed.type || mapDiffType(diff.status)}
          hunks={parsed.hunks}
          gutterType="default"
          className="ds-github-diff-table"
        >
          {(hunks) =>
            hunks.flatMap((hunk) => [
              <Decoration key={`decoration-${hunk.content}`}>
                <div className="ds-github-diff-hunk">{hunk.content}</div>
              </Decoration>,
              <Hunk key={`hunk-${hunk.content}`} hunk={hunk} />,
            ])
          }
        </Diff>
      </div>

      {diff.truncated ? (
        <div className="border-t border-black/[0.06] px-4 py-2 text-[11px] text-muted-foreground dark:border-white/[0.08]">
          Patch output is truncated.
        </div>
      ) : null}
    </div>
  )
}

export default GitDiffViewer
