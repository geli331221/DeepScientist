import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Link2,
  MessageSquareText,
  RadioTower,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { HintDot } from '@/components/ui/hint-dot'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  ConfigTestPayload,
  ConfigValidationPayload,
  ConnectorRecentEvent,
  ConnectorSnapshot,
  ConnectorTargetSnapshot,
  Locale,
} from '@/types'

import { connectorCatalog, type ConnectorCatalogEntry, type ConnectorField, type ConnectorName } from './connectorCatalog'
import { translateSettingsCatalogText } from './settingsCatalogI18n'

type ConnectorConfigMap = Record<string, Record<string, unknown>>

type DeliveryTargetState = {
  chat_type: 'direct' | 'group'
  chat_id: string
  text: string
}

const copy = {
  en: {
    title: 'Connectors',
    subtitle: 'Bind accounts, validate them, and run a live probe from one place.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    testTarget: 'Test target',
    chatType: 'Type',
    direct: 'Direct',
    group: 'Group',
    chatId: 'Chat ID',
    qqChatIdHint: 'Use QQ user `openid` or group `group_openid`, not a QQ number.',
    probeText: 'Message',
    probePlaceholder: 'Optional probe message…',
    save: 'Save',
    validate: 'Check',
    testAll: 'Test all',
    testConnector: 'Send probe',
    testing: 'Testing…',
    validating: 'Checking…',
    saving: 'Saving…',
    portal: 'Portal',
    emptyValidation: 'No issues.',
    emptyTest: 'No issues.',
    snapshot: 'Runtime',
    transportLabel: 'Transport',
    connection: 'Connection',
    auth: 'Auth',
    lastMode: 'Mode',
    queues: 'Queues',
    queueIn: 'in',
    queueOut: 'out',
    bindings: 'Bindings',
    boundTarget: 'Bound target',
    defaultTarget: 'Default target',
    discoveredTargets: 'Discovered targets',
    lastSeen: 'Last seen',
    noSnapshot: 'No snapshot.',
    noTargets: 'No runtime targets yet.',
    recentActivity: 'Recent activity',
    noEvents: 'No connector events yet.',
    inbound: 'Inbound',
    outbound: 'Outbound',
    ignored: 'Ignored',
    deliveryOk: 'Delivered',
    deliveryQueued: 'Queued',
    deliveryFailed: 'Failed',
    useTarget: 'Use',
    validation: 'Check',
    testResult: 'Test',
    ok: 'Ready',
    needsWork: 'Needs work',
    showLegacy: 'Show legacy fields',
    hideLegacy: 'Hide legacy fields',
    routingTitle: 'Routing',
    routingSubtitle: 'Choose where milestone and decision updates go.',
    routingEmpty: 'Enable a connector first.',
    routingAutoSingle: 'One active connector. It becomes the default target automatically.',
    primaryConnector: 'Primary',
    deliveryPolicy: 'Policy',
    fanoutAll: 'All',
    primaryOnly: 'Primary',
    primaryPlusLocal: 'Primary + local',
    selected: 'Selected',
    localMirror: 'Local UI/TUI can still mirror updates in mixed mode.',
    fieldHintPrefix: 'How to fill:',
    qqQuickSetup: 'Quick setup',
    qqStepCredentials: 'Credentials',
    qqStepBind: 'Bind by first message',
    qqStepSuccess: 'Connected',
    qqStepAdvanced: 'Advanced',
    qqStepDone: 'Done',
    qqStepCurrent: 'Current',
    qqStepPending: 'Pending',
    qqSaveNow: 'Save credentials',
    qqSaveFirst: 'Save the App ID and App Secret first.',
    qqAfterSave: 'After saving, send `/help` or any private message to the bot from QQ.',
    qqWaitingOpenId: 'Waiting for the first QQ private message.',
    qqOpenIdDetected: 'OpenID detected and saved automatically.',
    qqConnectedSummary: 'QQ is ready for direct chat, auto-binding, and milestone delivery.',
    qqMilestoneDefaults: 'Milestone delivery is enabled by default. Only change these switches if you want less outbound push.',
    qqAdvancedHint: 'Group mention policy, gateway restart, command prefix, auto-binding, and milestone delivery.',
    qqDetectedOpenId: 'Detected OpenID',
    qqDetectedOpenIdHint: 'This value appears after the first private QQ message reaches the built-in gateway.',
    qqBindChecklistTitle: 'What to do next',
    qqBindChecklist1: 'Open QQ and send one private message to the bot.',
    qqBindChecklist2: 'Wait for DeepScientist to detect the OpenID and save it.',
    qqBindChecklist3: 'Return here and confirm the detected OpenID is no longer empty.',
    lingzhuQuickSetup: 'Quick setup',
    lingzhuStepEndpoint: 'Gateway endpoint',
    lingzhuStepPlatform: 'Platform values',
    lingzhuStepProbe: 'Probe and verify',
    lingzhuNeedPublicIp: 'Lingzhu requires a public IP or public domain. `127.0.0.1` only works for local health checks.',
    lingzhuUseLocalDefaults: 'Use local defaults',
    lingzhuGenerateAk: 'Generate AK',
    lingzhuGeneratedValues: 'Generated values',
    lingzhuLocalHealthUrl: 'Local health URL',
    lingzhuLocalSseUrl: 'Local SSE URL',
    lingzhuPublicSseUrl: 'Public SSE URL',
    lingzhuPublicHint: 'Fill the public URL that the glasses can really reach.',
    lingzhuOpenclawConfig: 'OpenClaw config snippet',
    lingzhuCurl: 'Probe curl',
    lingzhuSupportedCommands: 'Supported commands',
    lingzhuSnapshotHint: 'The runtime probe checks local reachability only. It does not prove that your public IP is already exposed correctly.',
    lingzhuRunProbe: 'Run Lingzhu probe',
    lingzhuProbeResult: 'Lingzhu probe',
    lingzhuNoProbeYet: 'Run the probe after saving the AK and endpoint values.',
    lingzhuAgentIdHint: 'Use the same agent id on both OpenClaw and Lingzhu.',
    lingzhuPlatformReminder: 'Paste the generated public SSE URL and AK into the Lingzhu platform.',
  },
  zh: {
    title: '连接器',
    subtitle: '在一个面板里完成账号绑定、校验与主动测试。',
    enabled: '已启用',
    disabled: '已禁用',
    testTarget: '测试目标',
    chatType: '类型',
    direct: '私聊',
    group: '群聊',
    chatId: '会话 ID',
    qqChatIdHint: '请填写 QQ 用户 `openid` 或群 `group_openid`，不要填写 QQ 号。',
    probeText: '消息',
    probePlaceholder: '可选探针消息…',
    save: '保存',
    validate: '校验',
    testAll: '全部测试',
    testConnector: '发送测试消息',
    testing: '测试中…',
    validating: '校验中…',
    saving: '保存中…',
    portal: '平台',
    emptyValidation: '没有问题。',
    emptyTest: '没有问题。',
    snapshot: '运行时',
    transportLabel: '传输方式',
    connection: '连接状态',
    auth: '鉴权状态',
    lastMode: '模式',
    queues: '队列',
    queueIn: '入',
    queueOut: '出',
    bindings: '绑定数',
    boundTarget: '已绑定目标',
    defaultTarget: '默认目标',
    discoveredTargets: '已发现目标',
    lastSeen: '最近会话',
    noSnapshot: '暂无快照。',
    noTargets: '暂未发现运行时目标。',
    recentActivity: '最近活动',
    noEvents: '暂时还没有连接器事件。',
    inbound: '收到',
    outbound: '发出',
    ignored: '忽略',
    deliveryOk: '已送达',
    deliveryQueued: '队列中',
    deliveryFailed: '发送失败',
    useTarget: '使用',
    validation: '校验',
    testResult: '测试',
    ok: '就绪',
    needsWork: '需处理',
    showLegacy: '显示旧式字段',
    hideLegacy: '隐藏旧式字段',
    routingTitle: '路由',
    routingSubtitle: '决定里程碑和决策更新优先发往哪里。',
    routingEmpty: '请先启用一个连接器。',
    routingAutoSingle: '当前只有一个已启用连接器，它会自动成为默认目标。',
    primaryConnector: '首选',
    deliveryPolicy: '策略',
    fanoutAll: '全部',
    primaryOnly: '首选',
    primaryPlusLocal: '首选 + 本地',
    selected: '已选',
    localMirror: '混合模式下，本地 Web/TUI 仍会保留同步视图。',
    fieldHintPrefix: '填写方式:',
    qqQuickSetup: '快速接入',
    qqStepCredentials: '填写凭据',
    qqStepBind: '发送首条消息',
    qqStepSuccess: '连接成功',
    qqStepAdvanced: '高级设置',
    qqStepDone: '已完成',
    qqStepCurrent: '当前',
    qqStepPending: '待完成',
    qqSaveNow: '保存凭据',
    qqSaveFirst: '请先保存 App ID 和 App Secret。',
    qqAfterSave: '保存后，请从 QQ 给机器人发送 `/help` 或任意一条私聊消息。',
    qqWaitingOpenId: '正在等待第一条 QQ 私聊消息。',
    qqOpenIdDetected: '已自动检测并保存 OpenID。',
    qqConnectedSummary: 'QQ 已可以用于直接沟通、自动绑定和里程碑投递。',
    qqMilestoneDefaults: '里程碑投递默认全部开启。只有在你想减少外发内容时才需要调整这些开关。',
    qqAdvancedHint: '群内 @ 规则、网关重启、命令前缀、自动绑定和里程碑投递。',
    qqDetectedOpenId: '已检测 OpenID',
    qqDetectedOpenIdHint: '当第一条 QQ 私聊到达内置网关后，这里会自动显示。',
    qqBindChecklistTitle: '下一步操作',
    qqBindChecklist1: '打开 QQ，给机器人发送一条私聊消息。',
    qqBindChecklist2: '等待 DeepScientist 自动检测并保存 OpenID。',
    qqBindChecklist3: '回到这里确认 OpenID 已不再为空。',
    lingzhuQuickSetup: '快速接入',
    lingzhuStepEndpoint: '网关端点',
    lingzhuStepPlatform: '平台填写值',
    lingzhuStepProbe: '探测与校验',
    lingzhuNeedPublicIp: 'Lingzhu 需要公网 IP 或公网域名。`127.0.0.1` 只能用于本地健康检查。',
    lingzhuUseLocalDefaults: '使用本地默认值',
    lingzhuGenerateAk: '生成 AK',
    lingzhuGeneratedValues: '自动生成值',
    lingzhuLocalHealthUrl: '本地健康检查 URL',
    lingzhuLocalSseUrl: '本地 SSE URL',
    lingzhuPublicSseUrl: '公网 SSE URL',
    lingzhuPublicHint: '这里应填写眼镜端真正能够访问到的公网地址。',
    lingzhuOpenclawConfig: 'OpenClaw 配置片段',
    lingzhuCurl: '探测 curl',
    lingzhuSupportedCommands: '支持的命令',
    lingzhuSnapshotHint: '运行时探测只能检查本地可达性，不能替代公网暴露是否正确的最终验证。',
    lingzhuRunProbe: '执行 Lingzhu 探测',
    lingzhuProbeResult: 'Lingzhu 探测结果',
    lingzhuNoProbeYet: '保存 AK 和端点后，再执行探测。',
    lingzhuAgentIdHint: 'OpenClaw 与 Lingzhu 两侧应使用同一个 agent id。',
    lingzhuPlatformReminder: '请把自动生成的公网 SSE URL 和 AK 填回到 Lingzhu 平台中。',
  },
} satisfies Record<Locale, Record<string, string>>

function fieldValue(config: Record<string, unknown>, field: ConnectorField) {
  const raw = config[field.key]
  if (field.kind === 'boolean') {
    return Boolean(raw)
  }
  if (field.kind === 'list') {
    return Array.isArray(raw) ? raw.join(', ') : ''
  }
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
}

function normalizeFieldValue(field: ConnectorField, value: string | boolean) {
  if (field.kind === 'boolean') {
    return Boolean(value)
  }
  if (field.kind === 'list') {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return String(value)
}

function snapshotByName(items: ConnectorSnapshot[]) {
  return new Map(items.map((item) => [item.name, item]))
}

function testItemByName(payload: ConfigTestPayload | null) {
  const next = new Map<string, NonNullable<ConfigTestPayload['items'][number]>>()
  for (const item of payload?.items || []) {
    next.set(item.name, item)
  }
  return next
}

function connectorTargetLabel(target: ConnectorTargetSnapshot) {
  const label = String(target.label || '').trim()
  if (label) {
    return label
  }
  const chatType = String(target.chat_type || '').trim()
  const chatId = String(target.chat_id || '').trim()
  return [chatType, chatId].filter(Boolean).join(' · ')
}

function connectorEventLabel(event: ConnectorRecentEvent) {
  const label = String(event.label || '').trim()
  if (label) {
    return label
  }
  const chatType = String(event.chat_type || '').trim()
  const chatId = String(event.chat_id || '').trim()
  return [chatType, chatId].filter(Boolean).join(' · ')
}

function connectorEventPreview(event: ConnectorRecentEvent) {
  const message = String(event.message || '').trim()
  if (message) {
    return message
  }
  return String(event.reason || '').trim()
}

function connectorEventTime(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return normalized
  }
  return date.toLocaleString()
}

function connectorEventStatus(event: ConnectorRecentEvent, locale: Locale) {
  const t = copy[locale]
  if (event.event_type !== 'outbound') {
    return ''
  }
  if (event.queued) {
    return t.deliveryQueued
  }
  if (event.ok) {
    return t.deliveryOk
  }
  return t.deliveryFailed
}

function lingzhuConfigString(config: Record<string, unknown>, key: string, fallback = '') {
  const value = config[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : fallback
}

function lingzhuGatewayPort(config: Record<string, unknown>) {
  const parsed = Number.parseInt(lingzhuConfigString(config, 'gateway_port', '18789'), 10)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 18789
}

function lingzhuLocalHost(config: Record<string, unknown>) {
  return lingzhuConfigString(config, 'local_host', '127.0.0.1') || '127.0.0.1'
}

function lingzhuLocalBaseUrl(config: Record<string, unknown>) {
  return `http://${lingzhuLocalHost(config)}:${lingzhuGatewayPort(config)}`
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return trimmed.replace(/\/$/, '')
  } catch {
    return ''
  }
}

function lingzhuPublicBaseUrl(config: Record<string, unknown>) {
  return normalizeBaseUrl(lingzhuConfigString(config, 'public_base_url'))
}

function lingzhuLocalHealthUrl(config: Record<string, unknown>) {
  return `${lingzhuLocalBaseUrl(config)}/metis/agent/api/health`
}

function lingzhuLocalSseUrl(config: Record<string, unknown>) {
  return `${lingzhuLocalBaseUrl(config)}/metis/agent/api/sse`
}

function lingzhuPublicSseUrl(config: Record<string, unknown>) {
  const base = lingzhuPublicBaseUrl(config)
  return base ? `${base}/metis/agent/api/sse` : ''
}

function lingzhuAgentId(config: Record<string, unknown>) {
  return lingzhuConfigString(config, 'agent_id', 'main') || 'main'
}

function lingzhuBool(config: Record<string, unknown>, key: string, fallback = false) {
  const value = config[key]
  return typeof value === 'boolean' ? value : fallback
}

function lingzhuNumber(config: Record<string, unknown>, key: string, fallback: number) {
  const raw = Number.parseInt(lingzhuConfigString(config, key, String(fallback)), 10)
  return Number.isFinite(raw) ? raw : fallback
}

function createLingzhuAk() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const segments = [8, 4, 4, 4, 12]
  const bytes =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto.getRandomValues(new Uint8Array(segments.reduce((sum, item) => sum + item, 0)))
      : Uint8Array.from({ length: segments.reduce((sum, item) => sum + item, 0) }, () => Math.floor(Math.random() * 256))
  let index = 0
  return segments
    .map((size) => {
      let segment = ''
      for (let i = 0; i < size; i += 1) {
        segment += chars[bytes[index] % chars.length]
        index += 1
      }
      return segment
    })
    .join('-')
}

function lingzhuGeneratedOpenclawConfig(config: Record<string, unknown>) {
  return JSON.stringify(
    {
      gateway: {
        port: lingzhuGatewayPort(config),
        http: {
          endpoints: {
            chatCompletions: {
              enabled: true,
            },
          },
        },
      },
      plugins: {
        entries: {
          lingzhu: {
            enabled: lingzhuBool(config, 'enabled', false),
            config: {
              authAk: lingzhuConfigString(config, 'auth_ak'),
              agentId: lingzhuAgentId(config),
              includeMetadata: lingzhuBool(config, 'include_metadata', true),
              requestTimeoutMs: lingzhuNumber(config, 'request_timeout_ms', 60000),
              systemPrompt: lingzhuConfigString(config, 'system_prompt'),
              defaultNavigationMode: lingzhuConfigString(config, 'default_navigation_mode', '0') || '0',
              enableFollowUp: lingzhuBool(config, 'enable_follow_up', true),
              followUpMaxCount: lingzhuNumber(config, 'follow_up_max_count', 3),
              maxImageBytes: lingzhuNumber(config, 'max_image_bytes', 5242880),
              sessionMode: lingzhuConfigString(config, 'session_mode', 'per_user') || 'per_user',
              sessionNamespace: lingzhuConfigString(config, 'session_namespace', 'lingzhu') || 'lingzhu',
              autoReceiptAck: lingzhuBool(config, 'auto_receipt_ack', true),
              visibleProgressHeartbeat: lingzhuBool(config, 'visible_progress_heartbeat', true),
              visibleProgressHeartbeatSec: lingzhuNumber(config, 'visible_progress_heartbeat_sec', 10),
              debugLogging: lingzhuBool(config, 'debug_logging', false),
              debugLogPayloads: lingzhuBool(config, 'debug_log_payloads', false),
              debugLogDir: lingzhuConfigString(config, 'debug_log_dir'),
              enableExperimentalNativeActions: lingzhuBool(config, 'enable_experimental_native_actions', false),
            },
          },
        },
      },
    },
    null,
    2
  )
}

function lingzhuGeneratedCurl(config: Record<string, unknown>) {
  return [
    `curl -X POST '${lingzhuLocalSseUrl(config)}' \\`,
    `  --header 'Authorization: Bearer ${lingzhuConfigString(config, 'auth_ak')}' \\`,
    "  --header 'Content-Type: application/json' \\",
    `  --data '${JSON.stringify({
      message_id: 'ds-lingzhu-probe-001',
      agent_id: lingzhuAgentId(config),
      message: [{ role: 'user', type: 'text', text: '你好' }],
    })}'`,
  ].join('\n')
}

function routingConfig(value: ConnectorConfigMap): Record<string, unknown> {
  const raw = value._routing
  return raw && typeof raw === 'object' ? raw : {}
}

function ResultNotice({
  title,
  ok,
  warnings,
  errors,
  empty,
}: {
  title: string
  ok: boolean
  warnings: string[]
  errors: string[]
  empty: string
}) {
  return (
    <section className="border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
        <span>{title}</span>
      </div>
      {errors.length === 0 && warnings.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {errors.map((item) => (
            <div key={item} className="border-l-2 border-rose-500/60 pl-3 text-sm text-rose-700 dark:text-rose-300">
              {item}
            </div>
          ))}
          {warnings.map((item) => (
            <div key={item} className="border-l-2 border-amber-500/60 pl-3 text-sm text-amber-700 dark:text-amber-200">
              {item}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function fieldHint(field: ConnectorField, locale: Locale) {
  const t = copy[locale]
  const pieces = [
    translateSettingsCatalogText(locale, field.description),
    `${t.fieldHintPrefix} ${translateSettingsCatalogText(locale, field.whereToGet)}`,
  ]
  return pieces.filter(Boolean).join(' ')
}

function FieldHelp({ field, locale }: { field: ConnectorField; locale: Locale }) {
  const t = copy[locale]
  return (
    <div className="space-y-1 text-xs leading-5 text-muted-foreground">
      <div>{translateSettingsCatalogText(locale, field.description)}</div>
      <div>
        <span className="font-medium text-foreground/80">{t.fieldHintPrefix}</span>{' '}
        {translateSettingsCatalogText(locale, field.whereToGet)}
      </div>
    </div>
  )
}

function ConnectorEventRow({ event, locale }: { event: ConnectorRecentEvent; locale: Locale }) {
  const status = connectorEventStatus(event, locale)
  const label = connectorEventLabel(event)
  const preview = connectorEventPreview(event)
  const createdAt = connectorEventTime(event.created_at)
  const icon =
    event.event_type === 'outbound' ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : event.event_type === 'ignored' ? (
      <Ban className="h-3.5 w-3.5" />
    ) : (
      <ArrowDownLeft className="h-3.5 w-3.5" />
    )
  const tone =
    event.event_type === 'outbound'
      ? event.ok || event.queued
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-amber-700 dark:text-amber-300'
      : event.event_type === 'ignored'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-sky-700 dark:text-sky-300'

  return (
    <div className="rounded-[18px] border border-black/[0.08] bg-white/[0.42] px-3 py-3 dark:border-white/[0.12] dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]', tone)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground">{label || event.event_type}</span>
            {status ? (
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground dark:bg-white/[0.06]">
                {status}
              </span>
            ) : null}
            {event.transport ? <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{event.transport}</span> : null}
          </div>
          {preview ? <div className="mt-1 break-words text-sm leading-6 text-muted-foreground">{preview}</div> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {createdAt ? <span>{createdAt}</span> : null}
            {event.kind ? <span>{event.kind}</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConnectorFieldControl({
  field,
  config,
  locale,
  onChange,
}: {
  field: ConnectorField
  config: Record<string, unknown>
  locale: Locale
  onChange: (key: string, value: unknown) => void
}) {
  const value = fieldValue(config, field)
  const controlClass = 'rounded-[18px] border-black/[0.08] bg-white/[0.44] shadow-none dark:bg-white/[0.03]'

  if (field.kind === 'boolean') {
    return (
      <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
        <label className="flex min-h-[44px] items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span>{translateSettingsCatalogText(locale, field.label)}</span>
            <HintDot label={fieldHint(field, locale)} />
          </span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(field.key, event.target.checked)}
            disabled={Boolean(field.readOnly)}
            className="h-4 w-4 rounded border-black/20 text-foreground"
          />
        </label>
        <div className="mt-3">
          <FieldHelp field={field} locale={locale} />
        </div>
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
        <label className="flex items-center gap-2 text-sm font-medium">
          <span>{translateSettingsCatalogText(locale, field.label)}</span>
          <HintDot label={fieldHint(field, locale)} />
        </label>
        <select
          value={String(value || '')}
          onChange={(event) => onChange(field.key, normalizeFieldValue(field, event.target.value))}
          disabled={Boolean(field.readOnly)}
          className={cn(
            'flex h-11 w-full rounded-[18px] border px-3 py-2 text-sm ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            controlClass
          )}
        >
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {translateSettingsCatalogText(locale, option.label)}
            </option>
          ))}
        </select>
        <div className="mt-3">
          <FieldHelp field={field} locale={locale} />
        </div>
      </div>
    )
  }

  const sharedProps = {
    value: String(value || ''),
    onChange: (nextValue: string) => onChange(field.key, normalizeFieldValue(field, nextValue)),
    placeholder: field.placeholder,
    className: controlClass,
    disabled: Boolean(field.readOnly),
  }

  return (
    <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
      <label className="flex items-center gap-2 text-sm font-medium">
        <span>{translateSettingsCatalogText(locale, field.label)}</span>
        <HintDot label={fieldHint(field, locale)} />
      </label>
      {field.kind === 'list' ? (
        <Textarea
          value={sharedProps.value}
          onChange={(event) => sharedProps.onChange(event.target.value)}
          placeholder={translateSettingsCatalogText(locale, sharedProps.placeholder)}
          disabled={sharedProps.disabled}
          className={cn('min-h-[92px] resize-y', sharedProps.className)}
        />
      ) : (
        <Input
          type={field.kind === 'password' ? 'password' : field.kind === 'url' ? 'url' : 'text'}
          value={sharedProps.value}
          onChange={(event) => sharedProps.onChange(event.target.value)}
          placeholder={translateSettingsCatalogText(locale, sharedProps.placeholder)}
          disabled={sharedProps.disabled}
          className={sharedProps.className}
        />
      )}
      <div className="mt-3">
        <FieldHelp field={field} locale={locale} />
      </div>
    </div>
  )
}

function connectorAnchorId(name: ConnectorName) {
  return `connector-${name}`
}

function connectorSectionAnchorId(name: ConnectorName, sectionId: string) {
  return `${connectorAnchorId(name)}-section-${sectionId}`
}

function qqStepAnchorId(step: 'credentials' | 'bind' | 'success' | 'advanced') {
  return `connector-qq-step-${step}`
}

function lingzhuStepAnchorId(step: 'endpoint' | 'platform' | 'probe' | 'advanced') {
  return `connector-lingzhu-step-${step}`
}

function findConnectorField(entry: ConnectorCatalogEntry, key: string) {
  for (const section of entry.sections) {
    const match = section.fields.find((field) => field.key === key)
    if (match) {
      return match
    }
  }
  return null
}

function AnchorJumpButton({
  anchorId,
  onJumpToAnchor,
}: {
  anchorId: string
  onJumpToAnchor?: (anchorId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onJumpToAnchor?.(anchorId)}
      title={`#${anchorId}`}
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-black/[0.08] bg-white/[0.44] px-2 text-[11px] text-muted-foreground transition hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.03]"
    >
      #
    </button>
  )
}

function StepStateBadge({
  state,
  locale,
}: {
  state: 'done' | 'current' | 'pending'
  locale: Locale
}) {
  const t = copy[locale]
  const label = state === 'done' ? t.qqStepDone : state === 'current' ? t.qqStepCurrent : t.qqStepPending
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]',
        state === 'done' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        state === 'current' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        state === 'pending' && 'bg-black/[0.05] text-muted-foreground dark:bg-white/[0.06]'
      )}
    >
      {label}
    </span>
  )
}

function ConnectorCard({
  entry,
  locale,
  config,
  snapshot,
  testItem,
  saving,
  isDirty,
  testing,
  deliveryTarget,
  onUpdateField,
  onUpdateConnector,
  onUpdateDelivery,
  onSave,
  onTest,
  onJumpToAnchor,
}: {
  entry: ConnectorCatalogEntry
  locale: Locale
  config: Record<string, unknown>
  snapshot?: ConnectorSnapshot
  testItem?: ConfigTestPayload['items'][number]
  saving: boolean
  isDirty: boolean
  testing: boolean
  deliveryTarget: DeliveryTargetState
  onUpdateField: (connectorName: ConnectorName, key: string, value: unknown) => void
  onUpdateConnector: (connectorName: ConnectorName, patch: Record<string, unknown>) => void
  onUpdateDelivery: (connectorName: ConnectorName, patch: Partial<DeliveryTargetState>) => void
  onSave: () => void
  onTest: (connectorName: ConnectorName) => void
  onJumpToAnchor?: (anchorId: string) => void
}) {
  const t = copy[locale]
  const Icon = entry.icon
  const enabled = Boolean(config.enabled)
  const [legacyExpanded, setLegacyExpanded] = useState(false)
  const [qqAdvancedExpanded, setQqAdvancedExpanded] = useState(false)
  const chatIdPlaceholder = entry.name === 'qq' ? (deliveryTarget.chat_type === 'group' ? 'group_openid' : 'openid') : '123456789'
  const cardAnchorId = connectorAnchorId(entry.name)

  const renderGenericSections = () => (
    <>
      {entry.sections.map((section) => {
        const sectionAnchorId = connectorSectionAnchorId(entry.name, section.id)
        return (
          <section
            key={section.id}
            id={sectionAnchorId}
            className="border-t border-black/[0.06] pt-4 first:border-t-0 first:pt-0 dark:border-white/[0.08]"
          >
            <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{translateSettingsCatalogText(locale, section.title)}</span>
                <HintDot label={translateSettingsCatalogText(locale, section.description)} />
                <AnchorJumpButton anchorId={sectionAnchorId} onJumpToAnchor={onJumpToAnchor} />
              </div>
              {section.variant === 'legacy' ? (
                <button
                  type="button"
                  onClick={() => setLegacyExpanded((current) => !current)}
                  className="rounded-full border border-black/[0.08] bg-white/[0.44] px-3 py-1 text-[10px] tracking-[0.14em] text-muted-foreground transition hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.03]"
                >
                  {legacyExpanded ? t.hideLegacy : t.showLegacy}
                </button>
              ) : null}
            </div>
            {section.variant !== 'legacy' || legacyExpanded ? (
              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <ConnectorFieldControl
                    key={field.key}
                    field={field}
                    config={config}
                    locale={locale}
                    onChange={(key, value) => onUpdateField(entry.name, key, value)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        )
      })}
    </>
  )

  const renderQqSetup = () => {
    const appIdField = findConnectorField(entry, 'app_id')
    const appSecretField = findConnectorField(entry, 'app_secret')
    const mainChatField = findConnectorField(entry, 'main_chat_id')
    const advancedFields = [
      findConnectorField(entry, 'require_at_in_groups'),
      findConnectorField(entry, 'gateway_restart_on_config_change'),
      findConnectorField(entry, 'command_prefix'),
      findConnectorField(entry, 'auto_bind_dm_to_active_quest'),
    ].filter(Boolean) as ConnectorField[]
    const milestoneFields = [
      findConnectorField(entry, 'auto_send_main_experiment_png'),
      findConnectorField(entry, 'auto_send_analysis_summary_png'),
      findConnectorField(entry, 'auto_send_slice_png'),
      findConnectorField(entry, 'auto_send_paper_pdf'),
      findConnectorField(entry, 'enable_markdown_send'),
      findConnectorField(entry, 'enable_file_upload_experimental'),
    ].filter(Boolean) as ConnectorField[]

    const appId = String(config.app_id || '').trim()
    const appSecret = String(config.app_secret || '').trim()
    const mainChatId = String(config.main_chat_id || snapshot?.main_chat_id || '').trim()
    const credentialsReady = Boolean(enabled && appId && appSecret)
    const saveReady = Boolean(credentialsReady && !isDirty)
    const bindReady = Boolean(mainChatId)
    const stepCards: Array<{
      key: 'credentials' | 'bind' | 'success'
      title: string
      state: 'done' | 'current' | 'pending'
    }> = [
      {
        key: 'credentials' as const,
        title: t.qqStepCredentials,
        state: credentialsReady ? (saveReady ? 'done' : 'current') : 'current',
      },
      {
        key: 'bind' as const,
        title: t.qqStepBind,
        state: bindReady ? 'done' : saveReady ? 'current' : 'pending',
      },
      {
        key: 'success' as const,
        title: t.qqStepSuccess,
        state: bindReady ? 'done' : 'pending',
      },
    ]

    return (
      <div className="space-y-5">
        <section
          id={qqStepAnchorId('credentials')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.qqQuickSetup}</span>
                <AnchorJumpButton anchorId={qqStepAnchorId('credentials')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.qqStepCredentials}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {translateSettingsCatalogText(locale, entry.subtitle)}
              </p>
            </div>
            <StepStateBadge state={credentialsReady ? (saveReady ? 'done' : 'current') : 'current'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {stepCards.map((step, index) => (
              <button
                key={step.key}
                type="button"
                onClick={() => onJumpToAnchor?.(qqStepAnchorId(step.key))}
                className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-3 text-left transition hover:border-black/[0.12] dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <StepStateBadge state={step.state} locale={locale} />
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{step.title}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <label className="flex min-h-[44px] items-center justify-between gap-4">
                <span className="text-sm font-medium">{t.enabled}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => onUpdateField(entry.name, 'enabled', event.target.checked)}
                  className="h-4 w-4 rounded border-black/20 text-foreground"
                />
              </label>
              <div className="mt-3 text-xs leading-5 text-muted-foreground">
                {translateSettingsCatalogText(locale, entry.deliveryNote)}
              </div>
            </div>
            {appIdField ? (
              <ConnectorFieldControl
                field={appIdField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
            {appSecretField ? (
              <ConnectorFieldControl
                field={appSecretField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-black/[0.06] bg-black/[0.02] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03] md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">{saveReady ? t.qqAfterSave : t.qqSaveFirst}</div>
            <Button onClick={onSave} disabled={saving || !credentialsReady}>
              <Save className="h-4 w-4" />
              {saving ? t.saving : t.qqSaveNow}
            </Button>
          </div>
        </section>

        <section
          id={qqStepAnchorId('bind')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>Step 2</span>
                <AnchorJumpButton anchorId={qqStepAnchorId('bind')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.qqStepBind}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {saveReady ? t.qqAfterSave : t.qqSaveFirst}
              </p>
            </div>
            <StepStateBadge state={bindReady ? 'done' : saveReady ? 'current' : 'pending'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                  <span>{t.qqBindChecklistTitle}</span>
                </div>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>1. {t.qqBindChecklist1}</li>
                  <li>2. {t.qqBindChecklist2}</li>
                  <li>3. {t.qqBindChecklist3}</li>
                </ol>
              </div>
              <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
                <div className="text-sm font-medium">{t.qqDetectedOpenId}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{t.qqDetectedOpenIdHint}</div>
                <div className="mt-4 rounded-[18px] border border-black/[0.06] bg-black/[0.02] px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                  {mainChatId || '—'}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={cn(
                    'h-4 w-4',
                    bindReady ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'
                  )}
                />
                <span className="text-sm font-medium">{bindReady ? t.qqOpenIdDetected : t.qqWaitingOpenId}</span>
              </div>
              {mainChatField ? (
                <div className="mt-4">
                  <ConnectorFieldControl
                    field={mainChatField}
                    config={{ ...config, main_chat_id: mainChatId }}
                    locale={locale}
                    onChange={() => undefined}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section
          id={qqStepAnchorId('success')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>Step 3</span>
                <AnchorJumpButton anchorId={qqStepAnchorId('success')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.qqStepSuccess}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {bindReady ? t.qqConnectedSummary : t.qqWaitingOpenId}
              </p>
            </div>
            <StepStateBadge state={bindReady ? 'done' : 'pending'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.transportLabel}</div>
              <div className="mt-2 text-sm font-medium">gateway_direct</div>
            </div>
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.boundTarget}</div>
              <div className="mt-2 break-all text-sm font-medium">{mainChatId || '—'}</div>
            </div>
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.discoveredTargets}</div>
              <div className="mt-2 text-sm font-medium">{snapshot?.target_count ?? snapshot?.discovered_targets?.length ?? 0}</div>
            </div>
          </div>
        </section>

        <section
          id={qqStepAnchorId('advanced')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <button
            type="button"
            onClick={() => setQqAdvancedExpanded((current) => !current)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.qqStepAdvanced}</span>
                <AnchorJumpButton anchorId={qqStepAnchorId('advanced')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.qqStepAdvanced}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.qqAdvancedHint}</p>
            </div>
            <div className="flex items-center gap-3">
              <StepStateBadge state="pending" locale={locale} />
              {qqAdvancedExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {qqAdvancedExpanded ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {advancedFields.map((field) => (
                  <ConnectorFieldControl
                    key={field.key}
                    field={field}
                    config={config}
                    locale={locale}
                    onChange={(key, value) => onUpdateField(entry.name, key, value)}
                  />
                ))}
              </div>

              <div className="border-t border-black/[0.06] pt-5 dark:border-white/[0.08]">
                <div className="mb-3 text-sm font-medium">{t.qqMilestoneDefaults}</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {milestoneFields.map((field) => (
                    <ConnectorFieldControl
                      key={field.key}
                      field={field}
                      config={config}
                      locale={locale}
                      onChange={(key, value) => onUpdateField(entry.name, key, value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  const renderLingzhuSetup = () => {
    const localHostField = findConnectorField(entry, 'local_host')
    const gatewayPortField = findConnectorField(entry, 'gateway_port')
    const publicBaseUrlField = findConnectorField(entry, 'public_base_url')
    const authAkField = findConnectorField(entry, 'auth_ak')
    const agentIdField = findConnectorField(entry, 'agent_id')
    const systemPromptField = findConnectorField(entry, 'system_prompt')
    const behaviorFields = [
      findConnectorField(entry, 'include_metadata'),
      findConnectorField(entry, 'request_timeout_ms'),
      findConnectorField(entry, 'default_navigation_mode'),
      findConnectorField(entry, 'enable_follow_up'),
      findConnectorField(entry, 'follow_up_max_count'),
      findConnectorField(entry, 'session_mode'),
      findConnectorField(entry, 'session_namespace'),
      findConnectorField(entry, 'auto_receipt_ack'),
      findConnectorField(entry, 'visible_progress_heartbeat'),
      findConnectorField(entry, 'visible_progress_heartbeat_sec'),
      findConnectorField(entry, 'max_image_bytes'),
    ].filter(Boolean) as ConnectorField[]
    const advancedFields = [
      findConnectorField(entry, 'debug_logging'),
      findConnectorField(entry, 'debug_log_payloads'),
      findConnectorField(entry, 'debug_log_dir'),
      findConnectorField(entry, 'enable_experimental_native_actions'),
    ].filter(Boolean) as ConnectorField[]
    const snapshotDetails =
      snapshot?.details && typeof snapshot.details === 'object' ? (snapshot.details as Record<string, unknown>) : {}
    const testDetails =
      testItem?.details && typeof testItem.details === 'object' ? (testItem.details as Record<string, unknown>) : {}
    const localHealthUrl =
      typeof snapshotDetails.health_url === 'string' && snapshotDetails.health_url
        ? String(snapshotDetails.health_url)
        : lingzhuLocalHealthUrl(config)
    const localSseUrl =
      typeof snapshotDetails.endpoint_url === 'string' && snapshotDetails.endpoint_url
        ? String(snapshotDetails.endpoint_url)
        : lingzhuLocalSseUrl(config)
    const publicSseUrl =
      typeof snapshotDetails.public_endpoint_url === 'string' && snapshotDetails.public_endpoint_url
        ? String(snapshotDetails.public_endpoint_url)
        : lingzhuPublicSseUrl(config)
    const generatedConfig =
      typeof testDetails.generated_openclaw_config === 'string' && testDetails.generated_openclaw_config
        ? String(testDetails.generated_openclaw_config)
        : typeof snapshotDetails.generated_openclaw_config === 'string' && snapshotDetails.generated_openclaw_config
          ? String(snapshotDetails.generated_openclaw_config)
          : lingzhuGeneratedOpenclawConfig(config)
    const generatedCurl =
      typeof testDetails.generated_curl === 'string' && testDetails.generated_curl
        ? String(testDetails.generated_curl)
        : typeof snapshotDetails.generated_curl === 'string' && snapshotDetails.generated_curl
          ? String(snapshotDetails.generated_curl)
          : lingzhuGeneratedCurl(config)
    const supportedCommandsRaw =
      (Array.isArray(testDetails.supported_commands) ? testDetails.supported_commands : null) ||
      (Array.isArray(snapshotDetails.supported_commands) ? snapshotDetails.supported_commands : null) ||
      []
    const supportedCommands = supportedCommandsRaw.map((item) => String(item)).filter(Boolean)
    const authAk = lingzhuConfigString(config, 'auth_ak')
    const publicReady = Boolean(lingzhuPublicBaseUrl(config))
    const endpointReady = Boolean(enabled && authAk && publicReady)

    return (
      <div className="space-y-5">
        <section
          id={lingzhuStepAnchorId('endpoint')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.lingzhuQuickSetup}</span>
                <AnchorJumpButton anchorId={lingzhuStepAnchorId('endpoint')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.lingzhuStepEndpoint}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.lingzhuNeedPublicIp}</p>
            </div>
            <StepStateBadge state={endpointReady ? 'done' : enabled ? 'current' : 'pending'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <label className="flex min-h-[44px] items-center justify-between gap-4">
                <span className="text-sm font-medium">{t.enabled}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => onUpdateField(entry.name, 'enabled', event.target.checked)}
                  className="h-4 w-4 rounded border-black/20 text-foreground"
                />
              </label>
              <div className="mt-3 text-xs leading-5 text-muted-foreground">{t.lingzhuNeedPublicIp}</div>
            </div>
            {localHostField ? (
              <ConnectorFieldControl
                field={localHostField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
            {gatewayPortField ? (
              <ConnectorFieldControl
                field={gatewayPortField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
            {publicBaseUrlField ? (
              <ConnectorFieldControl
                field={publicBaseUrlField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => onUpdateConnector(entry.name, { local_host: '127.0.0.1', gateway_port: '18789' })}
                >
                  {t.lingzhuUseLocalDefaults}
                </Button>
            <Button onClick={onSave} disabled={saving || !enabled}>
              <Save className="h-4 w-4" />
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </section>

        <section
          id={lingzhuStepAnchorId('platform')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.lingzhuStepPlatform}</span>
                <AnchorJumpButton anchorId={lingzhuStepAnchorId('platform')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.lingzhuGeneratedValues}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.lingzhuPlatformReminder}</p>
            </div>
            <StepStateBadge state={endpointReady ? 'current' : 'pending'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {authAkField ? (
              <ConnectorFieldControl
                field={authAkField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="text-sm font-medium">{t.lingzhuGenerateAk}</div>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">{t.lingzhuPublicHint}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => onUpdateField(entry.name, 'auth_ak', createLingzhuAk())}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t.lingzhuGenerateAk}
                </Button>
              </div>
            </div>
            {agentIdField ? (
              <ConnectorFieldControl
                field={agentIdField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
            {systemPromptField ? (
              <ConnectorFieldControl
                field={systemPromptField}
                config={config}
                locale={locale}
                onChange={(key, value) => onUpdateField(entry.name, key, value)}
              />
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.lingzhuLocalHealthUrl}</div>
              <div className="mt-2 break-all text-sm font-medium">{localHealthUrl}</div>
            </div>
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.lingzhuLocalSseUrl}</div>
              <div className="mt-2 break-all text-sm font-medium">{localSseUrl}</div>
            </div>
            <div className="rounded-[20px] border border-black/[0.06] bg-white/[0.62] px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.lingzhuPublicSseUrl}</div>
              <div className="mt-2 break-all text-sm font-medium">{publicSseUrl || '—'}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="text-sm font-medium">{t.lingzhuOpenclawConfig}</div>
              <Textarea value={generatedConfig} readOnly className="mt-3 min-h-[240px] rounded-[18px] border-black/[0.08] bg-white/[0.44] font-mono text-xs shadow-none dark:bg-white/[0.03]" />
            </div>
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="text-sm font-medium">{t.lingzhuCurl}</div>
              <Textarea value={generatedCurl} readOnly className="mt-3 min-h-[240px] rounded-[18px] border-black/[0.08] bg-white/[0.44] font-mono text-xs shadow-none dark:bg-white/[0.03]" />
            </div>
          </div>
        </section>

        <section
          id={lingzhuStepAnchorId('probe')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.lingzhuStepProbe}</span>
                <AnchorJumpButton anchorId={lingzhuStepAnchorId('probe')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{t.lingzhuProbeResult}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.lingzhuSnapshotHint}</p>
            </div>
            <StepStateBadge state={testItem?.ok ? 'done' : endpointReady ? 'current' : 'pending'} locale={locale} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="text-sm font-medium">{t.lingzhuSupportedCommands}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {supportedCommands.length ? (
                  supportedCommands.map((command) => (
                    <span key={command} className="rounded-full border border-black/[0.08] bg-white/[0.44] px-3 py-1 text-xs dark:border-white/[0.12] dark:bg-white/[0.03]">
                      {command}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-black/[0.08] bg-white/[0.52] p-4 dark:border-white/[0.12] dark:bg-white/[0.04]">
              <div className="text-sm font-medium">{t.lingzhuAgentIdHint}</div>
              <div className="mt-2 text-sm text-muted-foreground">{lingzhuAgentId(config)}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onTest(entry.name)} disabled={testing || !enabled}>
                  <Send className="h-4 w-4" />
                  {testing ? t.testing : t.lingzhuRunProbe}
                </Button>
              </div>
            </div>
          </div>

          {!testItem ? <div className="mt-4 text-sm text-muted-foreground">{t.lingzhuNoProbeYet}</div> : null}

          <div className="mt-5 border-t border-black/[0.06] pt-5 dark:border-white/[0.08]">
            <div className="grid gap-4 md:grid-cols-2">
              {behaviorFields.map((field) => (
                <ConnectorFieldControl
                  key={field.key}
                  field={field}
                  config={config}
                  locale={locale}
                  onChange={(key, value) => onUpdateField(entry.name, key, value)}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          id={lingzhuStepAnchorId('advanced')}
          className="rounded-[24px] border border-black/[0.08] bg-white/[0.48] p-5 dark:border-white/[0.12] dark:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.showLegacy}</span>
                <AnchorJumpButton anchorId={lingzhuStepAnchorId('advanced')} onJumpToAnchor={onJumpToAnchor} />
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight">{translateSettingsCatalogText(locale, 'Advanced debug')}</h4>
            </div>
            <Button variant="secondary" onClick={() => setLegacyExpanded((current) => !current)}>
              {legacyExpanded ? t.hideLegacy : t.showLegacy}
            </Button>
          </div>
          {legacyExpanded ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {advancedFields.map((field) => (
                <ConnectorFieldControl
                  key={field.key}
                  field={field}
                  config={config}
                  locale={locale}
                  onChange={(key, value) => onUpdateField(entry.name, key, value)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <section id={cardAnchorId} className="border-t border-black/[0.08] pt-6 dark:border-white/[0.08]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-black/[0.08] bg-white/[0.44] dark:border-white/[0.12] dark:bg-white/[0.03]">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold tracking-tight">
                  {translateSettingsCatalogText(locale, entry.label)}
                </h3>
                <AnchorJumpButton anchorId={cardAnchorId} onJumpToAnchor={onJumpToAnchor} />
                <HintDot
                  label={`${translateSettingsCatalogText(locale, entry.subtitle)} ${translateSettingsCatalogText(locale, entry.deliveryNote)}`.trim()}
                />
                <span className="text-xs text-muted-foreground">{enabled ? t.enabled : t.disabled}</span>
                {testItem ? <span className="text-xs text-muted-foreground">{testItem.ok ? t.ok : t.needsWork}</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/[0.52] px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onUpdateField(entry.name, 'enabled', event.target.checked)}
              className="h-4 w-4 rounded border-black/20"
            />
            {t.enabled}
          </label>
          <a
            href={entry.portalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/[0.52] px-3 py-2 text-sm transition hover:border-black/[0.14] hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.04]"
          >
            <ArrowUpRight className="h-4 w-4" />
            {t.portal}
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {entry.name === 'qq'
            ? renderQqSetup()
            : entry.name === 'lingzhu'
              ? renderLingzhuSetup()
              : renderGenericSections()}
        </div>

        <aside className="space-y-6 xl:border-l xl:border-black/[0.08] xl:pl-6 xl:dark:border-white/[0.08]">
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span>{t.snapshot}</span>
            </div>
            {snapshot ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="text-foreground">{t.transportLabel}:</span>{' '}
                  {translateSettingsCatalogText(locale, snapshot.transport || snapshot.display_mode || snapshot.mode || 'default')}
                </div>
                <div>
                  <span className="text-foreground">{t.connection}:</span>{' '}
                  {translateSettingsCatalogText(locale, snapshot.connection_state || 'idle')}
                </div>
                <div>
                  <span className="text-foreground">{t.auth}:</span>{' '}
                  {translateSettingsCatalogText(locale, snapshot.auth_state || 'idle')}
                </div>
                <div>
                  <span className="text-foreground">{t.lastMode}:</span>{' '}
                  {translateSettingsCatalogText(locale, snapshot.display_mode || snapshot.mode || 'default')}
                </div>
                <div>
                  <span className="text-foreground">{t.queues}:</span> {t.queueIn} {snapshot.inbox_count ?? 0} · {t.queueOut} {snapshot.outbox_count ?? 0}
                </div>
                <div>
                  <span className="text-foreground">{t.bindings}:</span> {snapshot.binding_count ?? 0}
                </div>
                <div>
                  <span className="text-foreground">{t.discoveredTargets}:</span> {snapshot.target_count ?? snapshot.discovered_targets?.length ?? 0}
                </div>
                {snapshot.default_target ? (
                  <div className="break-all">
                    <span className="text-foreground">{t.defaultTarget}:</span> {connectorTargetLabel(snapshot.default_target)}
                  </div>
                ) : null}
                {snapshot.main_chat_id ? (
                  <div className="break-all">
                    <span className="text-foreground">{t.boundTarget}:</span> {snapshot.main_chat_id}
                  </div>
                ) : null}
                {snapshot.last_conversation_id ? (
                  <div className="break-all">
                    <span className="text-foreground">{t.lastSeen}:</span> {snapshot.last_conversation_id}
                  </div>
                ) : null}
                {snapshot.relay_url ? <div className="break-all">{snapshot.relay_url}</div> : null}
                {entry.name === 'lingzhu' && snapshot.details ? (
                  <>
                    {typeof snapshot.details.health_url === 'string' ? (
                      <div className="break-all">
                        <span className="text-foreground">{t.lingzhuLocalHealthUrl}:</span> {String(snapshot.details.health_url)}
                      </div>
                    ) : null}
                    {typeof snapshot.details.public_endpoint_url === 'string' && snapshot.details.public_endpoint_url ? (
                      <div className="break-all">
                        <span className="text-foreground">{t.lingzhuPublicSseUrl}:</span> {String(snapshot.details.public_endpoint_url)}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t.noSnapshot}</div>
            )}
          </section>

          {entry.name !== 'lingzhu' ? (
            <>
              <section className="border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <RadioTower className="h-4 w-4 text-muted-foreground" />
                  <span>{t.recentActivity}</span>
                </div>
                {snapshot?.recent_events?.length ? (
                  <div className="feed-scrollbar max-h-[320px] space-y-2 overflow-auto pr-1">
                    {snapshot.recent_events.map((event, index) => (
                      <ConnectorEventRow
                        key={`${event.event_type}:${event.created_at || index}:${event.conversation_id || index}`}
                        event={event}
                        locale={locale}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t.noEvents}</div>
                )}
              </section>

              <section className="border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <RadioTower className="h-4 w-4 text-muted-foreground" />
                  <span>{t.testTarget}</span>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.chatType}</label>
                    <select
                      value={deliveryTarget.chat_type}
                      onChange={(event) => onUpdateDelivery(entry.name, { chat_type: event.target.value as DeliveryTargetState['chat_type'] })}
                      className="flex h-11 w-full rounded-[18px] border border-black/[0.08] bg-white/[0.44] px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-white/[0.03]"
                    >
                      <option value="direct">{t.direct}</option>
                      <option value="group">{t.group}</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.chatId}</label>
                    <Input
                      value={deliveryTarget.chat_id}
                      onChange={(event) => onUpdateDelivery(entry.name, { chat_id: event.target.value })}
                      placeholder={chatIdPlaceholder}
                      className="rounded-[18px] border-black/[0.08] bg-white/[0.44] shadow-none dark:bg-white/[0.03]"
                    />
                    {entry.name === 'qq' ? <div className="text-xs text-muted-foreground">{t.qqChatIdHint}</div> : null}
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.discoveredTargets}</label>
                    {snapshot?.discovered_targets?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {snapshot.discovered_targets.map((target) => (
                          <button
                            key={target.conversation_id}
                            type="button"
                            onClick={() =>
                              onUpdateDelivery(entry.name, {
                                chat_type: target.chat_type === 'group' ? 'group' : 'direct',
                                chat_id: target.chat_id,
                              })
                            }
                            className={cn(
                              'rounded-full border px-3 py-2 text-xs transition',
                              deliveryTarget.chat_id === target.chat_id && deliveryTarget.chat_type === (target.chat_type === 'group' ? 'group' : 'direct')
                                ? 'border-black/[0.14] bg-black/[0.05] text-foreground dark:border-white/[0.18] dark:bg-white/[0.08]'
                                : 'border-black/[0.08] bg-white/[0.44] text-muted-foreground hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.03]'
                            )}
                          >
                            {connectorTargetLabel(target)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">{t.noTargets}</div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.probeText}</label>
                    <Textarea
                      value={deliveryTarget.text}
                      onChange={(event) => onUpdateDelivery(entry.name, { text: event.target.value })}
                      placeholder={t.probePlaceholder}
                      className="min-h-[96px] rounded-[18px] border-black/[0.08] bg-white/[0.44] shadow-none dark:bg-white/[0.03]"
                    />
                  </div>
                  <Button variant="secondary" onClick={() => onTest(entry.name)} disabled={testing || !enabled}>
                    <Send className="h-4 w-4" />
                    {testing ? t.testing : t.testConnector}
                  </Button>
                </div>
              </section>
            </>
          ) : null}

          {testItem ? (
            <ResultNotice
              title={entry.name === 'lingzhu' ? t.lingzhuProbeResult : t.testResult}
              ok={testItem.ok}
              warnings={testItem.warnings}
              errors={testItem.errors}
              empty={entry.name === 'lingzhu' ? t.lingzhuNoProbeYet : t.emptyTest}
            />
          ) : null}
        </aside>
      </div>
    </section>
  )
}

export function ConnectorSettingsForm({
  locale,
  value,
  connectors,
  validation,
  testResult,
  saving,
  isDirty,
  validating,
  testingConnectorName,
  testingAll,
  onChange,
  onSave,
  onValidate,
  onTestAll,
  onTestConnector,
  onJumpToAnchor,
}: {
  locale: Locale
  value: ConnectorConfigMap
  connectors: ConnectorSnapshot[]
  validation: ConfigValidationPayload | null
  testResult: ConfigTestPayload | null
  saving: boolean
  isDirty: boolean
  validating: boolean
  testingConnectorName: ConnectorName | null
  testingAll: boolean
  onChange: (next: ConnectorConfigMap) => void
  onSave: () => void
  onValidate: () => void
  onTestAll: () => void
  onTestConnector: (connectorName: ConnectorName, deliveryTarget: DeliveryTargetState) => void
  onJumpToAnchor?: (anchorId: string) => void
}) {
  const t = copy[locale]
  const [deliveryTargets, setDeliveryTargets] = useState<Record<string, DeliveryTargetState>>({})
  const snapshots = useMemo(() => snapshotByName(connectors), [connectors])
  const testItems = useMemo(() => testItemByName(testResult), [testResult])
  const routing = useMemo(() => routingConfig(value), [value])
  const enabledEntries = useMemo(
    () => connectorCatalog.filter((entry) => Boolean(value[entry.name]?.enabled)),
    [value]
  )
  const preferredConnector = typeof routing.primary_connector === 'string' ? routing.primary_connector : ''
  const deliveryPolicy =
    typeof routing.artifact_delivery_policy === 'string' ? routing.artifact_delivery_policy : 'fanout_all'

  useEffect(() => {
    const nextPreferred =
      enabledEntries.length === 1
        ? enabledEntries[0].name
        : enabledEntries.some((entry) => entry.name === preferredConnector)
          ? preferredConnector
          : ''
    if (nextPreferred === preferredConnector) {
      return
    }
    onChange({
      ...value,
      _routing: {
        ...routing,
        primary_connector: nextPreferred || null,
      },
    })
  }, [enabledEntries, onChange, preferredConnector, routing, value])

  const updateConnectorField = (connectorName: ConnectorName, key: string, fieldValue: unknown) => {
    const current = value[connectorName] || {}
    onChange({
      ...value,
      [connectorName]: {
        ...current,
        [key]: fieldValue,
      },
    })
  }

  const updateConnectorFields = (connectorName: ConnectorName, patch: Record<string, unknown>) => {
    const current = value[connectorName] || {}
    onChange({
      ...value,
      [connectorName]: {
        ...current,
        ...patch,
      },
    })
  }

  const updateRouting = (patch: Record<string, unknown>) => {
    onChange({
      ...value,
      _routing: {
        ...routing,
        ...patch,
      },
    })
  }

  const updateDeliveryTarget = (connectorName: ConnectorName, patch: Partial<DeliveryTargetState>) => {
    setDeliveryTargets((current) => ({
      ...current,
      [connectorName]: {
        chat_type: 'direct',
        chat_id: '',
        text: '',
        ...(current[connectorName] || {}),
        ...patch,
      },
    }))
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-black/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
          <HintDot label={t.subtitle} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? t.saving : t.save}
          </Button>
          <Button variant="secondary" onClick={onValidate} disabled={validating}>
            <ShieldCheck className="h-4 w-4" />
            {validating ? t.validating : t.validate}
          </Button>
          <Button variant="secondary" onClick={onTestAll} disabled={testingAll}>
            <Send className="h-4 w-4" />
            {testingAll ? t.testing : t.testAll}
          </Button>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-8">
          <section className="border-b border-black/[0.08] pb-6 dark:border-white/[0.08]">
            <div id="connectors-routing" className="mb-3 flex items-center gap-2 text-sm font-medium">
              <span>{t.routingTitle}</span>
              <HintDot label={t.routingSubtitle} />
              <AnchorJumpButton anchorId="connectors-routing" onJumpToAnchor={onJumpToAnchor} />
            </div>

            {enabledEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t.routingEmpty}</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.primaryConnector}</div>
                  <div className="flex flex-wrap gap-2">
                    {enabledEntries.map((entry) => {
                      const selected = preferredConnector === entry.name
                      return (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={() => updateRouting({ primary_connector: entry.name })}
                          className={cn(
                            'rounded-full border px-3 py-2 text-sm transition',
                            selected
                              ? 'border-black/[0.14] bg-black/[0.05] text-foreground dark:border-white/[0.18] dark:bg-white/[0.08]'
                              : 'border-black/[0.08] bg-white/[0.44] text-muted-foreground hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.03]'
                          )}
                        >
                          {translateSettingsCatalogText(locale, entry.label)}
                        </button>
                      )
                    })}
                  </div>
                  {enabledEntries.length === 1 ? <div className="mt-2 text-xs text-muted-foreground">{t.routingAutoSingle}</div> : null}
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.deliveryPolicy}</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'fanout_all', label: t.fanoutAll },
                      { value: 'primary_only', label: t.primaryOnly },
                      { value: 'primary_plus_local', label: t.primaryPlusLocal },
                    ].map((option) => {
                      const selected = deliveryPolicy === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateRouting({ artifact_delivery_policy: option.value })}
                          className={cn(
                            'rounded-full border px-3 py-2 text-sm transition',
                            selected
                              ? 'border-black/[0.14] bg-black/[0.05] text-foreground dark:border-white/[0.18] dark:bg-white/[0.08]'
                              : 'border-black/[0.08] bg-white/[0.44] text-muted-foreground hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.03]'
                          )}
                        >
                          {translateSettingsCatalogText(locale, option.label)}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{t.localMirror}</div>
                </div>
              </div>
            )}
          </section>

          {connectorCatalog.map((entry) => (
            <ConnectorCard
              key={entry.name}
              entry={entry}
              locale={locale}
              config={value[entry.name] || {}}
              snapshot={snapshots.get(entry.name)}
              testItem={testItems.get(entry.name)}
              saving={saving}
              isDirty={isDirty}
              testing={testingConnectorName === entry.name}
              deliveryTarget={deliveryTargets[entry.name] || { chat_type: 'direct', chat_id: '', text: '' }}
              onUpdateField={updateConnectorField}
              onUpdateConnector={updateConnectorFields}
              onUpdateDelivery={updateDeliveryTarget}
              onSave={onSave}
              onTest={(connectorName) => onTestConnector(connectorName, deliveryTargets[connectorName] || { chat_type: 'direct', chat_id: '', text: '' })}
              onJumpToAnchor={onJumpToAnchor}
            />
          ))}
        </div>

        <aside className="space-y-0 xl:border-l xl:border-black/[0.08] xl:pl-6 xl:dark:border-white/[0.08]">
          <ResultNotice
            title={t.validation}
            ok={validation?.ok ?? true}
            warnings={validation?.warnings || []}
            errors={validation?.errors || []}
            empty={t.emptyValidation}
          />
          <ResultNotice
            title={t.testResult}
            ok={testResult?.ok ?? true}
            warnings={testResult?.warnings || []}
            errors={testResult?.errors || []}
            empty={t.emptyTest}
          />
        </aside>
      </div>
    </div>
  )
}
