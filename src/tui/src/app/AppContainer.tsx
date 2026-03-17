import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import fs from 'node:fs'
import { useApp, useInput } from 'ink'
import { spawn } from 'node:child_process'

import type { ConfigScreenItem } from '../components/ConfigScreen.js'
import { client } from '../lib/api.js'
import { buildToolOperationContent, extractToolSubject } from '../lib/toolOperations.js'
import { DefaultAppLayout } from '../layouts/DefaultAppLayout.js'
import type { ConfigFileEntry, ConnectorSnapshot, FeedItem, OpenDocumentPayload, QuestSummary, SessionPayload } from '../types.js'

type QuestPanelMode = 'projects' | 'pause' | 'stop' | 'resume'
type ConfigMode = 'browse' | 'edit'
type MessageFeedItem = Extract<FeedItem, { type: 'message' }>

const LOCAL_USER_SOURCE = 'tui-local'

const buildId = (prefix: string, raw: string) => `${prefix}:${raw}`

const stringifyStructured = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }
  if (value == null) {
    return undefined
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const parseSlashCommand = (text: string): { name: string; arg: string } | null => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }
  const firstSpace = trimmed.indexOf(' ')
  if (firstSpace === -1) {
    return { name: trimmed.toLowerCase(), arg: '' }
  }
  return {
    name: trimmed.slice(0, firstSpace).toLowerCase(),
    arg: trimmed.slice(firstSpace + 1).trim(),
  }
}

const getPanelQuests = (mode: QuestPanelMode, quests: QuestSummary[]): QuestSummary[] => {
  if (mode === 'pause') {
    return quests.filter((quest) => !['stopped', 'paused'].includes(String(quest.status || '')))
  }
  if (mode === 'stop') {
    return quests.filter((quest) => !['stopped'].includes(String(quest.status || '')))
  }
  if (mode === 'resume') {
    return quests.filter((quest) => ['stopped', 'paused'].includes(String(quest.status || '')))
  }
  return quests
}

const resolveQuestToken = (token: string, quests: QuestSummary[]): QuestSummary | null => {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }
  const numeric = Number(trimmed)
  if (Number.isInteger(numeric) && numeric > 0) {
    return quests[numeric - 1] ?? null
  }
  return quests.find((quest) => quest.quest_id === trimmed) ?? null
}

const buildQuestConfigItems = (
  questId: string | null,
  questRoot: string | undefined
): ConfigScreenItem[] => {
  if (!questId || !questRoot) {
    return []
  }
  const items: ConfigScreenItem[] = [
    {
      id: `quest:${questId}:quest.yaml`,
      scope: 'quest',
      name: 'quest.yaml',
      title: 'quest.yaml',
      path: `${questRoot}/quest.yaml`,
      writable: true,
      documentId: 'path::quest.yaml',
    },
  ]
  const codexPath = `${questRoot}/.codex/config.toml`
  if (fs.existsSync(codexPath)) {
    items.push({
      id: `quest:${questId}:.codex/config.toml`,
      scope: 'quest',
      name: '.codex/config.toml',
      title: '.codex/config.toml',
      path: codexPath,
      writable: true,
      documentId: 'path::.codex/config.toml',
    })
  }
  return items
}

const buildGlobalConfigItems = (entries: ConfigFileEntry[]): ConfigScreenItem[] =>
  entries.map((entry) => ({
    id: `global:${entry.name}`,
    scope: 'global',
    name: entry.name,
    title: `${entry.name}.yaml`,
    path: entry.path,
    writable: true,
    configName: entry.name,
  }))

const resolveConfigTarget = (token: string, items: ConfigScreenItem[]): ConfigScreenItem | null => {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }
  const numeric = Number(trimmed)
  if (Number.isInteger(numeric) && numeric > 0) {
    return items[numeric - 1] ?? null
  }
  return (
    items.find((item) => item.name === trimmed || item.title === trimmed || item.configName === trimmed) ?? null
  )
}

function normalizeUpdate(raw: Record<string, unknown>): FeedItem {
  const eventType = String(raw.event_type ?? '')
  const data = (raw.data ?? {}) as Record<string, unknown>
  const toolLabel =
    eventType === 'runner.tool_call' || data.label === 'tool_call'
      ? 'tool_call'
      : eventType === 'runner.tool_result' || data.label === 'tool_result'
        ? 'tool_result'
        : null
  if (toolLabel) {
    const toolName = typeof data.tool_name === 'string' ? data.tool_name : undefined
    const args = stringifyStructured(data.args)
    const output = stringifyStructured(data.output)
    const subject = extractToolSubject(toolName, args, output)
    const metadata =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : undefined
    return {
      id: buildId('operation', String(raw.event_id ?? raw.created_at ?? crypto.randomUUID())),
      type: 'operation',
      label: toolLabel,
      content: buildToolOperationContent(toolLabel, toolName, args, output),
      toolName,
      toolCallId: typeof data.tool_call_id === 'string' ? data.tool_call_id : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
      subject,
      args,
      output,
      mcpServer: typeof data.mcp_server === 'string' ? data.mcp_server : undefined,
      mcpTool: typeof data.mcp_tool === 'string' ? data.mcp_tool : undefined,
      metadata,
      createdAt: raw.created_at ? String(raw.created_at) : undefined,
    }
  }
  const kind = String(raw.kind ?? 'event')
  if (kind === 'message') {
    const message = (raw.message ?? {}) as Record<string, unknown>
    return {
      id: buildId('message', String(raw.event_id ?? raw.created_at ?? crypto.randomUUID())),
      type: 'message',
      role: String(message.role ?? 'assistant') === 'user' ? 'user' : 'assistant',
      content: String(message.content ?? ''),
      source: message.source ? String(message.source) : undefined,
      createdAt: raw.created_at ? String(raw.created_at) : undefined,
      stream: Boolean(message.stream),
      runId: message.run_id ? String(message.run_id) : null,
      skillId: message.skill_id ? String(message.skill_id) : null,
    }
  }
  if (kind === 'artifact') {
    const artifact = (raw.artifact ?? {}) as Record<string, unknown>
    return {
      id: buildId('artifact', String(raw.event_id ?? raw.created_at ?? crypto.randomUUID())),
      type: 'artifact',
      artifactId: artifact.artifact_id ? String(artifact.artifact_id) : undefined,
      kind: String(artifact.kind ?? 'artifact'),
      status: artifact.status ? String(artifact.status) : undefined,
      content: String(artifact.summary ?? artifact.reason ?? artifact.guidance ?? artifact.kind ?? 'Artifact updated.'),
      reason: artifact.reason ? String(artifact.reason) : undefined,
      guidance: artifact.guidance ? String(artifact.guidance) : undefined,
      createdAt: raw.created_at ? String(raw.created_at) : undefined,
      paths: (artifact.paths as Record<string, string> | undefined) ?? {},
      artifactPath: artifact.artifact_path ? String(artifact.artifact_path) : undefined,
      workspaceRoot: artifact.workspace_root ? String(artifact.workspace_root) : undefined,
      branch: artifact.branch ? String(artifact.branch) : undefined,
      headCommit: artifact.head_commit ? String(artifact.head_commit) : undefined,
      flowType: artifact.flow_type ? String(artifact.flow_type) : undefined,
      protocolStep: artifact.protocol_step ? String(artifact.protocol_step) : undefined,
      ideaId: artifact.idea_id ? String(artifact.idea_id) : null,
      campaignId: artifact.campaign_id ? String(artifact.campaign_id) : null,
      sliceId: artifact.slice_id ? String(artifact.slice_id) : null,
      details:
        artifact.details && typeof artifact.details === 'object' && !Array.isArray(artifact.details)
          ? (artifact.details as Record<string, unknown>)
          : undefined,
      checkpoint:
        artifact.checkpoint && typeof artifact.checkpoint === 'object' && !Array.isArray(artifact.checkpoint)
          ? (artifact.checkpoint as Record<string, unknown>)
          : null,
      attachments: Array.isArray(artifact.attachments)
        ? (artifact.attachments.filter(
            (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
          ) as Array<Record<string, unknown>>)
        : [],
    }
  }
  return {
    id: buildId('event', String(raw.event_id ?? raw.created_at ?? crypto.randomUUID())),
    type: 'event',
    label: String(data.label ?? raw.event_type ?? 'event'),
    content: String(data.summary ?? data.run_id ?? raw.event_type ?? 'Event updated.'),
    createdAt: raw.created_at ? String(raw.created_at) : undefined,
  }
}

type FeedState = {
  history: FeedItem[]
  pending: FeedItem[]
}

function appendHistoryItem(history: FeedItem[], item: FeedItem): FeedItem[] {
  if (history.some((existing) => existing.id === item.id)) {
    return history
  }
  return [...history, item].slice(-160)
}

function removeMatchingLocalPendingUser(pending: FeedItem[], item: MessageFeedItem): FeedItem[] {
  if (item.role !== 'user') {
    return pending
  }
  let removed = false
  return pending.filter((candidate) => {
    if (removed) {
      return true
    }
    if (
      candidate.type === 'message' &&
      candidate.role === 'user' &&
      candidate.source === LOCAL_USER_SOURCE &&
      candidate.content === item.content
    ) {
      removed = true
      return false
    }
    return true
  })
}

function upsertPendingAssistant(pending: FeedItem[], item: MessageFeedItem): FeedItem[] {
  const next = [...pending]
  const matchIndex = next.findIndex(
    (candidate) =>
      candidate.type === 'message' &&
      candidate.role === 'assistant' &&
      candidate.stream &&
      candidate.runId &&
      candidate.runId === item.runId
  )
  if (matchIndex >= 0) {
    const current = next[matchIndex]
    if (current.type === 'message') {
      next[matchIndex] = {
        ...current,
        content: `${current.content}${item.content}`,
        createdAt: item.createdAt || current.createdAt,
        skillId: item.skillId || current.skillId,
        source: item.source || current.source,
      }
    }
    return next.slice(-12)
  }
  return [...next, item].slice(-12)
}

function flushPendingAssistant(
  pending: FeedItem[],
  item: MessageFeedItem
): { pending: FeedItem[]; finalized: MessageFeedItem } {
  if (item.role !== 'assistant' || !item.runId) {
    return { pending, finalized: item }
  }
  let pendingText = ''
  const nextPending = pending.filter((candidate) => {
    if (
      candidate.type === 'message' &&
      candidate.role === 'assistant' &&
      candidate.runId &&
      candidate.runId === item.runId
    ) {
      pendingText = candidate.content
      return false
    }
    return true
  })
  return {
    pending: nextPending,
    finalized: item.content
      ? item
      : {
          ...item,
          content: pendingText,
        },
  }
}

function applyIncomingFeedUpdates(state: FeedState, incoming: FeedItem[]): FeedState {
  let nextHistory = [...state.history]
  let nextPending = [...state.pending]
  for (const item of incoming) {
    if (item.type === 'message' && item.role === 'assistant' && item.stream) {
      nextPending = upsertPendingAssistant(nextPending, item)
      continue
    }
    if (item.type === 'message' && item.role === 'assistant' && item.runId) {
      const flushed = flushPendingAssistant(nextPending, item)
      nextPending = flushed.pending
      nextHistory = appendHistoryItem(nextHistory, flushed.finalized)
      continue
    }
    if (item.type === 'message' && item.role === 'user') {
      nextPending = removeMatchingLocalPendingUser(nextPending, item)
      nextHistory = appendHistoryItem(nextHistory, item)
      continue
    }
    nextHistory = appendHistoryItem(nextHistory, item)
  }
  return {
    history: nextHistory,
    pending: nextPending,
  }
}

function createLocalUserFeedItem(content: string): FeedItem {
  return {
    id: buildId('local-user', `${Date.now()}-${crypto.randomUUID()}`),
    type: 'message',
    role: 'user',
    content,
    source: LOCAL_USER_SOURCE,
    createdAt: new Date().toISOString(),
  }
}

function shouldRefreshForUpdate(raw: Record<string, unknown>): boolean {
  const eventType = String(raw.event_type ?? '')
  if (
    eventType === 'runner.turn_finish' ||
    eventType === 'runner.turn_error' ||
    eventType === 'runner.turn_retry_started' ||
    eventType === 'runner.turn_retry_scheduled' ||
    eventType === 'runner.turn_retry_aborted' ||
    eventType === 'runner.turn_retry_exhausted' ||
    eventType === 'quest.control'
  ) {
    return true
  }
  if (String(raw.kind ?? '') !== 'artifact') {
    return false
  }
  const artifact = (raw.artifact ?? {}) as Record<string, unknown>
  return (
    Boolean(artifact.expects_reply) ||
    ['threaded', 'blocking'].includes(String(artifact.reply_mode ?? '')) ||
    Boolean(artifact.reply_to_interaction_id) ||
    String(artifact.kind ?? '') === 'decision_request'
  )
}

function openBrowser(url: string) {
  const platform = process.platform
  if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

function buildProjectsUrl(baseUrl: string) {
  const target = new URL(baseUrl)
  if (target.hostname === '0.0.0.0') {
    target.hostname = '127.0.0.1'
  }
  target.pathname = '/projects'
  target.search = ''
  return target.toString()
}

function buildProjectUrl(baseUrl: string, questId: string | null) {
  if (!questId) {
    return buildProjectsUrl(baseUrl)
  }
  const target = new URL(baseUrl)
  if (target.hostname === '0.0.0.0') {
    target.hostname = '127.0.0.1'
  }
  target.pathname = `/projects/${questId}`
  target.search = ''
  return target.toString()
}

export const AppContainer: React.FC<{ baseUrl: string; initialQuestId?: string | null }> = ({
  baseUrl,
  initialQuestId = null,
}) => {
  const { exit } = useApp()
  const [quests, setQuests] = useState<QuestSummary[]>([])
  const [connectors, setConnectors] = useState<ConnectorSnapshot[]>([])
  const [activeQuestId, setActiveQuestId] = useState<string | null>(initialQuestId)
  const [browseQuestId, setBrowseQuestId] = useState<string | null>(initialQuestId)
  const [configMode, setConfigMode] = useState<ConfigMode | null>(null)
  const [configItems, setConfigItems] = useState<ConfigScreenItem[]>([])
  const [configIndex, setConfigIndex] = useState(0)
  const [configEditor, setConfigEditor] = useState<{
    item: ConfigScreenItem
    revision?: string
    content: string
  } | null>(null)
  const [questPanelMode, setQuestPanelMode] = useState<QuestPanelMode | null>(null)
  const [questPanelIndex, setQuestPanelIndex] = useState(0)
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [history, setHistory] = useState<FeedItem[]>([])
  const [pendingHistoryItems, setPendingHistoryItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [input, setInput] = useState('')
  const [statusLine, setStatusLine] = useState('Connecting to daemon…')
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const activeQuestIdRef = useRef<string | null>(initialQuestId)
  const browseQuestIdRef = useRef<string | null>(initialQuestId)
  const historyRef = useRef<FeedItem[]>([])
  const pendingHistoryItemsRef = useRef<FeedItem[]>([])
  const cursorRef = useRef(0)
  const refreshRequestRef = useRef(0)
  const streamAbortRef = useRef<AbortController | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeQuest = useMemo(
    () => quests.find((quest) => quest.quest_id === activeQuestId) ?? null,
    [quests, activeQuestId]
  )
  const browseQuest = useMemo(
    () => quests.find((quest) => quest.quest_id === browseQuestId) ?? null,
    [quests, browseQuestId]
  )
  const panelQuests = useMemo(
    () => (questPanelMode ? getPanelQuests(questPanelMode, quests) : []),
    [questPanelMode, quests]
  )
  const selectedQuestForConfig = useMemo(
    () => activeQuest ?? browseQuest ?? null,
    [activeQuest, browseQuest]
  )
  const slashSuggestions = useMemo(() => {
    const slashCommands = session?.acp_session?.slash_commands ?? []
    const localCommands = [
      { name: '/home', description: 'Return to home request mode.' },
      { name: '/projects', description: 'Open the quest browser.' },
      { name: '/use', description: 'Bind a quest, for example `/use 001`.' },
      { name: '/new', description: 'Create a new quest explicitly.' },
      { name: '/delete', description: 'Delete a quest (requires --yes).' },
      { name: '/pause', description: 'Pause a running quest.' },
      { name: '/resume', description: 'Resume a stopped quest.' },
      { name: '/stop', description: 'Stop a running quest.' },
      { name: '/status', description: 'Show the current quest status.' },
      { name: '/graph', description: 'Show the quest graph.' },
      { name: '/config', description: 'Open the local config browser.' },
      { name: '/config connectors', description: 'Open connectors.yaml in the local config browser.' },
    ]
    if (!input.startsWith('/')) {
      return []
    }
    const merged = [
      ...slashCommands,
      ...localCommands.filter((item) => !slashCommands.some((existing) => existing.name === item.name)),
    ]
    return merged.filter((item) => item.name.toLowerCase().includes(input.toLowerCase())).slice(0, 6)
  }, [input, session])
  const replyTargetId = useMemo(() => {
    const snapshotTarget =
      session?.snapshot.default_reply_interaction_id ||
      session?.acp_session?.meta?.default_reply_interaction_id
    return snapshotTarget ? String(snapshotTarget) : null
  }, [session])

  useEffect(() => {
    activeQuestIdRef.current = activeQuestId
  }, [activeQuestId])

  useEffect(() => {
    browseQuestIdRef.current = browseQuestId
  }, [browseQuestId])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    pendingHistoryItemsRef.current = pendingHistoryItems
  }, [pendingHistoryItems])

  const enterQuest = useCallback((questId: string | null) => {
    activeQuestIdRef.current = questId
    setActiveQuestId(questId)
    if (questId) {
      browseQuestIdRef.current = questId
      setBrowseQuestId(questId)
    }
    setConfigMode(null)
    setConfigEditor(null)
    setConfigItems([])
    setConfigIndex(0)
    setQuestPanelMode(null)
    historyRef.current = []
    pendingHistoryItemsRef.current = []
    setHistory([])
    setPendingHistoryItems([])
    setCursor(0)
    cursorRef.current = 0
    setSession(null)
  }, [])

  const leaveQuest = useCallback(() => {
    activeQuestIdRef.current = null
    browseQuestIdRef.current = null
    setActiveQuestId(null)
    setConfigMode(null)
    setConfigEditor(null)
    setConfigItems([])
    setConfigIndex(0)
    setQuestPanelMode(null)
    setSession(null)
    historyRef.current = []
    pendingHistoryItemsRef.current = []
    setHistory([])
    setPendingHistoryItems([])
    setCursor(0)
    cursorRef.current = 0
  }, [])

  const refresh = useCallback(
    async (hard = false, overrideQuestId?: string | null) => {
      const requestId = refreshRequestRef.current + 1
      refreshRequestRef.current = requestId
      try {
        setConnectionState((current) => (hard ? 'connecting' : current))
        const [nextQuests, nextConnectors] = await Promise.all([
          client.quests(baseUrl),
          client.connectors(baseUrl),
        ])
        if (requestId !== refreshRequestRef.current) {
          return
        }
        setQuests(nextQuests)
        setConnectors(nextConnectors)

        const activeQuestIdAtStart = activeQuestIdRef.current
        const browseQuestIdAtStart = browseQuestIdRef.current
        const requestedQuestId = overrideQuestId !== undefined ? overrideQuestId : activeQuestIdAtStart
        const currentQuestId =
          requestedQuestId && nextQuests.some((quest) => quest.quest_id === requestedQuestId)
            ? requestedQuestId
            : null
        if (currentQuestId !== activeQuestIdRef.current) {
          activeQuestIdRef.current = currentQuestId
          setActiveQuestId(currentQuestId)
        }
        const nextBrowseQuestId =
          browseQuestIdAtStart && nextQuests.some((quest) => quest.quest_id === browseQuestIdAtStart)
            ? browseQuestIdAtStart
            : currentQuestId || nextQuests[0]?.quest_id || null
        if (nextBrowseQuestId !== browseQuestIdRef.current) {
          browseQuestIdRef.current = nextBrowseQuestId
          setBrowseQuestId(nextBrowseQuestId)
        }
        if (!currentQuestId) {
          setSession(null)
          historyRef.current = []
          pendingHistoryItemsRef.current = []
          setHistory([])
          setPendingHistoryItems([])
          setCursor(0)
          cursorRef.current = 0
          setConnectionState('connected')
          if (nextQuests.length === 0) {
            setStatusLine('Home · no quests yet · use `/new <goal>` to create the first quest.')
          } else {
            setStatusLine('Home · selected quest ready · use `/use <quest_id>` to bind or `/new <goal>` to create another.')
          }
          return
        }

        const nextCursor = hard || currentQuestId !== activeQuestIdAtStart ? 0 : cursorRef.current
        const [nextSession, nextEvents] = await Promise.all([
          client.session(baseUrl, currentQuestId),
          client.events(baseUrl, currentQuestId, nextCursor),
        ])
        if (requestId !== refreshRequestRef.current) {
          return
        }
        const normalized = (nextEvents.acp_updates ?? []).map((item) => normalizeUpdate(item.params.update))
        setSession(nextSession)
        const baseState: FeedState =
          hard || currentQuestId !== activeQuestIdAtStart
            ? { history: [], pending: [] }
            : { history: historyRef.current, pending: pendingHistoryItemsRef.current }
        const nextState = applyIncomingFeedUpdates(baseState, normalized)
        historyRef.current = nextState.history
        pendingHistoryItemsRef.current = nextState.pending
        setHistory(nextState.history)
        setPendingHistoryItems(nextState.pending)
        const resolvedCursor = nextEvents.cursor ?? nextCursor
        setCursor(resolvedCursor)
        cursorRef.current = resolvedCursor
        setConnectionState('connected')
        setStatusLine(`Quest mode · ${currentQuestId} · ${baseUrl}`)
        if (nextSession.snapshot?.status && nextSession.snapshot.status !== 'running') {
          const clearedPending = pendingHistoryItemsRef.current.filter(
            (item) => !(item.type === 'message' && item.role === 'assistant' && item.stream)
          )
          pendingHistoryItemsRef.current = clearedPending
          setPendingHistoryItems(clearedPending)
        }
      } catch (error) {
        if (requestId !== refreshRequestRef.current) {
          return
        }
        setConnectionState('error')
        setStatusLine(error instanceof Error ? error.message : String(error))
      }
    },
    [baseUrl]
  )

  const openQuestPanel = useCallback(
    (mode: QuestPanelMode) => {
      setConfigMode(null)
      setConfigEditor(null)
      const candidates = getPanelQuests(mode, quests)
      setQuestPanelMode(mode)
      if (candidates.length === 0) {
        setQuestPanelIndex(0)
        setStatusLine(
          mode === 'pause'
            ? 'No quests available to pause.'
            : mode === 'stop'
            ? 'No quests available to stop.'
            : mode === 'resume'
              ? 'No quests available to resume.'
              : 'No quests available.'
        )
        return
      }
      const currentId = activeQuestId || browseQuestId
      const nextIndex = Math.max(0, candidates.findIndex((quest) => quest.quest_id === currentId))
      setQuestPanelIndex(nextIndex)
      setBrowseQuestId(candidates[nextIndex]?.quest_id ?? browseQuestId)
      setStatusLine(
        mode === 'projects'
          ? 'Quest browser · use arrows and Enter to open.'
          : mode === 'pause'
            ? 'Pause quest · use arrows and Enter to pause.'
          : mode === 'stop'
            ? 'Stop quest · use arrows and Enter to stop.'
            : 'Resume quest · use arrows and Enter to resume.'
      )
    },
    [activeQuestId, browseQuestId, quests]
  )

  const closeConfigScreen = useCallback((nextStatus?: string) => {
    setConfigMode(null)
    setConfigEditor(null)
    setConfigItems([])
    setConfigIndex(0)
    setInput('')
    if (nextStatus) {
      setStatusLine(nextStatus)
    }
  }, [])

  const openConfigEditor = useCallback(
    async (item: ConfigScreenItem) => {
      try {
        let payload: OpenDocumentPayload
        if (item.scope === 'global' && item.configName) {
          payload = await client.configDocument(baseUrl, item.configName)
        } else {
          const questId = selectedQuestForConfig?.quest_id
          if (!questId || !item.documentId) {
            setStatusLine('Quest config requires a selected quest.')
            return
          }
          payload = await client.openDocument(baseUrl, questId, item.documentId)
        }
        setQuestPanelMode(null)
        setConfigMode('edit')
        setConfigEditor({
          item,
          revision: payload.revision,
          content: payload.content,
        })
        setInput(payload.content)
        setStatusLine(`Editing ${item.title} · Enter save · Ctrl+J newline · Esc cancel`)
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : String(error))
      }
    },
    [baseUrl, selectedQuestForConfig]
  )

  const openConfigBrowser = useCallback(
    async (target?: string) => {
      try {
        const globalEntries = await client.configFiles(baseUrl)
        const globalItems = buildGlobalConfigItems(globalEntries)
        const questItems = buildQuestConfigItems(
          selectedQuestForConfig?.quest_id ?? null,
          selectedQuestForConfig?.quest_root
        )
        const nextItems = [...globalItems, ...questItems]
        setQuestPanelMode(null)
        setConfigItems(nextItems)
        setConfigEditor(null)
        setConfigMode('browse')
        if (nextItems.length === 0) {
          setConfigIndex(0)
          setStatusLine('No config files available.')
          return
        }
        if (target) {
          const resolved = resolveConfigTarget(target, nextItems)
          if (resolved) {
            setConfigIndex(nextItems.findIndex((item) => item.id === resolved.id))
            await openConfigEditor(resolved)
            return
          }
        }
        setConfigIndex(0)
        setStatusLine('Config browser · global and current quest config files.')
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : String(error))
      }
    },
    [baseUrl, openConfigEditor, selectedQuestForConfig]
  )

  const saveConfigEditor = useCallback(
    async (content: string) => {
      if (!configEditor) {
        return
      }
      try {
        if (configEditor.item.scope === 'global' && configEditor.item.configName) {
          const payload = await client.saveConfig(
            baseUrl,
            configEditor.item.configName,
            content,
            configEditor.revision
          )
          if (payload.ok === false) {
            setStatusLine(payload.message || payload.errors?.[0] || 'Config save failed.')
            return
          }
        } else {
          const questId = selectedQuestForConfig?.quest_id
          if (!questId || !configEditor.item.documentId) {
            setStatusLine('Quest config requires a selected quest.')
            return
          }
          const payload = await client.saveDocument(
            baseUrl,
            questId,
            configEditor.item.documentId,
            content,
            configEditor.revision
          )
          if (payload.ok === false) {
            setStatusLine(payload.message || 'Quest config save failed.')
            return
          }
        }
        setInput('')
        setConfigEditor(null)
        setConfigMode('browse')
        setStatusLine(`Saved ${configEditor.item.title}`)
        await refresh(true, activeQuestId)
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : String(error))
      }
    },
    [activeQuestId, baseUrl, configEditor, refresh, selectedQuestForConfig]
  )

  const closeQuestPanel = useCallback((nextStatus?: string) => {
    setQuestPanelMode(null)
    if (nextStatus) {
      setStatusLine(nextStatus)
    }
  }, [])

  const focusQuest = useCallback(
    async (questId: string) => {
      enterQuest(questId)
      await refresh(true, questId)
    },
    [enterQuest, refresh]
  )

  const handleQuestPanelSelection = useCallback(async () => {
    if (!questPanelMode) {
      return
    }
    const selected = panelQuests[questPanelIndex] ?? null
    if (!selected) {
      closeQuestPanel('No quest available for this action.')
      return
    }
    if (questPanelMode === 'projects') {
      await focusQuest(selected.quest_id)
      return
    }
    const action = questPanelMode === 'pause' ? 'pause' : questPanelMode === 'stop' ? 'stop' : 'resume'
    const payload = await client.controlQuest(baseUrl, selected.quest_id, action)
    const fallbackVerb = action === 'pause' ? 'paused' : action === 'stop' ? 'stopped' : 'resumed'
    setStatusLine(String(payload.message ?? `Quest ${selected.quest_id} ${fallbackVerb}.`))
    await focusQuest(selected.quest_id)
  }, [baseUrl, closeQuestPanel, focusQuest, panelQuests, questPanelIndex, questPanelMode])

  const cycleQuest = useCallback(
    (direction: 1 | -1) => {
      if (configMode === 'browse') {
        if (configItems.length === 0) {
          return
        }
        setConfigIndex((previous) => (previous + direction + configItems.length) % configItems.length)
        return
      }
      if (questPanelMode) {
        if (panelQuests.length === 0) {
          return
        }
        setQuestPanelIndex((previous) => {
          const next = (previous + direction + panelQuests.length) % panelQuests.length
          const selected = panelQuests[next]
          if (selected?.quest_id) {
            setBrowseQuestId(selected.quest_id)
          }
          return next
        })
        return
      }
      if (quests.length === 0) {
        return
      }
      if (activeQuestId) {
        return
      }
      const currentId = activeQuestId || browseQuestId
      const index = quests.findIndex((quest) => quest.quest_id === currentId)
      const nextIndex = index < 0 ? 0 : (index + direction + quests.length) % quests.length
      const nextQuestId = quests[nextIndex]?.quest_id ?? null
      setBrowseQuestId(nextQuestId)
    },
    [activeQuestId, browseQuestId, configItems.length, configMode, panelQuests, questPanelMode, quests]
  )

  useEffect(() => {
    void refresh(true, initialQuestId)
  }, [initialQuestId, refresh])

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh(false)
    }, 20000)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (!questPanelMode) {
      return
    }
    if (panelQuests.length === 0) {
      if (questPanelIndex !== 0) {
        setQuestPanelIndex(0)
      }
      return
    }
    if (questPanelIndex >= panelQuests.length) {
      setQuestPanelIndex(panelQuests.length - 1)
      return
    }
    const selected = panelQuests[questPanelIndex]
    if (selected?.quest_id && selected.quest_id !== browseQuestId) {
      setBrowseQuestId(selected.quest_id)
    }
  }, [browseQuestId, panelQuests, questPanelIndex, questPanelMode])

  useEffect(() => {
    if (!activeQuestId) {
      streamAbortRef.current?.abort()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      return
    }

    let cancelled = false
    const connect = () => {
      if (cancelled) {
        return
      }
      streamAbortRef.current?.abort()
      const controller = new AbortController()
      streamAbortRef.current = controller
      setConnectionState((current) => (current === 'connected' ? current : 'connecting'))
      void client
        .streamEvents(baseUrl, activeQuestId, cursorRef.current, {
          signal: controller.signal,
          onUpdate: (payload) => {
            if (cancelled) {
              return
            }
            const update = (payload.params as { update?: Record<string, unknown> } | undefined)?.update
            if (!update) {
              return
            }
            const nextCursor = Number(update.cursor ?? cursorRef.current)
            if (Number.isFinite(nextCursor)) {
              cursorRef.current = nextCursor
              setCursor(nextCursor)
            }
            const normalized = normalizeUpdate(update)
            const nextState = applyIncomingFeedUpdates(
              {
                history: historyRef.current,
                pending: pendingHistoryItemsRef.current,
              },
              [normalized]
            )
            historyRef.current = nextState.history
            pendingHistoryItemsRef.current = nextState.pending
            setHistory(nextState.history)
            setPendingHistoryItems(nextState.pending)
            setConnectionState('connected')
            setStatusLine(`Connected · ${activeQuestId} · ${baseUrl}`)
            if (shouldRefreshForUpdate(update)) {
              void refresh(false)
            }
          },
          onCursor: (nextCursor) => {
            cursorRef.current = nextCursor
            setCursor(nextCursor)
          },
        })
        .then(() => {
          if (cancelled || controller.signal.aborted) {
            return
          }
          reconnectTimerRef.current = setTimeout(connect, 800)
        })
        .catch((error) => {
          if (cancelled || controller.signal.aborted) {
            return
          }
          setConnectionState('error')
          setStatusLine(error instanceof Error ? `${error.message} · reconnecting…` : 'Stream reconnecting…')
          reconnectTimerRef.current = setTimeout(connect, 1200)
        })
    }

    connect()

    return () => {
      cancelled = true
      streamAbortRef.current?.abort()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }
  }, [activeQuestId, baseUrl, refresh])

  const submit = useCallback(
    async (override?: string) => {
      const rawText = override ?? input
      if (configMode === 'edit' && configEditor) {
        await saveConfigEditor(rawText)
        return
      }
      const text = rawText.trim()
      if (configMode === 'browse' && !text) {
        const selected = configItems[configIndex] ?? null
        if (!selected) {
          setStatusLine('No config file selected.')
          return
        }
        await openConfigEditor(selected)
        return
      }
      if (configMode === 'browse' && !text.startsWith('/')) {
        setStatusLine('Config browser active · use arrows and Enter, or Esc to close.')
        return
      }
      if (questPanelMode && !text) {
        await handleQuestPanelSelection()
        setInput('')
        return
      }
      if (!text) {
        return
      }
      if (questPanelMode && !text.startsWith('/')) {
        setStatusLine('Quest browser active · use arrows and Enter, or Esc to cancel.')
        return
      }

      setInput('')
      try {
        const slash = parseSlashCommand(text)
        if (text === '/home') {
          closeQuestPanel()
          leaveQuest()
          setStatusLine('Home · request mode · quest unbound.')
          return
        }
        if (slash?.name === '/projects') {
          if (!slash.arg) {
            openQuestPanel('projects')
            return
          }
          const target = resolveQuestToken(slash.arg, quests)
          if (!target) {
            setStatusLine(`Unknown quest · ${slash.arg}`)
            return
          }
          await focusQuest(target.quest_id)
          return
        }
        if (slash?.name === '/pause') {
          const target = slash.arg
            ? resolveQuestToken(slash.arg, quests)
            : quests.find((quest) => quest.quest_id === (activeQuestId || browseQuestId)) ?? null
          if (!slash.arg && !target) {
            openQuestPanel('pause')
            return
          }
          if (!target) {
            setStatusLine(`Unknown quest · ${slash.arg}`)
            return
          }
          const payload = await client.controlQuest(baseUrl, target.quest_id, 'pause')
          setStatusLine(String(payload.message ?? `Quest ${target.quest_id} paused.`))
          await focusQuest(target.quest_id)
          return
        }
        if (slash?.name === '/stop') {
          const target = slash.arg
            ? resolveQuestToken(slash.arg, quests)
            : quests.find((quest) => quest.quest_id === (activeQuestId || browseQuestId)) ?? null
          if (!slash.arg && !target) {
            openQuestPanel('stop')
            return
          }
          if (!target) {
            setStatusLine(`Unknown quest · ${slash.arg}`)
            return
          }
          const payload = await client.controlQuest(baseUrl, target.quest_id, 'stop')
          setStatusLine(String(payload.message ?? `Quest ${target.quest_id} stopped.`))
          await focusQuest(target.quest_id)
          return
        }
        if (slash?.name === '/resume') {
          if (!slash.arg) {
            openQuestPanel('resume')
            return
          }
          const target = resolveQuestToken(slash.arg, quests)
          if (!target) {
            setStatusLine(`Unknown quest · ${slash.arg}`)
            return
          }
          const payload = await client.controlQuest(baseUrl, target.quest_id, 'resume')
          setStatusLine(String(payload.message ?? `Quest ${target.quest_id} resumed.`))
          await focusQuest(target.quest_id)
          return
        }
        if (slash?.name === '/use') {
          if (!slash.arg) {
            setStatusLine('Usage · /use <quest_id>')
            return
          }
          const target = resolveQuestToken(slash.arg, quests)
          if (!target) {
            setStatusLine(`Unknown quest · ${slash.arg}`)
            return
          }
          await focusQuest(target.quest_id)
          return
        }
        if (slash?.name === '/config') {
          await openConfigBrowser(slash.arg || undefined)
          return
        }
        if (slash?.name === '/new') {
          if (!slash.arg) {
            setStatusLine('Usage · /new <goal>')
            return
          }
          const payload = await client.createQuest(baseUrl, slash.arg)
          setStatusLine(`Created ${payload.snapshot.quest_id}`)
          await focusQuest(payload.snapshot.quest_id)
          return
        }
        if (slash?.name === '/delete') {
          if (!slash.arg) {
            setStatusLine('Usage · /delete <quest_id> [--yes]')
            return
          }
          const tokens = slash.arg.split(/\s+/).filter(Boolean)
          const token = tokens[0]?.trim() ?? ''
          if (!token) {
            setStatusLine('Usage · /delete <quest_id> [--yes]')
            return
          }
          const target =
            token.toLowerCase() === 'latest' || token.toLowerCase() === 'newest'
              ? quests[0] ?? null
              : resolveQuestToken(token, quests)
          if (!target) {
            setStatusLine(`Unknown quest · ${token}`)
            return
          }
          const confirmed = tokens
            .slice(1)
            .some((item) => ['--yes', '--force', '-y'].includes(item.toLowerCase()))
          if (!confirmed) {
            setStatusLine(`Confirm delete · /delete ${target.quest_id} --yes`)
            return
          }
          await client.deleteQuest(baseUrl, target.quest_id)
          if (activeQuestId === target.quest_id) {
            leaveQuest()
          }
          setStatusLine(`Deleted ${target.quest_id}`)
          await refresh(true)
          return
        }

        if (!activeQuestId) {
          if (text.startsWith('/')) {
            setStatusLine('Home mode · use `/projects`, `/use <quest_id>`, or `/new <goal>` first.')
            return
          }
          if (quests.length === 0) {
            setStatusLine('Home mode · use `/new <goal>` to create the first quest.')
            return
          }
          setStatusLine('Home mode · use `/use <quest_id>` to bind a quest before sending messages.')
          return
        }

        if (text.startsWith('/')) {
          const payload = await client.sendCommand(baseUrl, activeQuestId, text)
          const messageRecord = (payload.message_record ?? null) as Record<string, unknown> | null
          const commandItems: FeedItem[] = [
            {
              id: buildId('local-user', `${Date.now()}-command-${text}`),
              type: 'message',
              role: 'user',
              content: text,
              source: 'tui',
            },
            ...(messageRecord
              ? [
                  {
                    id: buildId(
                      'message',
                      typeof messageRecord.id === 'string'
                        ? messageRecord.id
                        : `${Date.now()}-command-response`
                    ),
                    type: 'message' as const,
                    role: (String(messageRecord.role ?? 'assistant') === 'user'
                      ? 'user'
                      : 'assistant') as 'user' | 'assistant',
                    content: String(
                      messageRecord.content ??
                        payload.message ??
                        payload.type ??
                        'command accepted'
                    ),
                    source:
                      typeof messageRecord.source === 'string'
                        ? messageRecord.source
                        : 'command',
                    createdAt:
                      typeof messageRecord.created_at === 'string'
                        ? messageRecord.created_at
                        : undefined,
                  },
                ]
              : []),
          ]
          const nextState = applyIncomingFeedUpdates(
            {
              history: historyRef.current,
              pending: pendingHistoryItemsRef.current,
            },
            commandItems
          )
          historyRef.current = nextState.history
          pendingHistoryItemsRef.current = nextState.pending
          setHistory(nextState.history)
          setPendingHistoryItems(nextState.pending)
          const targetQuestId =
            typeof payload.target_quest_id === 'string' && payload.target_quest_id
              ? payload.target_quest_id
              : activeQuestId
          setStatusLine(
            typeof payload.message === 'string'
              ? payload.message.split('\n')[0]
              : typeof payload.type === 'string'
                ? `command acknowledged: ${payload.type}`
                : 'command accepted'
          )
          await refresh(false, targetQuestId)
          return
        }

        const localUserItem = createLocalUserFeedItem(text)
        const optimisticPending = [...pendingHistoryItemsRef.current, localUserItem].slice(-12)
        pendingHistoryItemsRef.current = optimisticPending
        setPendingHistoryItems(optimisticPending)
        try {
          await client.sendChat(baseUrl, activeQuestId, text, replyTargetId)
          setStatusLine(replyTargetId ? 'Reply sent · continuing current quest.' : 'Message sent · DeepScientist is working.')
        } catch (error) {
          const revertedPending = pendingHistoryItemsRef.current.filter((item) => item.id !== localUserItem.id)
          pendingHistoryItemsRef.current = revertedPending
          setPendingHistoryItems(revertedPending)
          throw error
        }
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : String(error))
      }
    },
    [
      activeQuestId,
      baseUrl,
      browseQuestId,
      configEditor,
      configIndex,
      configItems,
      configMode,
      closeQuestPanel,
      focusQuest,
      handleQuestPanelSelection,
      input,
      leaveQuest,
      openConfigBrowser,
      openConfigEditor,
      openQuestPanel,
      questPanelMode,
      quests,
      refresh,
      replyTargetId,
      saveConfigEditor,
    ]
  )

  useInput((value, key) => {
    const canBrowseSelection = configMode === 'browse' || Boolean(questPanelMode)
    const canBrowseHomeQuests = !activeQuestId && input.length === 0
    const submitRequested = key.return || value === '\r' || value === '\n'

    if (key.ctrl && value === 'c') {
      exit()
      return
    }
    if (key.ctrl && value.toLowerCase() === 'r') {
      void refresh(true, activeQuestId)
      return
    }
    if (key.ctrl && value.toLowerCase() === 'o') {
      openBrowser(buildProjectUrl(baseUrl, activeQuestId || browseQuestId))
      return
    }
    if (key.ctrl && value.toLowerCase() === 'g') {
      void openConfigBrowser()
      return
    }
    if (key.ctrl && value.toLowerCase() === 'b') {
      if (configMode) {
        closeConfigScreen()
        return
      }
      closeQuestPanel()
      leaveQuest()
      return
    }
    if (key.escape) {
      if (configMode === 'edit') {
        setConfigMode('browse')
        setConfigEditor(null)
        setInput('')
        setStatusLine('Config edit cancelled.')
        return
      }
      if (configMode === 'browse') {
        closeConfigScreen('Config browser closed.')
        return
      }
      if (questPanelMode) {
        closeQuestPanel('Quest browser closed.')
        return
      }
      setInput('')
      return
    }
    if (submitRequested) {
      if (configMode === 'browse' && input.trim().length === 0) {
        const selected = configItems[configIndex] ?? null
        if (selected) {
          void openConfigEditor(selected)
        }
        return
      }
    }
    if (key.upArrow && ((configMode === 'browse') || canBrowseHomeQuests)) {
      cycleQuest(-1)
      return
    }
    if ((key.downArrow || key.tab) && ((configMode === 'browse') || canBrowseHomeQuests)) {
      cycleQuest(1)
      return
    }
  })

  return (
    <DefaultAppLayout
      baseUrl={baseUrl}
      quests={quests}
      activeQuestId={activeQuestId}
      browseQuestId={browseQuestId}
      configMode={configMode}
      configItems={configItems}
      configIndex={configIndex}
      configEditor={
        configEditor
          ? {
              item: configEditor.item,
              content: input,
            }
          : null
      }
      snapshot={activeQuest}
      session={session}
      connectors={connectors}
      history={history}
      pendingHistoryItems={pendingHistoryItems}
      input={input}
      connectionState={connectionState}
      statusLine={statusLine}
      suggestions={slashSuggestions}
      questPanelMode={questPanelMode}
      questPanelQuests={panelQuests}
      questPanelIndex={questPanelIndex}
      onQuestPanelMove={(direction) => {
        cycleQuest(direction)
      }}
      onQuestPanelConfirm={() => {
        void handleQuestPanelSelection()
      }}
      onQuestPanelCancel={() => {
        closeQuestPanel('Quest browser closed.')
      }}
      onChange={setInput}
      onSubmit={(override) => {
        const submitted = override ?? input
        if (configMode === 'browse' && !String(submitted).trim()) {
          const selected = configItems[configIndex] ?? null
          if (selected) {
            void openConfigEditor(selected)
          }
          return
        }
        if (questPanelMode && !String(submitted).trim()) {
          void handleQuestPanelSelection()
          return
        }
        if (!String(submitted).trim() && !activeQuestId && browseQuestId) {
          void focusQuest(browseQuestId)
          return
        }
        void submit(override)
      }}
      onCancel={() => {
        if (configMode === 'edit') {
          setConfigMode('browse')
          setConfigEditor(null)
          setInput('')
          setStatusLine('Config edit cancelled.')
          return
        }
        if (configMode === 'browse') {
          closeConfigScreen('Config browser closed.')
          return
        }
        if (questPanelMode) {
          closeQuestPanel('Quest browser closed.')
          return
        }
        setInput('')
      }}
    />
  )
}
