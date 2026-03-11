import { AlertCircle, ArrowUpRight, CheckCircle2, Link2, RadioTower, Save, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { HintDot } from '@/components/ui/hint-dot'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ConfigTestPayload, ConfigValidationPayload, ConnectorSnapshot, ConnectorTargetSnapshot, Locale } from '@/types'

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

function ConnectorCard({
  entry,
  locale,
  config,
  snapshot,
  testItem,
  testing,
  deliveryTarget,
  onUpdateField,
  onUpdateDelivery,
  onTest,
}: {
  entry: ConnectorCatalogEntry
  locale: Locale
  config: Record<string, unknown>
  snapshot?: ConnectorSnapshot
  testItem?: ConfigTestPayload['items'][number]
  testing: boolean
  deliveryTarget: DeliveryTargetState
  onUpdateField: (connectorName: ConnectorName, key: string, value: unknown) => void
  onUpdateDelivery: (connectorName: ConnectorName, patch: Partial<DeliveryTargetState>) => void
  onTest: (connectorName: ConnectorName) => void
}) {
  const t = copy[locale]
  const Icon = entry.icon
  const enabled = Boolean(config.enabled)
  const [legacyExpanded, setLegacyExpanded] = useState(false)
  const chatIdPlaceholder = entry.name === 'qq' ? (deliveryTarget.chat_type === 'group' ? 'group_openid' : 'openid') : '123456789'

  return (
    <section className="border-t border-black/[0.08] pt-6 dark:border-white/[0.08]">
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
          {entry.sections.map((section) => (
            <section key={section.id} className="border-t border-black/[0.06] pt-4 first:border-t-0 first:pt-0 dark:border-white/[0.08]">
              <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{translateSettingsCatalogText(locale, section.title)}</span>
                  <HintDot label={translateSettingsCatalogText(locale, section.description)} />
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
          ))}
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
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t.noSnapshot}</div>
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

          {testItem ? (
            <ResultNotice
              title={t.testResult}
              ok={testItem.ok}
              warnings={testItem.warnings}
              errors={testItem.errors}
              empty={t.emptyTest}
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
  validating,
  testingConnectorName,
  testingAll,
  onChange,
  onSave,
  onValidate,
  onTestAll,
  onTestConnector,
}: {
  locale: Locale
  value: ConnectorConfigMap
  connectors: ConnectorSnapshot[]
  validation: ConfigValidationPayload | null
  testResult: ConfigTestPayload | null
  saving: boolean
  validating: boolean
  testingConnectorName: ConnectorName | null
  testingAll: boolean
  onChange: (next: ConnectorConfigMap) => void
  onSave: () => void
  onValidate: () => void
  onTestAll: () => void
  onTestConnector: (connectorName: ConnectorName, deliveryTarget: DeliveryTargetState) => void
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
    typeof routing.artifact_delivery_policy === 'string' ? routing.artifact_delivery_policy : 'primary_plus_local'

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
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <span>{t.routingTitle}</span>
              <HintDot label={t.routingSubtitle} />
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
              testing={testingConnectorName === entry.name}
              deliveryTarget={deliveryTargets[entry.name] || { chat_type: 'direct', chat_id: '', text: '' }}
              onUpdateField={updateConnectorField}
              onUpdateDelivery={updateDeliveryTarget}
              onTest={(connectorName) => onTestConnector(connectorName, deliveryTargets[connectorName] || { chat_type: 'direct', chat_id: '', text: '' })}
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
