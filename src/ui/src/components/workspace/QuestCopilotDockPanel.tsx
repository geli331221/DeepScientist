import { useCallback } from 'react'

import { AiManusChatView } from '@/lib/plugins/ai-manus/AiManusChatView'
import type {
  AiManusChatActions,
  AiManusChatMeta,
} from '@/lib/plugins/ai-manus/view-types'

import { useCopilotDockCallbacks } from './CopilotDockOverlay'

type QuestCopilotDockPanelProps = {
  questId: string
  title: string
}

export function QuestCopilotDockPanel({
  questId,
  title,
}: QuestCopilotDockPanelProps) {
  const dockCallbacks = useCopilotDockCallbacks()

  const handleActionsChange = useCallback(
    (actions: AiManusChatActions | null) => {
      dockCallbacks?.onActionsChange(actions)
    },
    [dockCallbacks]
  )

  const handleMetaChange = useCallback(
    (meta: AiManusChatMeta) => {
      dockCallbacks?.onMetaChange({
        ...meta,
        title: meta.title || title,
      })
    },
    [dockCallbacks, title]
  )

  return (
    <div className="h-full min-h-0">
      <AiManusChatView
        mode="copilot"
        projectId={questId}
        embedded
        visible
        readOnly={false}
        uiMode="copilot"
        historyMode="overlay"
        sessionListEnabled={false}
        runtimeToggleEnabled={false}
        layoutPadding="flush"
        onActionsChange={handleActionsChange}
        onMetaChange={handleMetaChange}
        messageMetadata={{
          quest_id: questId,
          session_id: `quest:${questId}`,
          surface: 'copilot',
        }}
      />
    </div>
  )
}

export default QuestCopilotDockPanel
