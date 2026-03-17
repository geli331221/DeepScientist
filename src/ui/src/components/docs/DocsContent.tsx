'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { MarkdownPreview } from './MarkdownPreview'
import { fetchDocContent } from '@/lib/docs'
import { extractMarkdownHeadings } from '@/lib/docs/markdown'
import type { MarkdownHeading } from '@/lib/docs/types'
import { cn } from '@/lib/utils'

interface DocsContentProps {
  filePath: string
  onTocChange?: (headings: MarkdownHeading[]) => void
  onContentReady?: () => void
  className?: string
}

export function DocsContent({ filePath, onTocChange, onContentReady, className }: DocsContentProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContent() {
      setLoading(true)
      setError(null)

      try {
        const text = await fetchDocContent(filePath)
        setContent(text)
      } catch (err) {
        console.error('Failed to load document:', err)
        setError('Failed to load document. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [filePath])

  const headings = useMemo(() => extractMarkdownHeadings(content), [content])

  useEffect(() => {
    onTocChange?.(headings)
  }, [headings, onTocChange])

  useEffect(() => {
    if (loading || error) return
    const raf = window.requestAnimationFrame(() => {
      onContentReady?.()
    })
    return () => window.cancelAnimationFrame(raf)
  }, [loading, error, content, onContentReady])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <MarkdownPreview
        content={content}
        baseFilePath={filePath}
        className="markdown-body ds-docs-markdown"
      />
    </div>
  )
}
