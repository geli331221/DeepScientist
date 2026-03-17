'use client'

import * as React from 'react'

type QuestCopilotPaneLayoutProps = {
  statusLine?: React.ReactNode
  footer: React.ReactNode
  children: (layout: { bottomInset: number }) => React.ReactNode
}

export function QuestCopilotPaneLayout({
  statusLine,
  footer,
  children,
}: QuestCopilotPaneLayoutProps) {
  const footerRef = React.useRef<HTMLDivElement | null>(null)
  const [footerHeight, setFooterHeight] = React.useState(88)

  React.useEffect(() => {
    const node = footerRef.current
    if (!node) return

    const measure = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height || 0)
      if (nextHeight > 0) {
        setFooterHeight((current) => (current === nextHeight ? current : nextHeight))
      }
    }

    measure()
    window.addEventListener('resize', measure)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', measure)
      }
    }

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const bottomInset = Math.max(Math.min(footerHeight, 52), 28)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {statusLine ? (
        <div className="px-4 pt-3 text-[11px] text-muted-foreground">{statusLine}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children({ bottomInset })}
      </div>

      <div
        ref={footerRef}
        className="border-t border-black/[0.06] bg-white/[0.35] px-4 py-3 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
      >
        {footer}
      </div>
    </div>
  )
}

export default QuestCopilotPaneLayout
