'use client'
import * as React from 'react'
import { FolderOpen, PanelLeft, PanelRightClose, PanelRightOpen, Plus, X } from 'lucide-react'
import { GlareHover, Noise, SpotlightCard } from '@/components/react-bits'
import { cn } from '@/lib/utils'
import { COPILOT_FILES_ENABLED } from '@/lib/feature-flags'
import type { AiManusChatActions, AiManusChatMeta, CopilotPrefill } from '@/lib/plugins/ai-manus/view-types'
import RotatingText from '@/components/RotatingText'
import { useI18n } from '@/lib/i18n/useI18n'
import { WelcomeCopilotView } from './WelcomeCopilotView'

type WelcomeStageProps = {
  projectId: string
  readOnly?: boolean
  visible?: boolean
  prefill?: CopilotPrefill | null
  onActionsChange?: (actions: AiManusChatActions | null) => void
  onExitHome?: () => void
  className?: string
}

export function WelcomeStage({
  projectId,
  readOnly,
  visible,
  prefill,
  onActionsChange,
  onExitHome,
  className,
}: WelcomeStageProps) {
  const { t } = useI18n('workspace')
  const [copilotActions, setCopilotActions] = React.useState<AiManusChatActions | null>(null)
  const [copilotMeta, setCopilotMeta] = React.useState<AiManusChatMeta | null>(null)
  const [historyOpenOverride, setHistoryOpenOverride] = React.useState(false)
  const historyPanelId = React.useId()
  const readOnlyMode = Boolean(readOnly)
  const isCopilotMetaEqual = React.useCallback(
    (prev: AiManusChatMeta | null, next: AiManusChatMeta) => {
      if (!prev) return false
      return (
        prev.threadId === next.threadId &&
        prev.historyOpen === next.historyOpen &&
        prev.isResponding === next.isResponding &&
        prev.toolCount === next.toolCount &&
        prev.ready === next.ready &&
        prev.isRestoring === next.isRestoring &&
        prev.restoreAttempted === next.restoreAttempted &&
        prev.hasHistory === next.hasHistory &&
        prev.error === next.error &&
        prev.title === next.title &&
        prev.statusText === next.statusText &&
        prev.statusPrevText === next.statusPrevText &&
        prev.statusKey === next.statusKey &&
        prev.toolPanelVisible === next.toolPanelVisible &&
        prev.toolToggleVisible === next.toolToggleVisible &&
        prev.attachmentsDrawerOpen === next.attachmentsDrawerOpen &&
        prev.fixWithAiRunning === next.fixWithAiRunning
      )
    },
    []
  )

  const handleActionsChange = React.useCallback(
    (actions: AiManusChatActions | null) => {
      setCopilotActions(actions)
      onActionsChange?.(actions)
    },
    [onActionsChange]
  )

  const handleMetaChange = React.useCallback(
    (meta: AiManusChatMeta) => {
      setCopilotMeta((prev) => (isCopilotMetaEqual(prev, meta) ? prev : meta))
    },
    [isCopilotMetaEqual]
  )

  const logHistoryToggle = React.useCallback((next: boolean) => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production' || window.localStorage.getItem('ds_debug_copilot') === '1') {
      console.info('[CopilotHistory][welcome-toggle]', { open: next })
    }
  }, [])

  const handleHistoryToggle = React.useCallback(() => {
    setHistoryOpenOverride((prev) => {
      const next = !prev
      logHistoryToggle(next)
      return next
    })
  }, [logHistoryToggle])

  const statusText = typeof copilotMeta?.statusText === 'string' ? copilotMeta.statusText : ''
  const statusPrevText =
    typeof copilotMeta?.statusPrevText === 'string' ? copilotMeta.statusPrevText : ''
  const statusKey = copilotMeta?.statusKey ?? 0
  const statusTexts = statusText
    ? statusPrevText && statusPrevText !== statusText
      ? [statusPrevText, statusText]
      : [statusText]
    : []
  const showStatus = statusTexts.length > 0 && Boolean(copilotMeta?.isResponding)
  const statusAnimate = statusTexts.length > 1
  const historyOpen = historyOpenOverride
  const attachmentsDrawerOpen = Boolean(copilotMeta?.attachmentsDrawerOpen)
  const attachmentsToggleDisabled = !copilotActions?.toggleAttachmentsDrawer || !copilotMeta?.ready
  const attachmentsToggleLabel = attachmentsDrawerOpen
    ? t('copilot_hide_knowledge')
    : t('copilot_show_knowledge')
  const attachmentsToggleVisible = COPILOT_FILES_ENABLED && Boolean(copilotActions?.toggleAttachmentsDrawer)
  const toolToggleVisible = Boolean(copilotMeta?.toolToggleVisible)
  const toolPanelActive = Boolean(copilotMeta?.toolPanelVisible)

  return (
    <div
      className={cn(
        'panel center-panel morandi-glow ds-stage workspace-home-surface flex-1 min-h-0 min-w-0',
        className
      )}
    >
      <GlareHover className="relative flex h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[18px]" strength={0.32}>
        <SpotlightCard
          spotlightColor="rgba(159, 177, 194, 0.24)"
          hoverOnly
          className="ds-copilot-glass flex min-h-0 flex-1"
        >
          <Noise size={260} className="ds-copilot-noise opacity-[0.06]" />
          <div className="ds-copilot-glass-inner">
            <div className="ds-copilot-header">
              <div className="ds-copilot-header-left">
                <span className="ds-copilot-title">{t('copilot_title')}</span>
                {showStatus ? (
                  <>
                    <span className="ds-copilot-title-sep">·</span>
                    <RotatingText
                      key={`copilot-status-${statusKey}`}
                      texts={statusTexts}
                      auto={statusAnimate}
                      loop={false}
                      rotationInterval={1200}
                      staggerFrom="last"
                      staggerDuration={0.02}
                      initial={{ y: '90%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: '-120%', opacity: 0 }}
                      animatePresenceInitial
                      mainClassName="ds-copilot-status-text"
                      splitLevelClassName="ds-copilot-status-text-split"
                      elementLevelClassName="ds-copilot-status-text-element"
                    />
                  </>
                ) : null}
              </div>
              <div className="ds-copilot-header-right" role="toolbar" aria-label={t('copilot_controls')}>
                <button
                  type="button"
                  onClick={() => copilotActions?.startNewThread()}
                  className="ds-copilot-icon-btn"
                  aria-label={t('copilot_new_chat')}
                  data-tooltip={t('copilot_new_chat')}
                  disabled={!copilotActions || readOnlyMode}
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleHistoryToggle}
                  className={cn('ds-copilot-icon-btn', historyOpen && 'is-active')}
                  aria-label={t('copilot_history')}
                  aria-expanded={historyOpen}
                  aria-controls={historyPanelId}
                  data-tooltip={t('copilot_history')}
                  data-ai-manus-history-toggle="true"
                >
                  <PanelLeft size={16} />
                </button>
                {attachmentsToggleVisible ? (
                  <button
                    type="button"
                    onClick={() => copilotActions?.toggleAttachmentsDrawer?.()}
                    className={cn('ds-copilot-icon-btn', attachmentsDrawerOpen && 'is-active')}
                    aria-label={attachmentsToggleLabel}
                    aria-expanded={attachmentsDrawerOpen}
                    aria-controls="copilot-attachments-drawer"
                    data-tooltip={attachmentsToggleLabel}
                    disabled={attachmentsToggleDisabled}
                  >
                    <FolderOpen size={16} />
                  </button>
                ) : null}
                {toolToggleVisible ? (
                  <button
                    type="button"
                    onClick={() => copilotActions?.toggleToolPanel?.()}
                    aria-label={toolPanelActive ? t('copilot_hide_tool') : t('copilot_open_tool')}
                    data-tooltip={toolPanelActive ? t('copilot_hide_tool') : t('copilot_open_tool')}
                    className={cn('ds-copilot-icon-btn', toolPanelActive && 'is-active')}
                    disabled={!copilotActions?.toggleToolPanel}
                  >
                    {toolPanelActive ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  </button>
                ) : null}
                {onExitHome ? (
                  <button
                    type="button"
                    onClick={onExitHome}
                    className="ds-copilot-icon-btn"
                    aria-label={t('copilot_exit_agent')}
                    data-tooltip={t('copilot_exit_agent')}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="ds-copilot-body">
              <div className="ds-copilot-chat">
                <WelcomeCopilotView
                  projectId={projectId}
                  readOnly={readOnly}
                  visible={visible}
                  prefill={prefill}
                  historyPanelId={historyPanelId}
                  historyOpenOverride={historyOpenOverride}
                  onHistoryOpenChange={setHistoryOpenOverride}
                  onActionsChange={handleActionsChange}
                  onMetaChange={handleMetaChange}
                />
              </div>
            </div>
          </div>
        </SpotlightCard>
      </GlareHover>
    </div>
  )
}

export default WelcomeStage
