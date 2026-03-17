import {
  Brain,
  BookOpenText,
  FileCode2,
  FilePenLine,
  FlaskConical,
  ScrollText,
  Settings2,
  Sparkles,
} from 'lucide-react'

import type { ConfigDocumentName } from '@/components/settings/SettingsPage'
import { EventFeed } from '@/components/EventFeed'
import { GitResearchCanvas } from '@/components/git/GitResearchCanvas'
import { Badge } from '@/components/ui/badge'
import { QuestBashExecOperation } from '@/components/workspace/QuestBashExecOperation'
import { buildToolOperationContent, extractToolSubject, toolTheme } from '@/lib/toolOperations'
import { cn } from '@/lib/utils'
import type {
  FeedItem,
  GraphPayload,
  MemoryCard,
  QuestDocument,
  QuestSummary,
  WorkflowEntry,
  WorkflowPayload,
} from '@/types'

function formatTime(value?: string) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function summarizePaths(paths?: string[]) {
  return (paths || []).filter(Boolean).slice(0, 6)
}

export function describeToolEffect(entry: WorkflowEntry) {
  if (entry.kind !== 'tool_call' && entry.kind !== 'tool_result') {
    return null
  }
  const theme = toolTheme(entry.tool_name || entry.title, entry.args, entry.output)
  return {
    id: entry.id,
    icon: theme.icon,
    label: theme.label,
    verb: theme.verb,
    subject: extractToolSubject(entry.tool_name || entry.title, entry.args, entry.output),
    isResult: entry.kind === 'tool_result',
    tone: theme.tone,
  }
}

function isBashExecWorkflowEntry(entry: WorkflowEntry) {
  const toolName = (entry.tool_name || entry.title || '').toLowerCase()
  return (
    entry.mcp_server === 'bash_exec' ||
    toolName === 'bash_exec.bash_exec' ||
    toolName === 'bash_exec'
  )
}

function ToolCard({ entry, questId }: { entry: WorkflowEntry; questId?: string }) {
  if (questId && isBashExecWorkflowEntry(entry)) {
    return (
      <QuestBashExecOperation
        questId={questId}
        itemId={entry.id}
        toolCallId={entry.tool_call_id}
        toolName={entry.tool_name}
        label={entry.kind === 'tool_call' ? 'tool_call' : 'tool_result'}
        status={entry.status}
        args={entry.args}
        output={entry.output}
        createdAt={entry.created_at}
        metadata={entry.metadata}
      />
    )
  }
  const theme = toolTheme(entry.tool_name || entry.title, entry.args, entry.output)
  const effect = describeToolEffect(entry)
  const Icon = theme.icon
  const isResult = entry.kind === 'tool_result'
  const summary = buildToolOperationContent(entry.kind, entry.tool_name || entry.title, entry.args, entry.output)
  const hasExtraDetails = Boolean(
    entry.tool_name || entry.status || entry.tool_call_id || entry.run_id || entry.args || entry.output
  )
  const title = isResult
    ? `DeepScientist finished ${theme.label.toLowerCase()}`
    : `DeepScientist is ${theme.verb.toLowerCase()}`

  return (
    <article className="workflow-card rounded-[24px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.80),rgba(244,239,233,0.92))] p-3.5 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border border-black/10 dark:border-white/[0.12]', theme.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {entry.status ? <Badge>{entry.status}</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{theme.label}</span>
            {effect?.subject ? <span className="truncate">{effect.subject}</span> : null}
            {entry.created_at ? <span>{formatTime(entry.created_at)}</span> : null}
          </div>
          <div className="mt-2 text-sm leading-6 text-foreground">{summary}</div>
          {hasExtraDetails ? (
            <details className="mt-3 rounded-[18px] border border-black/[0.06] bg-black/[0.03] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground [&::-webkit-details-marker]:hidden">
                Details
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {entry.tool_name ? <Badge>{entry.tool_name}</Badge> : null}
                  {entry.tool_call_id ? <Badge>{entry.tool_call_id}</Badge> : null}
                  {entry.run_id ? <Badge>{entry.run_id}</Badge> : null}
                </div>
                {entry.args ? (
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Arguments
                    </div>
                    <pre className="feed-scrollbar overflow-x-auto text-[12px] leading-6 text-foreground">{entry.args}</pre>
                  </div>
                ) : null}
                {entry.output ? (
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Output
                    </div>
                    <pre className="feed-scrollbar max-h-[220px] overflow-auto text-[12px] leading-6 text-foreground">{entry.output}</pre>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function WorkflowEntryCard({
  entry,
  questId,
}: {
  entry: WorkflowEntry
  questId?: string
}) {
  if (entry.kind === 'tool_call' || entry.kind === 'tool_result') {
    return <ToolCard entry={entry} questId={questId} />
  }

  if (entry.kind === 'thought') {
    return (
      <article className="workflow-card rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,233,0.90))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-[rgba(182,168,210,0.18)]">
            <Brain className="h-4 w-4" />
          </div>
          <span className="font-medium text-foreground">{entry.title}</span>
          {entry.run_id ? <Badge>{entry.run_id}</Badge> : null}
          {entry.created_at ? <span className="ml-auto">{formatTime(entry.created_at)}</span> : null}
        </div>
        <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{entry.summary}</div>
      </article>
    )
  }

  if (entry.kind === 'run') {
    return (
      <article className="workflow-card rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.80),rgba(244,239,233,0.92))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-[rgba(143,163,184,0.18)]">
            <FlaskConical className="h-4 w-4" />
          </div>
          <span className="font-medium text-foreground">{entry.title}</span>
          {entry.skill_id ? <Badge>{entry.skill_id}</Badge> : null}
          {entry.status ? <Badge>{entry.status}</Badge> : null}
          {entry.created_at ? <span className="ml-auto">{formatTime(entry.created_at)}</span> : null}
        </div>
        <div className="text-sm leading-7 text-foreground">{entry.summary}</div>
      </article>
    )
  }

  return (
    <article className="workflow-card rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,233,0.90))] p-4 shadow-card dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-[rgba(183,165,154,0.18)]">
          <ScrollText className="h-4 w-4" />
        </div>
        <span className="font-medium text-foreground">{entry.title}</span>
        {entry.status ? <Badge>{entry.status}</Badge> : null}
        {entry.created_at ? <span className="ml-auto">{formatTime(entry.created_at)}</span> : null}
      </div>
      <div className="text-sm leading-7 text-foreground">{entry.summary}</div>
      {entry.reason ? <div className="mt-2 text-xs text-muted-foreground">Reason: {entry.reason}</div> : null}
      {summarizePaths(entry.paths).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {summarizePaths(entry.paths).map((path) => (
            <Badge key={path}>{path}</Badge>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function WorkflowStudio({
  snapshot,
  workflow,
  feed,
  documents,
  memory,
  graph,
  questId,
  onOpenDocument,
  onOpenConfigDocument,
  onNavigateExplorer,
}: {
  snapshot: QuestSummary | null
  workflow: WorkflowPayload | null
  feed: FeedItem[]
  documents: QuestDocument[]
  memory: MemoryCard[]
  graph: GraphPayload | null
  questId: string
  onOpenDocument: (documentId: string) => void
  onOpenConfigDocument?: (name: ConfigDocumentName) => void
  onNavigateExplorer?: (selection: { mode: 'ref' | 'commit'; revision: string; label: string }) => void
}) {
  const recentDocs = documents.slice(0, 6)
  const recentMemory = memory.slice(0, 6)
  const workflowEntries = workflow?.entries || []
  const configDocs: Array<{ name: ConfigDocumentName; title: string; summary: string }> = [
    { name: 'config', title: 'config.yaml', summary: 'Core runtime, paths, logging, UI, and cloud options.' },
    { name: 'connectors', title: 'connectors.yaml', summary: 'Connector bridge credentials, webhook fields, and relay endpoints.' },
    { name: 'runners', title: 'runners.yaml', summary: 'Runner defaults and model execution options.' },
  ]

  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1.15fr)_420px]">
      <div className="space-y-4">
        <section className="morandi-panel view-panel flex min-h-[420px] flex-col p-4 sm:p-5">
          <div className="relative z-[1] mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Workflow feed</div>
              <div className="text-xs text-muted-foreground">Conversation, artifact summaries, milestones, and runner deltas.</div>
            </div>
            <Badge>{snapshot?.status || 'active'}</Badge>
          </div>
          <EventFeed questId={questId} items={feed} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="morandi-panel view-panel p-5">
            <div className="relative z-[1] space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <div className="text-base font-semibold">Thoughts and tool flow</div>
              </div>
              {workflowEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 px-4 py-10 text-sm text-muted-foreground dark:border-white/[0.12]">
                  Workflow cards will appear after the first run or artifact.
                </div>
              ) : (
                <div className="space-y-3">
                  {workflowEntries.map((entry) => (
                    <WorkflowEntryCard key={entry.id} entry={entry} questId={questId} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-4">
            <section className="morandi-panel view-panel p-5">
              <div className="relative z-[1] space-y-3">
                <div className="flex items-center gap-2">
                  <FilePenLine className="h-4 w-4 text-muted-foreground" />
                  <div className="text-base font-semibold">Files touched</div>
                </div>
                {workflow?.changed_files?.length ? (
                  <div className="space-y-2">
                    {workflow.changed_files.map((file) => (
                      <button
                        key={`${file.source}:${file.path}`}
                        type="button"
                        onClick={() => file.document_id && onOpenDocument(file.document_id)}
                        className="w-full rounded-[22px] bg-black/[0.03] px-3 py-3 text-left text-sm leading-6 text-foreground transition hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                      >
                        <div className="line-clamp-1 font-medium">{file.path}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{file.source}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] bg-black/[0.03] px-3 py-4 text-sm text-muted-foreground dark:bg-white/[0.04]">
                    Changed files will be listed here.
                  </div>
                )}
              </div>
            </section>

            <section className="morandi-panel view-panel p-5">
              <div className="relative z-[1] space-y-3">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  <div className="text-base font-semibold">Documents</div>
                </div>
                <div className="space-y-2">
                  {configDocs.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => onOpenConfigDocument?.(item.name)}
                      className="w-full rounded-[22px] border border-black/[0.06] bg-white/[0.60] px-3 py-3 text-left transition hover:bg-white/[0.78] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <div className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</div>
                        <Badge>settings</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.summary}</div>
                    </button>
                  ))}
                  {recentDocs.map((item) => (
                    <button
                      key={item.document_id}
                      type="button"
                      onClick={() => onOpenDocument(item.document_id)}
                      className="w-full rounded-[22px] bg-black/[0.03] px-3 py-3 text-left transition hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      <div className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <section className="morandi-panel view-panel p-5">
          <div className="relative z-[1] space-y-3">
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-semibold">Memory</div>
            </div>
            {recentMemory.length === 0 ? (
              <div className="rounded-[22px] bg-black/[0.03] px-3 py-4 text-sm text-muted-foreground dark:bg-white/[0.04]">
                No memory cards yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recentMemory.map((item, index) => (
                  <button
                    key={`${item.document_id || item.path || 'memory'}-${index}`}
                    type="button"
                    onClick={() => item.document_id && onOpenDocument(item.document_id)}
                    className="w-full rounded-[22px] bg-black/[0.03] px-3 py-3 text-left transition hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <div className="line-clamp-1 text-sm font-medium text-foreground">{item.title || item.path}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.type || 'memory'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="morandi-panel view-panel p-5">
          <div className="relative z-[1]">
            <GitResearchCanvas questId={questId} graph={graph} onNavigateExplorer={onNavigateExplorer} />
          </div>
        </section>
      </div>
    </div>
  )
}
