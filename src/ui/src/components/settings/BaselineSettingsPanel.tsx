import { X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/modal'
import type { BaselineRegistryEntry, Locale } from '@/types'

const copy = {
  en: {
    title: 'Reusable baselines',
    hint: 'Published baselines that can be attached to quests before new work starts.',
    empty: 'No reusable baselines have been published yet.',
    summaryFallback: 'No summary provided.',
    status: 'Status',
    sourceMode: 'Source',
    availability: 'Availability',
    sourceQuest: 'Source quest',
    variants: 'Variants',
    updatedAt: 'Updated',
    deleteTitle: 'Delete this baseline?',
    deleteDescription:
      'This removes the baseline from the registry, clears bound quest references, and deletes materialized copies so future agent turns cannot attach or reuse it.',
    deleteConfirm: 'Delete baseline',
    cancel: 'Cancel',
  },
  zh: {
    title: 'Baseline 列表',
    hint: '这里显示所有可复用的已发布 baseline，新建 quest 时可以直接绑定它们。',
    empty: '当前还没有可复用的 baseline。',
    summaryFallback: '暂无摘要。',
    status: '状态',
    sourceMode: '来源',
    availability: '可用性',
    sourceQuest: '来源 quest',
    variants: '变体数',
    updatedAt: '更新时间',
    deleteTitle: '确认删除这个 baseline？',
    deleteDescription:
      '删除后会同时移除 registry 记录、清空 quest 上的绑定引用，并删除已经 materialize 到 quest/worktree 里的副本，后续 agent 轮次将不能再 attach 或复用它。',
    deleteConfirm: '删除 baseline',
    cancel: '取消',
  },
} satisfies Record<Locale, Record<string, string>>

function formatTimestamp(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (!normalized) return '—'
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return normalized
  return date.toLocaleString()
}

function statusVariant(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'active' || normalized === 'quest_confirmed' || normalized === 'quest_local') return 'success' as const
  if (normalized === 'missing' || normalized === 'unhealthy') return 'warning' as const
  return 'secondary' as const
}

function availabilityVariant(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'ready') return 'success' as const
  if (normalized === 'missing') return 'warning' as const
  return 'secondary' as const
}

export function BaselineSettingsPanel({
  locale,
  entries,
  deletingBaselineId,
  onDeleteBaseline,
}: {
  locale: Locale
  entries: BaselineRegistryEntry[]
  deletingBaselineId: string
  onDeleteBaseline: (baselineId: string) => Promise<void> | void
}) {
  const t = copy[locale]
  const [deleteTarget, setDeleteTarget] = useState<BaselineRegistryEntry | null>(null)
  const sortedEntries = useMemo(
    () =>
      [...entries].sort((left, right) =>
        String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''))
      ),
    [entries]
  )

  return (
    <>
      <section className="rounded-[28px] border border-black/[0.08] bg-white/[0.5] p-5 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.45)] dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
            <div className="mt-2 text-sm text-muted-foreground">{t.hint}</div>
          </div>
          <Badge variant="secondary">{sortedEntries.length}</Badge>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="mt-6 rounded-[22px] border border-dashed border-black/[0.08] bg-white/[0.38] px-4 py-8 text-sm text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.02]">
            {t.empty}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {sortedEntries.map((entry) => {
              const baselineId = String(entry.baseline_id || '').trim()
              const variantCount = Array.isArray(entry.baseline_variants) ? entry.baseline_variants.length : 0
              const status = String(entry.status || 'unknown').trim() || 'unknown'
              const sourceMode = String(entry.source_mode || 'unknown').trim() || 'unknown'
              const availability = String(entry.availability || '').trim()
              return (
                <article
                  key={baselineId}
                  className="rounded-[24px] border border-black/[0.08] bg-white/[0.72] p-5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-all text-lg font-semibold tracking-tight">{baselineId}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={statusVariant(status)}>{status}</Badge>
                        <Badge variant="secondary">{sourceMode}</Badge>
                        {availability ? <Badge variant={availabilityVariant(availability)}>{availability}</Badge> : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(entry)}
                      disabled={deletingBaselineId === baselineId}
                      aria-label={t.deleteConfirm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {String(entry.summary || '').trim() || t.summaryFallback}
                  </p>

                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{t.status}</dt>
                      <dd className="text-right text-foreground">{status}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{t.sourceMode}</dt>
                      <dd className="text-right text-foreground">{sourceMode}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{t.variants}</dt>
                      <dd className="text-right text-foreground">{variantCount}</dd>
                    </div>
                    {availability ? (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">{t.availability}</dt>
                        <dd className="text-right text-foreground">{availability}</dd>
                      </div>
                    ) : null}
                    {String(entry.source_quest_id || '').trim() ? (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">{t.sourceQuest}</dt>
                        <dd className="break-all text-right text-foreground">{String(entry.source_quest_id || '').trim()}</dd>
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{t.updatedAt}</dt>
                      <dd className="text-right text-foreground">{formatTimestamp(entry.updated_at || entry.created_at)}</dd>
                    </div>
                  </dl>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          Promise.resolve(onDeleteBaseline(deleteTarget.baseline_id))
            .then(() => setDeleteTarget(null))
            .catch(() => undefined)
        }}
        title={t.deleteTitle}
        description={`${t.deleteDescription}${deleteTarget ? `\n\n${deleteTarget.baseline_id}` : ''}`}
        confirmText={t.deleteConfirm}
        cancelText={t.cancel}
        variant="danger"
        loading={Boolean(deleteTarget) && deletingBaselineId === deleteTarget?.baseline_id}
      />
    </>
  )
}
