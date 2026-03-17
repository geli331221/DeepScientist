import type { FeedItem } from '@/types'

type OperationFeedItem = Extract<FeedItem, { type: 'operation' }>

export type RenderOperationFeedItem = OperationFeedItem & {
  renderId: string
  startedAt?: string
  completedAt?: string
  hasResult: boolean
  callItem?: OperationFeedItem
  resultItem?: OperationFeedItem
}

export type RenderFeedItem = Exclude<FeedItem, { type: 'operation' }> | RenderOperationFeedItem

function parseJsonRecord(value?: string) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function deriveOperationBashId(item: OperationFeedItem) {
  const metadataBashId =
    typeof item.metadata?.bash_id === 'string'
      ? item.metadata.bash_id
      : typeof item.metadata?.bashId === 'string'
        ? item.metadata.bashId
        : ''
  if (metadataBashId.trim()) return metadataBashId.trim()
  const outputRecord = parseJsonRecord(item.output)
  const nestedOutput =
    outputRecord?.result && typeof outputRecord.result === 'object' && !Array.isArray(outputRecord.result)
      ? (outputRecord.result as Record<string, unknown>)
      : outputRecord
  const outputBashId =
    typeof nestedOutput?.bash_id === 'string'
      ? nestedOutput.bash_id
      : typeof nestedOutput?.bashId === 'string'
        ? nestedOutput.bashId
        : ''
  if (outputBashId.trim()) return outputBashId.trim()
  return ''
}

function normalizeOperationArgs(args?: string) {
  return String(args || '').replace(/\s+/g, ' ').trim()
}

function resolveOperationMergeKey(item: OperationFeedItem) {
  const toolCallId = item.toolCallId?.trim() || ''
  if (toolCallId) return `tool:${toolCallId}`
  const toolName = String(item.toolName || '').trim().toLowerCase()
  const mcpServer = String(item.mcpServer || '').trim().toLowerCase()
  const mcpTool = String(item.mcpTool || '').trim().toLowerCase()
  const isBashExec =
    mcpServer === 'bash_exec' ||
    toolName === 'bash_exec' ||
    toolName === 'bash_exec.bash_exec' ||
    (mcpServer === 'bash_exec' && mcpTool === 'bash_exec')
  if (!isBashExec) return ''
  const bashId = deriveOperationBashId(item)
  if (bashId) return `bash:${bashId}`
  const normalizedArgs = normalizeOperationArgs(item.args)
  if (normalizedArgs) return `bash-args:${toolName || 'bash_exec'}:${normalizedArgs}`
  return ''
}

function mergeMetadata(
  ...values: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged = values.reduce<Record<string, unknown>>((accumulator, value) => {
    if (!value) return accumulator
    return {
      ...accumulator,
      ...value,
    }
  }, {})
  return Object.keys(merged).length > 0 ? merged : undefined
}

function createRenderOperation(item: OperationFeedItem): RenderOperationFeedItem {
  const toolCallId = item.toolCallId?.trim() || ''
  const isResult = item.label === 'tool_result'
  return {
    ...item,
    renderId: toolCallId || item.id,
    startedAt: isResult ? undefined : item.createdAt,
    completedAt: isResult ? item.createdAt : undefined,
    hasResult: isResult,
    callItem: isResult ? undefined : item,
    resultItem: isResult ? item : undefined,
  }
}

function mergeRenderOperation(
  current: RenderOperationFeedItem,
  next: OperationFeedItem
): RenderOperationFeedItem {
  const callItem = next.label === 'tool_call' ? next : current.callItem
  const resultItem = next.label === 'tool_result' ? next : current.resultItem
  const primary = callItem ?? resultItem ?? next

  return {
    ...primary,
    id: current.id,
    renderId: current.renderId,
    label: resultItem ? 'tool_result' : 'tool_call',
    content: resultItem?.content || callItem?.content || current.content || next.content,
    toolName: callItem?.toolName || resultItem?.toolName || current.toolName || next.toolName,
    toolCallId: current.toolCallId || next.toolCallId,
    status: resultItem?.status || callItem?.status || current.status || next.status,
    subject: resultItem?.subject ?? callItem?.subject ?? current.subject ?? next.subject,
    args: callItem?.args ?? resultItem?.args ?? current.args ?? next.args,
    output: resultItem?.output ?? callItem?.output ?? current.output ?? next.output,
    createdAt: callItem?.createdAt ?? resultItem?.createdAt ?? current.createdAt ?? next.createdAt,
    mcpServer: callItem?.mcpServer || resultItem?.mcpServer || current.mcpServer || next.mcpServer,
    mcpTool: callItem?.mcpTool || resultItem?.mcpTool || current.mcpTool || next.mcpTool,
    metadata: mergeMetadata(current.metadata, callItem?.metadata, resultItem?.metadata, next.metadata),
    comment: resultItem?.comment ?? callItem?.comment ?? current.comment ?? next.comment,
    monitorPlanSeconds:
      resultItem?.monitorPlanSeconds ??
      callItem?.monitorPlanSeconds ??
      current.monitorPlanSeconds ??
      next.monitorPlanSeconds,
    monitorStepIndex:
      resultItem?.monitorStepIndex ??
      callItem?.monitorStepIndex ??
      current.monitorStepIndex ??
      next.monitorStepIndex,
    nextCheckAfterSeconds:
      resultItem?.nextCheckAfterSeconds ??
      callItem?.nextCheckAfterSeconds ??
      current.nextCheckAfterSeconds ??
      next.nextCheckAfterSeconds,
    startedAt: callItem?.createdAt ?? current.startedAt ?? resultItem?.createdAt ?? next.createdAt,
    completedAt: resultItem?.createdAt ?? current.completedAt,
    hasResult: Boolean(resultItem),
    callItem,
    resultItem,
  }
}

export function mergeFeedItemsForRender(items: FeedItem[]): RenderFeedItem[] {
  const merged: RenderFeedItem[] = []
  const operationIndexByMergeKey = new Map<string, number>()

  for (const item of items) {
    if (item.type !== 'operation') {
      merged.push(item)
      continue
    }

    const mergeKey = resolveOperationMergeKey(item)
    if (!mergeKey) {
      merged.push(createRenderOperation(item))
      continue
    }

    const existingIndex = operationIndexByMergeKey.get(mergeKey)
    if (existingIndex == null) {
      merged.push(createRenderOperation(item))
      operationIndexByMergeKey.set(mergeKey, merged.length - 1)
      continue
    }

    const existing = merged[existingIndex]
    if (!existing || existing.type !== 'operation') {
      merged.push(createRenderOperation(item))
      operationIndexByMergeKey.set(mergeKey, merged.length - 1)
      continue
    }

    merged[existingIndex] = mergeRenderOperation(existing, item)
  }

  return merged
}

export function findLatestRenderedOperationId(
  items: RenderFeedItem[],
  predicate?: (item: RenderOperationFeedItem) => boolean
) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item.type !== 'operation') continue
    if (predicate && !predicate(item)) continue
    return item.toolCallId || item.renderId
  }
  return null
}
