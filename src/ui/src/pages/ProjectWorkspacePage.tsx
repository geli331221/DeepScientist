import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { Noise } from '@/components/react-bits'
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { getProject, type Project } from '@/lib/api/projects'
import { useMaxEntitlement } from '@/lib/hooks/useMaxEntitlement'
import { useI18n } from '@/lib/i18n/useI18n'
import {
  clearActiveShareProject,
  getActiveShareProjectId,
  getShareSessionMeta,
  isShareViewForProject,
} from '@/lib/share-session'

function AtmosphereFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#ABA9A5] dark:bg-[#0B0C0E] font-project">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full blur-3xl animate-blob bg-[radial-gradient(circle_at_center,rgba(143,163,184,0.16),transparent_72%)] dark:bg-[radial-gradient(circle_at_center,rgba(143,163,184,0.16),transparent_72%)]" />
        <div
          className="absolute top-10 -right-52 h-[640px] w-[640px] rounded-full blur-3xl animate-blob bg-[radial-gradient(circle_at_center,rgba(47,52,55,0.08),transparent_72%)] dark:bg-[radial-gradient(circle_at_center,rgba(47,52,55,0.10),transparent_72%)]"
          style={{ animationDelay: '1.5s' }}
        />
        <Noise size={260} className="opacity-[0.04] dark:opacity-[0.05]" />
      </div>
      {children}
    </div>
  )
}

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const maxEntitlement = useMaxEntitlement('projects.read')
  const { t } = useI18n('workspace')
  const { t: tCommon } = useI18n('common')

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSharedView, setIsSharedView] = useState(false)
  const [sharedProjectName, setSharedProjectName] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('font-project')
    return () => document.body.classList.remove('font-project')
  }, [])

  useEffect(() => {
    if (!projectId) {
      setError(t('page_project_not_found'))
      setLoading(false)
      return
    }

    const active = getActiveShareProjectId()
    if (active && active !== projectId) {
      clearActiveShareProject()
    }

    const shareMeta = getShareSessionMeta()
    const shared = isShareViewForProject(projectId)
    if (shared) {
      setIsSharedView(true)
      setSharedProjectName(shareMeta?.projectName || t('page_shared_project'))
      setProject(null)
      setError(null)
      setLoading(false)
      return
    }

    setIsSharedView(false)

    let cancelled = false

    async function fetchProject() {
      try {
        setLoading(true)
        setError(null)
        const data = await getProject(projectId)
        if (!cancelled) {
          setProject(data)
        }
      } catch (caught) {
        if (!cancelled) {
          console.error('Failed to fetch project:', caught)
          setError(caught instanceof Error ? caught.message : t('page_failed_to_load_project'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchProject()

    return () => {
      cancelled = true
    }
  }, [projectId, t])

  if (loading) {
    return (
      <AtmosphereFrame>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
            <span>{t('page_loading_project')}</span>
          </div>
        </div>
      </AtmosphereFrame>
    )
  }

  const projectName = (isSharedView ? sharedProjectName : project?.name) || `Project ${projectId}`
  const isLocalQuestProject =
    !isSharedView && typeof project?.settings?.source === 'string' && project.settings.source === 'quest'

  if (
    !isSharedView &&
    !isLocalQuestProject &&
    !maxEntitlement.isEntitlementLoading &&
    !maxEntitlement.isMaxEntitled
  ) {
    return (
      <AtmosphereFrame>
        <div className="flex h-screen items-center justify-center">
          <div className="max-w-md space-y-4 p-8 text-center">
            <div className="text-lg font-medium">{t('page_plan_access_required')}</div>
            <p className="text-sm text-muted-foreground">{t('page_max_only_description')}</p>
            <Button onClick={() => (window.location.href = '/projects')}>{t('page_back_to_projects')}</Button>
          </div>
        </div>
      </AtmosphereFrame>
    )
  }

  if (error) {
    return (
      <AtmosphereFrame>
        <div className="flex h-screen items-center justify-center">
          <div className="max-w-md space-y-4 p-8 text-center">
            <div className="text-lg font-medium text-destructive">{t('page_failed_to_load_project')}</div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>{tCommon('action_retry')}</Button>
          </div>
        </div>
      </AtmosphereFrame>
    )
  }

  return (
    <WorkspaceLayout
      projectId={projectId}
      projectName={projectName}
      projectSource={
        !isSharedView && typeof project?.settings?.source === 'string'
          ? project.settings.source
          : null
      }
      readOnly={isSharedView}
      isSharedView={isSharedView}
    />
  )
}

export default ProjectWorkspacePage
