import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertCircle,
  Brain,
  Bot,
  CheckCircle2,
  GitCommitHorizontal,
  Loader2,
  Square,
  Sparkles,
  User2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { AgentCommentBlock } from '@/components/feed/AgentCommentBlock'
import { QuestBashExecOperation } from '@/components/workspace/QuestBashExecOperation'
import { QuestMcpOperation } from '@/components/workspace/QuestMcpOperation'
import {
  findLatestRenderedOperationId,
  mergeFeedItemsForRender,
  type RenderFeedItem,
  type RenderOperationFeedItem,
} from '@/lib/feedOperations'
import OrbitLogoStatus from '@/lib/plugins/ai-manus/components/OrbitLogoStatus'
import { ThinkingIndicator } from '@/lib/plugins/ai-manus/components/ThinkingIndicator'
import { buildToolOperationContent, extractToolSubject, toolTheme } from '@/lib/toolOperations'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/types'

type EventFeedProps = {
  questId?: string
  items: FeedItem[]
  loading?: boolean
  restoring?: boolean
  connectionState?: 'connecting' | 'connected' | 'reconnecting' | 'error'
  emptyLabel?: string
  bottomInset?: number
}

function isBashExecOperation(item: Extract<FeedItem, { type: 'operation' }>) {
  const toolName = (item.toolName || '').toLowerCase()
  return (
    item.mcpServer === 'bash_exec' ||
    toolName === 'bash_exec.bash_exec' ||
    toolName === 'bash_exec'
  )
}

function isStructuredMcpOperation(item: Extract<FeedItem, { type: 'operation' }>) {
  const toolName = (item.toolName || '').toLowerCase()
  return (
    item.mcpServer === 'memory' ||
    item.mcpServer === 'artifact' ||
    toolName.startsWith('memory.') ||
    toolName.startsWith('artifact.')
  )
}

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

function useStreamingContent(content: string, active: boolean) {
  const [displayed, setDisplayed] = useState(content)

  useEffect(() => {
    if (!active) {
      setDisplayed(content)
      return
    }

    let frame: number | null = null
    let index = 0
    setDisplayed('')

    const tick = () => {
      index = Math.min(content.length, index + Math.max(1, Math.ceil((content.length - index) / 12)))
      setDisplayed(content.slice(0, index))
      if (index < content.length) {
        frame = window.setTimeout(tick, 56)
      }
    }

    frame = window.setTimeout(tick, 24)
    return () => {
      if (frame) {
        window.clearTimeout(frame)
      }
    }
  }, [active, content])

  return displayed
}

function StatusPlaceholder({
  loading,
  restoring,
  connectionState,
  emptyLabel,
}: {
  loading: boolean
  restoring: boolean
  connectionState: EventFeedProps['connectionState']
  emptyLabel: string
}) {
  const statusLabel =
    restoring || loading
      ? 'Restoring recent Copilot trace…'
      : connectionState === 'reconnecting'
        ? 'Quest event stream reconnecting…'
        : connectionState === 'error'
          ? 'Quest event stream encountered an error.'
          : connectionState === 'connecting'
            ? 'Connecting to quest event stream…'
            : emptyLabel

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[30px] border border-dashed border-black/10 px-6 text-sm dark:border-white/[0.12]">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[22px] border border-black/10 bg-white/[0.82] dark:border-white/[0.12] dark:bg-white/[0.05]">
          {connectionState === 'error' ? (
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          ) : (
            <OrbitLogoStatus compact sizePx={26} toolCount={0} resetKey={statusLabel} />
          )}
        </div>
        <div className="text-sm font-semibold text-foreground">{statusLabel}</div>
        {loading || restoring || connectionState === 'connecting' || connectionState === 'reconnecting' ? (
          <div className="mt-2">
            <ThinkingIndicator compact />
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">Codex tool calls, messages, and artifacts appear here.</div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  item,
  streaming,
}: {
  item: Extract<FeedItem, { type: 'message' }>
  streaming: boolean
}) {
  const isAssistant = item.role === 'assistant'
  const isReasoning = Boolean(item.reasoning)
  const renderedContent = useStreamingContent(item.content, streaming)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative flex gap-4 rounded-[30px] px-4 py-4 transition-all sm:px-5',
        isAssistant
          ? isReasoning
            ? 'border border-black/[0.06] bg-[linear-gradient(180deg,rgba(251,249,244,0.86),rgba(244,239,233,0.92))] shadow-[0_16px_36px_-32px_rgba(17,24,39,0.16)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(40,42,48,0.84),rgba(30,33,39,0.92))]'
            : 'border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,243,238,0.98))] shadow-[0_18px_42px_-34px_rgba(17,24,39,0.18)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(34,37,44,0.94),rgba(27,30,36,0.96))]'
          : 'bg-transparent'
      )}
    >
      <div
        className={cn(
          'mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] border',
          isAssistant
            ? isReasoning
              ? 'border-black/10 bg-[rgba(183,165,154,0.12)] text-foreground dark:border-white/[0.12] dark:bg-[rgba(183,165,154,0.16)]'
              : 'border-black/10 bg-[rgba(47,52,55,0.08)] text-foreground dark:border-white/[0.12] dark:bg-[rgba(231,223,210,0.08)]'
            : 'border-black/10 bg-white/[0.60] text-foreground dark:border-white/[0.12] dark:bg-white/[0.05]'
        )}
      >
        {isAssistant ? (
          isReasoning ? <Brain className="h-4 w-4" /> : <Bot className="h-4 w-4" />
        ) : (
          <User2 className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {isAssistant ? (isReasoning ? 'Thinking' : 'DeepScientist') : 'You'}
          </span>
          {item.source ? <span>{item.source}</span> : null}
          {item.skillId ? <Badge className="bg-black/[0.03] dark:bg-white/[0.04]">{item.skillId}</Badge> : null}
          {streaming ? <span className="inline-flex h-2 w-2 rounded-full bg-[#2F3437] animate-caret dark:bg-[#E7DFD2]" /> : null}
          {item.createdAt ? <span className="ml-auto">{formatTime(item.createdAt)}</span> : null}
        </div>

        <div className="prose prose-sm max-w-none leading-7 text-foreground dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderedContent || ''}</ReactMarkdown>
        </div>
      </div>
    </motion.article>
  )
}

function ArtifactBlock({ item }: { item: Extract<FeedItem, { type: 'artifact' }> }) {
  const pathEntries = Object.entries(item.paths ?? {})
  const detailEntries = Object.entries(item.details ?? {}).filter(([, value]) => value != null && value !== '')
  const flowBits = [item.flowType, item.protocolStep].filter(Boolean)
  const checkpointHead =
    item.checkpoint && typeof item.checkpoint.head === 'string' ? item.checkpoint.head : undefined
  const primaryMetricId =
    typeof item.details?.primary_metric_id === 'string' ? item.details.primary_metric_id : undefined
  const primaryValue =
    typeof item.details?.primary_value === 'number' || typeof item.details?.primary_value === 'string'
      ? item.details.primary_value
      : undefined
  const baselineValue =
    typeof item.details?.baseline_value === 'number' || typeof item.details?.baseline_value === 'string'
      ? item.details.baseline_value
      : undefined
  const deltaVsBaseline =
    typeof item.details?.delta_vs_baseline === 'number' || typeof item.details?.delta_vs_baseline === 'string'
      ? item.details.delta_vs_baseline
      : undefined
  const breakthrough =
    typeof item.details?.breakthrough === 'boolean' ? item.details.breakthrough : undefined
  const breakthroughLevel =
    typeof item.details?.breakthrough_level === 'string' ? item.details.breakthrough_level : undefined

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.90),rgba(246,243,238,0.96))] px-5 py-4 shadow-[0_18px_42px_-34px_rgba(17,24,39,0.18)] dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(34,37,44,0.94),rgba(27,30,36,0.96))]"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2 font-medium text-foreground">
          <GitCommitHorizontal className="h-4 w-4" />
          <span>{item.kind}</span>
        </div>
        {item.status ? <Badge>{item.status}</Badge> : null}
        {flowBits.map((value) => (
          <Badge key={value} className="bg-black/[0.03] dark:bg-white/[0.04]">
            {value}
          </Badge>
        ))}
        {item.createdAt ? <span className="ml-auto">{formatTime(item.createdAt)}</span> : null}
      </div>

      <div className="text-sm leading-7 text-foreground">{item.content}</div>

      {item.kind === 'run' && (primaryMetricId || breakthroughLevel || deltaVsBaseline != null) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[18px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="font-medium text-foreground">Primary metric</div>
            <div className="mt-1">
              {primaryMetricId ? `${primaryMetricId}: ${primaryValue ?? '—'}` : '—'}
            </div>
          </div>
          <div className="rounded-[18px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="font-medium text-foreground">Baseline</div>
            <div className="mt-1">
              {baselineValue ?? '—'}
              {deltaVsBaseline != null ? ` · Δ ${deltaVsBaseline}` : ''}
            </div>
          </div>
          <div className="rounded-[18px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="font-medium text-foreground">Breakthrough</div>
            <div className="mt-1">
              {breakthrough ? breakthroughLevel || 'yes' : 'none'}
            </div>
          </div>
        </div>
      ) : null}

      {item.branch || item.workspaceRoot || item.ideaId || item.campaignId || item.sliceId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.branch ? <Badge>branch: {item.branch}</Badge> : null}
          {item.workspaceRoot ? <Badge>workspace: {item.workspaceRoot}</Badge> : null}
          {item.ideaId ? <Badge>idea: {item.ideaId}</Badge> : null}
          {item.campaignId ? <Badge>campaign: {item.campaignId}</Badge> : null}
          {item.sliceId ? <Badge>slice: {item.sliceId}</Badge> : null}
        </div>
      ) : null}

      {item.reason ? (
        <div className="mt-3 rounded-[20px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
          <span className="font-medium text-foreground">Reason.</span> {item.reason}
        </div>
      ) : null}

      {item.guidance ? (
        <div className="mt-2 rounded-[20px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
          <span className="font-medium text-foreground">Next.</span> {item.guidance}
        </div>
      ) : null}

      {item.comment ? <AgentCommentBlock comment={item.comment} className="mt-3" /> : null}

      {pathEntries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {pathEntries.map(([key, value]) => (
            <Badge key={`${key}:${value}`} className="max-w-full truncate">
              {key}: {value}
            </Badge>
          ))}
        </div>
      ) : null}

      {detailEntries.length > 0 ? (
        <div className="mt-3 rounded-[20px] border border-black/[0.05] bg-black/[0.025] px-3 py-2 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="font-medium text-foreground">Details</div>
          <div className="mt-1 space-y-1">
            {detailEntries.slice(0, 8).map(([key, value]) => (
              <div key={key}>
                <span className="font-medium text-foreground">{key}:</span>{' '}
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {checkpointHead ? (
        <div className="mt-2 text-xs text-muted-foreground">checkpoint: {checkpointHead}</div>
      ) : null}
    </motion.article>
  )
}

function EventLine({ item }: { item: Extract<FeedItem, { type: 'event' }> }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16 }}
      className="flex flex-wrap items-center gap-2 rounded-[18px] border border-black/[0.05] bg-white/[0.58] px-3 py-2 text-xs text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{item.label}</span>
      <span>{item.content}</span>
      {item.createdAt ? <span className="ml-auto">{formatTime(item.createdAt)}</span> : null}
    </motion.div>
  )
}

function OperationBlock({
  item,
  questId,
  isLatestBash,
}: {
  item: RenderOperationFeedItem
  questId?: string
  isLatestBash?: boolean
}) {
  if (questId && isBashExecOperation(item)) {
    return (
      <QuestBashExecOperation
        questId={questId}
        itemId={item.id}
        toolCallId={item.toolCallId}
        toolName={item.toolName}
        label={item.label}
        status={item.status}
        args={item.args}
        output={item.output}
        createdAt={item.createdAt}
        metadata={item.metadata}
        comment={item.comment}
        monitorPlanSeconds={item.monitorPlanSeconds}
        monitorStepIndex={item.monitorStepIndex}
        nextCheckAfterSeconds={item.nextCheckAfterSeconds}
        isLatest={Boolean(isLatestBash)}
      />
    )
  }
  if (questId && isStructuredMcpOperation(item)) {
    return (
      <QuestMcpOperation
        questId={questId}
        itemId={item.id}
        toolCallId={item.toolCallId}
        toolName={item.toolName}
        label={item.label}
        status={item.status}
        args={item.args}
        output={item.output}
        createdAt={item.createdAt}
        metadata={item.metadata}
        mcpServer={item.mcpServer}
        mcpTool={item.mcpTool}
        comment={item.comment}
      />
    )
  }
  const theme = toolTheme(item.toolName, item.args, item.output)
  const Icon = theme.icon
  const subject = item.subject || extractToolSubject(item.toolName, item.args, item.output)
  const title =
    item.content ||
    buildToolOperationContent(item.hasResult ? 'tool_result' : 'tool_call', item.toolName, item.args, item.output)
  const rawStatus = String(item.status || '').trim().toLowerCase()
  const isFailed = rawStatus.includes('fail') || rawStatus.includes('error')
  const isStopped = rawStatus === 'stopped' || rawStatus === 'terminated' || rawStatus === 'cancelled'
  const isRunning =
    !item.hasResult ||
    ['running', 'calling', 'pending', 'queued', 'starting', 'terminating'].includes(rawStatus)
  const resolvedStatus = isFailed
    ? rawStatus || 'failed'
    : isStopped
      ? rawStatus
      : isRunning
        ? rawStatus || 'running'
        : rawStatus || 'completed'
  const StatusIcon = isFailed ? AlertCircle : isStopped ? Square : isRunning ? Loader2 : CheckCircle2
  const statusClass = isFailed
    ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200'
    : isStopped
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200'
      : isRunning
        ? 'border-black/[0.08] bg-black/[0.04] text-foreground dark:border-white/[0.10] dark:bg-white/[0.06]'
        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.992 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-[28px] border border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,243,238,0.98))] px-5 py-4 shadow-[0_18px_42px_-34px_rgba(17,24,39,0.18)] dark:border-white/[0.10] dark:bg-[linear-gradient(180deg,rgba(34,37,44,0.94),rgba(27,30,36,0.96))]',
        isRunning && 'ring-1 ring-black/[0.05] dark:ring-white/[0.08]'
      )}
    >
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-black/10 dark:border-white/[0.12]',
            theme.tone
          )}
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">DeepScientist</span>
            <Badge className="bg-black/[0.03] dark:bg-white/[0.04]">{theme.label}</Badge>
            {item.toolName ? <Badge className="bg-black/[0.03] dark:bg-white/[0.04]">{item.toolName}</Badge> : null}
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass)}>
              <StatusIcon className={cn('h-3.5 w-3.5', isRunning && 'animate-spin')} />
              {resolvedStatus}
            </span>
            {item.createdAt ? <span className="ml-auto">{formatTime(item.createdAt)}</span> : null}
          </div>
          <div className="mt-2 text-[15px] font-semibold leading-7 text-foreground">
            {title}
          </div>
        </div>
      </div>

      {subject ? (
        <div className="mb-3 inline-flex max-w-full rounded-full border border-black/[0.05] bg-black/[0.03] px-3 py-1.5 text-xs text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
          {subject}
        </div>
      ) : null}

      {item.comment ? (
        <AgentCommentBlock
          comment={item.comment}
          monitorPlanSeconds={item.monitorPlanSeconds}
          monitorStepIndex={item.monitorStepIndex}
          nextCheckAfterSeconds={item.nextCheckAfterSeconds}
          className="mb-3"
        />
      ) : null}

      {item.args ? (
        <div className="overflow-hidden rounded-[20px] border border-black/[0.05] bg-black/[0.025] dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="border-b border-black/[0.05] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground dark:border-white/[0.06]">
            Arguments
          </div>
          <pre className="feed-scrollbar max-h-[220px] overflow-auto px-3 py-3 text-[12px] leading-6 text-foreground">{item.args}</pre>
        </div>
      ) : null}

      {item.output ? (
        <div
          className={cn(
            'overflow-hidden rounded-[20px] border border-black/[0.05] bg-black/[0.025] dark:border-white/[0.06] dark:bg-white/[0.04]',
            item.args ? 'mt-3' : ''
          )}
        >
          <div className="border-b border-black/[0.05] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground dark:border-white/[0.06]">
            Output
          </div>
          <pre className="feed-scrollbar max-h-[260px] overflow-auto px-3 py-3 text-[12px] leading-6 text-foreground">{item.output}</pre>
        </div>
      ) : null}
    </motion.article>
  )
}

export function EventFeed({
  questId,
  items,
  loading = false,
  restoring = false,
  connectionState = 'connected',
  emptyLabel = 'ACP-compatible copilot events will appear here.',
  bottomInset = 32,
}: EventFeedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderItems = useMemo(() => mergeFeedItemsForRender(items), [items])
  const streamingMessageId = useMemo(
    () =>
      [...items]
        .reverse()
        .find((item) => item.type === 'message' && item.role === 'assistant' && item.stream)?.id ?? null,
    [items]
  )
  const latestBashOperationId = useMemo(
    () => findLatestRenderedOperationId(renderItems, (item: RenderOperationFeedItem) => isBashExecOperation(item)),
    [renderItems]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: renderItems.length > 1 ? 'smooth' : 'auto',
    })
  }, [loading, renderItems, restoring])

  return (
    <div
      ref={containerRef}
      className="feed-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-scroll pr-1"
      style={{
        paddingBottom: bottomInset,
        scrollPaddingBottom: bottomInset,
      }}
    >
      {renderItems.length === 0 ? (
        <StatusPlaceholder
          loading={loading}
          restoring={restoring}
          connectionState={connectionState}
          emptyLabel={emptyLabel}
        />
      ) : null}

      <AnimatePresence initial={false}>
        {renderItems.map((item: RenderFeedItem) => {
          if (item.type === 'message') {
            return <MessageBubble key={item.id} item={item} streaming={item.id === streamingMessageId} />
          }
          if (item.type === 'artifact') {
            return <ArtifactBlock key={item.id} item={item} />
          }
          if (item.type === 'operation') {
            return (
              <OperationBlock
                key={item.renderId}
                item={item}
                questId={questId}
                isLatestBash={(item.toolCallId || item.renderId) === latestBashOperationId}
              />
            )
          }
          return <EventLine key={item.id} item={item} />
        })}
      </AnimatePresence>
    </div>
  )
}
