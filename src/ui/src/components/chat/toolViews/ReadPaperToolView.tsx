'use client'

import { AlertTriangle, BookOpen, FileText, GraduationCap } from 'lucide-react'
import { useI18n } from '@/lib/i18n/useI18n'
import type { ToolViewProps } from './types'

type UnknownRecord = Record<string, unknown>

interface NormalizedUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface NormalizedArxiv {
  arxivId: string
  absUrl: string
  pdfUrl: string
}

interface NormalizedReadPaperItem {
  id: string
  question: string
  status: string
  answer: string
  error?: string
  nextSteps: string[]
  arxiv: NormalizedArxiv
  usage: NormalizedUsage
}

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function toInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return 0
}

function normalizeUsage(value: unknown): NormalizedUsage {
  const usage = asRecord(value)
  const inputTokens = toInt(usage.input_tokens)
  const outputTokens = toInt(usage.output_tokens)
  const totalTokens = toInt(usage.total_tokens) || inputTokens + outputTokens
  return { inputTokens, outputTokens, totalTokens }
}

function normalizeArxiv(value: unknown, fallbackId = ''): NormalizedArxiv {
  const arxiv = asRecord(value)
  const arxivId = pickString(arxiv.arxiv_id, fallbackId)
  const absUrl = pickString(arxiv.abs_url, arxivId ? `https://arxiv.org/abs/${arxivId}` : '')
  const pdfUrl = pickString(arxiv.pdf_url, arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : '')
  return { arxivId, absUrl, pdfUrl }
}

function normalizeItem(value: unknown): NormalizedReadPaperItem | null {
  const row = asRecord(value)
  const id = pickString(row.id)
  const question = pickString(row.question)
  const status = pickString(row.status).toLowerCase() || 'failed'
  const answer = pickString(row.answer)
  const error = pickString(row.error) || undefined
  const nextSteps = Array.isArray(row.next_steps)
    ? row.next_steps
        .map((item) => pickString(item))
        .filter((item) => Boolean(item))
    : []
  const arxiv = normalizeArxiv(row.arxiv, id)
  const usage = normalizeUsage(row.usage)
  if (!id && !question && !answer && !error) return null
  return {
    id,
    question,
    status,
    answer,
    error,
    nextSteps,
    arxiv,
    usage,
  }
}

export function ReadPaperToolView({ toolContent, panelMode }: ToolViewProps) {
  const { t } = useI18n('workspace')
  const showHeader = panelMode == null
  const toolRecord = asRecord(toolContent)
  const rawContent = asRecord(toolContent.content)
  const fallbackContent = asRecord(rawContent.result)
  const content = Object.keys(fallbackContent).length > 0 ? fallbackContent : rawContent

  const results = (Array.isArray(content.results) ? content.results : [])
    .map(normalizeItem)
    .filter((item): item is NormalizedReadPaperItem => item != null)

  const usage = normalizeUsage(content.usage)
  const successCount = toInt(content.success_count) || results.filter((item) => item.status === 'ok').length
  const failedCount =
    toInt(content.failed_count) || Math.max(0, results.length - successCount)
  const totalCount = toInt(content.count) || results.length
  const message = pickString(content.message)
  const error = pickString(content.error, rawContent.error, toolRecord.error)
  const isRunning = toolContent.status === 'calling'

  const summary = message || t(
    'tool_read_paper_summary',
    {
      count: totalCount,
      success: successCount,
      failed: failedCount,
    },
    'Processed {count} item(s): {success} succeeded, {failed} failed.'
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <GraduationCap className="mr-2 h-4 w-4 text-[var(--text-tertiary)]" />
          <div className="flex-1 text-center text-xs font-medium text-[var(--text-tertiary)]">
            {t('tool_read_paper_title', {}, 'Read Paper')}
          </div>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 py-3">
          {isRunning ? (
            <div className="text-xs text-[var(--text-tertiary)]">
              {t('tool_read_paper_running', {}, 'Reading papers...')}
            </div>
          ) : null}

          {!isRunning ? (
            <div className="text-xs text-[var(--text-tertiary)]">
              {summary}
              {usage.totalTokens > 0
                ? ` · ${t(
                    'tool_read_paper_usage',
                    {
                      input: usage.inputTokens,
                      output: usage.outputTokens,
                      total: usage.totalTokens,
                    },
                    'Input {input} · Output {output} · Total {total}'
                  )}`
                : ''}
            </div>
          ) : null}

          {error ? (
            <div className="ds-tool-error-banner" role="status">
              <AlertTriangle className="ds-tool-error-icon" />
              <span>{error}</span>
            </div>
          ) : null}

          {!isRunning && results.length === 0 ? (
            <div className="text-xs text-[var(--text-tertiary)]">
              {t('tool_read_paper_empty', {}, 'No read_paper results yet.')}
            </div>
          ) : null}

          {results.map((item, index) => (
            <article
              key={`${item.id || 'item'}-${index}`}
              className="rounded-xl border border-[var(--border-light)] bg-[var(--background-main)] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span className="rounded bg-[var(--background-gray-subtle)] px-1.5 py-0.5 font-mono">
                  {item.arxiv.arxivId || item.id || `#${index + 1}`}
                </span>
                {item.arxiv.absUrl ? (
                  <a
                    href={item.arxiv.absUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                  >
                    <BookOpen className="h-3 w-3" />
                    arXiv
                  </a>
                ) : null}
                {item.arxiv.pdfUrl ? (
                  <a
                    href={item.arxiv.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    PDF
                  </a>
                ) : null}
              </div>

              <div className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('tool_read_paper_question_label', {}, 'Question')}
              </div>
              <p className="mb-3 whitespace-pre-wrap text-xs text-[var(--text-primary)]">
                {item.question}
              </p>

              {item.status === 'ok' ? (
                <>
                  <div className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t('tool_read_paper_answer_label', {}, 'Answer')}
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
                    {item.answer}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t('tool_read_paper_failed_label', {}, 'Failed')}
                  </div>
                  <p className="text-xs text-[var(--text-primary)]">
                    {item.error || t('tool_read_paper_failed_generic', {}, 'Read paper failed.')}
                  </p>
                  {item.nextSteps.length > 0 ? (
                    <div className="rounded-lg bg-[var(--background-gray-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <div className="mb-1 font-semibold">
                        {t('tool_read_paper_next_steps_label', {}, 'Next steps')}
                      </div>
                      <ul className="list-disc space-y-1 pl-4">
                        {item.nextSteps.map((step, stepIndex) => (
                          <li key={`${item.id || index}-step-${stepIndex}`}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
