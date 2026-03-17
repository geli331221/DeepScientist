'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../api/admin';
import type {
  CreateAIProviderInput,
  UpdateAIProviderInput,
  UpdateUserInput,
  CreateInvitationInput,
  PaginationParams,
  AuditLogFilter,
  UpdateBroadcastInput,
  UpdateFeedbackInput,
  MineruConfigUpdate,
  UpdateConfigInput,
  AdminReviewWorkspaceListParams,
  AdminTestEmailRequest,
  AdminOutboundEmailListParams,
  AdminOutboundEmailCreateRequest,
  AutoFigureAdminSessionsParams,
  AutoFigureEditAdminSessionsParams,
  AutoFigureEditPricingConfigUpdateInput,
  AutoFigureEditStylePresetCreateInput,
  AutoFigureEditStylePresetUpdateInput,
  AdminUsageDailyParams,
  AdminAgentTemplateUpdateInput,
  AdminAgentCreateQueueAckRequest,
  AdminAgentSyncRetryRequest,
  AdminBroadcastListParams,
} from '../types/admin';
import type { LabPiControlRequest } from '../api/lab';

// Query keys
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  usageDaily: (params?: AdminUsageDailyParams) => [...adminKeys.all, 'usageDaily', params] as const,
  configs: () => [...adminKeys.all, 'configs'] as const,
  config: (key: string) => [...adminKeys.configs(), key] as const,
  agentEngine: () => [...adminKeys.all, 'agentEngine'] as const,
  registrationConfig: () => [...adminKeys.all, 'registrationConfig'] as const,
  reviewWorkspaces: (params?: AdminReviewWorkspaceListParams) =>
    [...adminKeys.all, 'reviewWorkspaces', params] as const,
  outboundEmails: (params?: AdminOutboundEmailListParams) =>
    [...adminKeys.all, 'outboundEmails', params] as const,
  outboundEmailsBase: () => [...adminKeys.all, 'outboundEmails'] as const,
  outboundEmail: (emailId: string) => [...adminKeys.all, 'outboundEmails', emailId] as const,
  providers: () => [...adminKeys.all, 'providers'] as const,
  users: (params?: PaginationParams) => [...adminKeys.all, 'users', params] as const,
  invitations: () => [...adminKeys.all, 'invitations'] as const,
  auditLogs: (params?: PaginationParams & AuditLogFilter) => [...adminKeys.all, 'auditLogs', params] as const,
  logSources: () => [...adminKeys.all, 'logSources'] as const,
  logTail: (source: string, lines: number) => [...adminKeys.all, 'logTail', source, lines] as const,
  broadcasts: (params?: AdminBroadcastListParams) =>
    [...adminKeys.all, 'broadcasts', params] as const,
  broadcastsBase: () => [...adminKeys.all, 'broadcasts'] as const,
  feedbacks: (params?: {
    skip?: number
    limit?: number
    status?: string
    type?: string
    priority?: string
    user_id?: string
    project_id?: string
    q?: string
  }) => [...adminKeys.all, 'feedbacks', params] as const,
  feedbacksBase: () => [...adminKeys.all, 'feedbacks'] as const,
  autofigureSessions: (params?: AutoFigureAdminSessionsParams) =>
    [...adminKeys.all, 'autofigureSessions', params] as const,
  autofigureSession: (sessionId: string) =>
    [...adminKeys.all, 'autofigureSessions', sessionId] as const,
  autofigureEditSessions: (params?: AutoFigureEditAdminSessionsParams) =>
    [...adminKeys.all, 'autofigureEditSessions', params] as const,
  autofigureEditSession: (sessionId: string) =>
    [...adminKeys.all, 'autofigureEditSessions', sessionId] as const,
  autofigureEditSessionRevisions: (sessionId?: string, params?: PaginationParams) =>
    [...adminKeys.all, 'autofigureEditSessionRevisions', sessionId, params] as const,
  autofigureEditSessionRevision: (sessionId?: string, revisionId?: string) =>
    [...adminKeys.all, 'autofigureEditSessionRevision', sessionId, revisionId] as const,
  autofigureEditStats: (params?: Omit<AutoFigureEditAdminSessionsParams, 'page' | 'page_size'>) =>
    [...adminKeys.all, 'autofigureEditStats', params] as const,
  autofigureEditPricingConfig: () => [...adminKeys.all, 'autofigureEditPricingConfig'] as const,
  autofigureEditStylePresets: () => [...adminKeys.all, 'autofigureEditStylePresets'] as const,
  projects: (params?: PaginationParams & { q?: string; include_deleted?: boolean }) =>
    [...adminKeys.all, 'projects', params] as const,
  projectDetail: (projectId: string) => [...adminKeys.all, 'projects', projectId] as const,
  projectAccessLogs: (params?: PaginationParams & { project_id?: string; user_id?: string }) =>
    [...adminKeys.all, 'projectAccessLogs', params] as const,
  files: (params?: PaginationParams & { project_id?: string; file_type?: string; deleted?: boolean; q?: string }) =>
    [...adminKeys.all, 'files', params] as const,
  fileVersions: (params?: PaginationParams & { file_id?: string; project_id?: string }) =>
    [...adminKeys.all, 'fileVersions', params] as const,
  uploadTasks: (params?: PaginationParams & { project_id?: string; status?: string }) =>
    [...adminKeys.all, 'uploadTasks', params] as const,
  cliSessions: (params?: PaginationParams & {
    server_id?: string;
    project_id?: string;
    actor_user_id?: string;
    session_type?: string;
  }) => [...adminKeys.all, 'cliSessions', params] as const,
  cliLogObjects: (params?: PaginationParams & { server_id?: string; project_id?: string }) =>
    [...adminKeys.all, 'cliLogObjects', params] as const,
  cliMetrics: (params?: PaginationParams & { server_id?: string; project_id?: string }) =>
    [...adminKeys.all, 'cliMetrics', params] as const,
  labOverview: () => [...adminKeys.all, 'labOverview'] as const,
  labAgentsBase: () => [...adminKeys.all, 'labAgents'] as const,
  labAgents: (params?: PaginationParams & {
    project_id?: string
    status?: string
    template_id?: string
  }) => [...adminKeys.all, 'labAgents', params] as const,
  labTemplatesBase: () => [...adminKeys.all, 'labTemplates'] as const,
  labTemplates: (params?: PaginationParams & { q?: string; enabled?: boolean }) =>
    [...adminKeys.all, 'labTemplates', params] as const,
  labQuestsBase: () => [...adminKeys.all, 'labQuests'] as const,
  labQuests: (params?: PaginationParams & { project_id?: string; status?: string }) =>
    [...adminKeys.all, 'labQuests', params] as const,
  labQuestDetail: (questId?: string) => [...adminKeys.all, 'labQuestDetail', questId] as const,
  labQuestEvents: (questId?: string, params?: { branch?: string; cursor?: string; limit?: number; includePayload?: boolean }) =>
    [...adminKeys.all, 'labQuestEvents', questId, params] as const,
  agentCreateQueueBase: () => [...adminKeys.all, 'agentCreateQueue'] as const,
  agentCreateQueue: (params?: PaginationParams & { project_id?: string }) =>
    [...adminKeys.all, 'agentCreateQueue', params] as const,
  agentSyncQueue: () => [...adminKeys.all, 'agentSyncQueue'] as const,
  backendPlugins: () => [...adminKeys.all, 'backendPlugins'] as const,
  pluginTools: () => [...adminKeys.all, 'pluginTools'] as const,
  aiUsage: (params?: PaginationParams & { user_id?: string; project_id?: string; source?: string }) =>
    [...adminKeys.all, 'aiUsage', params] as const,
  aiUsageSummary: (params?: PaginationParams) => [...adminKeys.all, 'aiUsageSummary', params] as const,
  systemHealth: () => [...adminKeys.all, 'systemHealth'] as const,
  systemEvents: (params?: PaginationParams & { severity?: string; source?: string }) =>
    [...adminKeys.all, 'systemEvents', params] as const,
  exports: (params?: PaginationParams & { status?: string; export_type?: string }) =>
    [...adminKeys.all, 'exports', params] as const,
  exportAccessLogs: (exportId: string, params?: PaginationParams) =>
    [...adminKeys.all, 'exportAccessLogs', exportId, params] as const,
  searchQueries: (params?: PaginationParams & { scope?: string }) =>
    [...adminKeys.all, 'searchQueries', params] as const,
  savedViews: (params?: PaginationParams & { module?: string }) =>
    [...adminKeys.all, 'savedViews', params] as const,
};

// Dashboard Stats
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: adminApi.getAdminStats,
  });
}

export function useAdminUsageDaily(params?: AdminUsageDailyParams) {
  return useQuery({
    queryKey: adminKeys.usageDaily(params),
    queryFn: () => adminApi.getAdminUsageDaily(params),
  });
}

// System Configuration
export function useConfigs() {
  return useQuery({
    queryKey: adminKeys.configs(),
    queryFn: adminApi.getConfigs,
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateConfigInput) => adminApi.updateConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.configs() });
    },
  });
}

export function useAdminStopReviewAnnotationAgent() {
  return useMutation({
    mutationFn: (input: { workspaceId: string; reason?: string }) =>
      adminApi.stopAdminReviewAnnotationAgent(input.workspaceId, { reason: input.reason }),
  })
}

export function useAdminReviewWorkspaces(params?: AdminReviewWorkspaceListParams) {
  return useQuery({
    queryKey: adminKeys.reviewWorkspaces(params),
    queryFn: () => adminApi.getAdminReviewWorkspaces(params),
  })
}

export function useAgentEngine() {
  return useQuery({
    queryKey: adminKeys.agentEngine(),
    queryFn: adminApi.getAgentEngine,
  });
}

export function useUpdateAgentEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateAgentEngine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.agentEngine() });
      queryClient.invalidateQueries({ queryKey: adminKeys.configs() });
    },
  });
}

export function useRegistrationConfig() {
  return useQuery({
    queryKey: adminKeys.registrationConfig(),
    queryFn: adminApi.getRegistrationConfig,
  });
}

export function useUpdateRegistrationConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateRegistrationConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.registrationConfig() });
      queryClient.invalidateQueries({ queryKey: adminKeys.configs() });
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (input: AdminTestEmailRequest) => adminApi.sendTestEmail(input),
  });
}

// Outbound Email
export function useAdminOutboundEmails(params?: AdminOutboundEmailListParams) {
  return useQuery({
    queryKey: adminKeys.outboundEmails(params),
    queryFn: () => adminApi.getAdminOutboundEmails(params),
  });
}

export function useAdminOutboundEmail(emailId?: string) {
  return useQuery({
    queryKey: adminKeys.outboundEmail(emailId || 'unknown'),
    queryFn: () => adminApi.getAdminOutboundEmail(emailId || ''),
    enabled: Boolean(emailId),
  });
}

export function useCreateAdminOutboundEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminOutboundEmailCreateRequest) => adminApi.createAdminOutboundEmail(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.outboundEmailsBase() });
    },
  });
}

// MinerU Configuration
export function useMineruConfig() {
  return useQuery({
    queryKey: [...adminKeys.configs(), 'mineru'],
    queryFn: adminApi.getMineruConfig,
  });
}

export function useUpdateMineruConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MineruConfigUpdate) => adminApi.updateMineruConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.configs(), 'mineru'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.configs() });
    },
  });
}

// AutoFigure Admin
export function useAutoFigureSessions(params?: AutoFigureAdminSessionsParams) {
  return useQuery({
    queryKey: adminKeys.autofigureSessions(params),
    queryFn: () => adminApi.getAutoFigureSessions(params),
  });
}

export function useAutoFigureSession(sessionId?: string) {
  return useQuery({
    queryKey: adminKeys.autofigureSession(sessionId || 'unknown'),
    queryFn: () => adminApi.getAutoFigureSession(sessionId || ''),
    enabled: !!sessionId,
  });
}

export function useAutoFigureEditSessions(params?: AutoFigureEditAdminSessionsParams) {
  return useQuery({
    queryKey: adminKeys.autofigureEditSessions(params),
    queryFn: () => adminApi.getAutoFigureEditSessions(params),
  });
}

export function useAutoFigureEditSession(sessionId?: string) {
  return useQuery({
    queryKey: adminKeys.autofigureEditSession(sessionId || 'unknown'),
    queryFn: () => adminApi.getAutoFigureEditSession(sessionId || ''),
    enabled: !!sessionId,
  });
}

export function useAutoFigureEditSessionRevisions(sessionId?: string, params?: PaginationParams) {
  return useQuery({
    queryKey: adminKeys.autofigureEditSessionRevisions(sessionId, params),
    queryFn: () => adminApi.getAutoFigureEditSessionRevisions(sessionId || '', params),
    enabled: !!sessionId,
  });
}

export function useAutoFigureEditSessionRevision(sessionId?: string, revisionId?: string) {
  return useQuery({
    queryKey: adminKeys.autofigureEditSessionRevision(sessionId, revisionId),
    queryFn: () => adminApi.getAutoFigureEditSessionRevision(sessionId || '', revisionId || ''),
    enabled: !!sessionId && !!revisionId,
  });
}

export function useAutoFigureEditStats(
  params?: Omit<AutoFigureEditAdminSessionsParams, 'page' | 'page_size'>,
) {
  return useQuery({
    queryKey: adminKeys.autofigureEditStats(params),
    queryFn: () => adminApi.getAutoFigureEditStats(params),
  });
}

export function useAutoFigureEditPricingConfig() {
  return useQuery({
    queryKey: adminKeys.autofigureEditPricingConfig(),
    queryFn: adminApi.getAutoFigureEditPricingConfig,
  })
}

export function useUpdateAutoFigureEditPricingConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AutoFigureEditPricingConfigUpdateInput) =>
      adminApi.updateAutoFigureEditPricingConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditPricingConfig() })
    },
  })
}

export function useAutoFigureEditStylePresets() {
  return useQuery({
    queryKey: adminKeys.autofigureEditStylePresets(),
    queryFn: adminApi.getAutoFigureEditStylePresets,
  });
}

export function useCreateAutoFigureEditStylePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      styleImageFile,
    }: {
      input: AutoFigureEditStylePresetCreateInput
      styleImageFile: File
    }) => adminApi.createAutoFigureEditStylePreset(input, styleImageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditStylePresets() });
    },
  });
}

export function useUpdateAutoFigureEditStylePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      input,
    }: {
      presetId: string;
      input: AutoFigureEditStylePresetUpdateInput;
    }) => adminApi.updateAutoFigureEditStylePreset(presetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditStylePresets() });
    },
  });
}

export function useReorderAutoFigureEditStylePresets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ id: string; sort_order: number }>) =>
      adminApi.reorderAutoFigureEditStylePresets(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditStylePresets() });
    },
  });
}

export function useDeleteAutoFigureEditStylePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (presetId: string) => adminApi.deleteAutoFigureEditStylePreset(presetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditStylePresets() });
    },
  });
}

export function useReplaceAutoFigureEditStylePresetImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, styleImageFile }: { presetId: string; styleImageFile: File }) =>
      adminApi.replaceAutoFigureEditStylePresetImage(presetId, styleImageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.autofigureEditStylePresets() });
    },
  });
}

// AI Providers
export function useAIProviders() {
  return useQuery({
    queryKey: adminKeys.providers(),
    queryFn: adminApi.getAIProviders,
  });
}

export function useCreateAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAIProviderInput) => adminApi.createAIProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.providers() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUpdateAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, input }: { name: string; input: UpdateAIProviderInput }) =>
      adminApi.updateAIProvider(name, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.providers() });
    },
  });
}

export function useDeleteAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => adminApi.deleteAIProvider(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.providers() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

// Users
export function useUsers(params?: PaginationParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.getUsers(params),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      adminApi.updateUser(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useDisableUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.disableUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useEnableUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.enableUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

// Invitations
export function useInvitations() {
  return useQuery({
    queryKey: adminKeys.invitations(),
    queryFn: adminApi.getInvitations,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CreateInvitationInput) => adminApi.createInvitation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invitations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useDeleteInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.deleteInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invitations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

// Audit Logs
export function useAuditLogs(params?: PaginationParams & AuditLogFilter) {
  return useQuery({
    queryKey: adminKeys.auditLogs(params),
    queryFn: () => adminApi.getAuditLogs(params),
  });
}

// Server Logs
export function useAdminLogSources() {
  return useQuery({
    queryKey: adminKeys.logSources(),
    queryFn: adminApi.getLogSources,
  });
}

export function useAdminLogTail(source: string, lines: number) {
  return useQuery({
    queryKey: adminKeys.logTail(source, lines),
    queryFn: () => adminApi.getLogTail(source, lines),
    enabled: Boolean(source),
    refetchOnWindowFocus: false,
  });
}

// Broadcasts (admin-only)
export function useAdminBroadcasts(params?: AdminBroadcastListParams) {
  return useQuery({
    queryKey: adminKeys.broadcasts(params),
    queryFn: () => adminApi.getAdminBroadcasts(params),
  });
}

export function useCreateAdminBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createAdminBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.broadcastsBase() });
    },
  });
}

export function useUpdateAdminBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ broadcastId, input }: { broadcastId: string; input: UpdateBroadcastInput }) =>
      adminApi.updateAdminBroadcast(broadcastId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.broadcastsBase() });
    },
  });
}

export function useDeleteAdminBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (broadcastId: string) => adminApi.deleteAdminBroadcast(broadcastId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.broadcastsBase() });
    },
  });
}

// Feedback (admin-only)
export function useAdminFeedbacks(params?: {
  skip?: number
  limit?: number
  status?: string
  type?: string
  priority?: string
  user_id?: string
  project_id?: string
  q?: string
}) {
  return useQuery({
    queryKey: adminKeys.feedbacks(params),
    queryFn: () => adminApi.getAdminFeedbacks(params),
  })
}

export function useUpdateAdminFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feedbackId, input }: { feedbackId: string; input: UpdateFeedbackInput }) =>
      adminApi.updateAdminFeedback(feedbackId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.feedbacksBase() })
    },
  })
}

// Project Monitoring
export function useAdminProjects(params?: PaginationParams & { q?: string; include_deleted?: boolean }) {
  return useQuery({
    queryKey: adminKeys.projects(params),
    queryFn: () => adminApi.getAdminProjects(params),
  });
}

export function useAdminProjectDetail(projectId?: string) {
  return useQuery({
    queryKey: adminKeys.projectDetail(projectId || 'unknown'),
    queryFn: () => adminApi.getAdminProjectDetail(projectId || ''),
    enabled: !!projectId,
  });
}

export function useAdminProjectAccessLogs(
  params?: PaginationParams & { project_id?: string; user_id?: string }
) {
  return useQuery({
    queryKey: adminKeys.projectAccessLogs(params),
    queryFn: () => adminApi.getAdminProjectAccessLogs(params),
  });
}

// File/Storage Monitoring
export function useAdminFiles(params?: PaginationParams & {
  project_id?: string;
  file_type?: string;
  deleted?: boolean;
  q?: string;
  include_storage_key?: boolean;
}) {
  return useQuery({
    queryKey: adminKeys.files(params),
    queryFn: () => adminApi.getAdminFiles(params),
  });
}

export function useAdminFileVersions(
  params?: PaginationParams & { file_id?: string; project_id?: string; include_storage_key?: boolean }
) {
  return useQuery({
    queryKey: adminKeys.fileVersions(params),
    queryFn: () => adminApi.getAdminFileVersions(params),
  });
}

export function useAdminUploadTasks(params?: PaginationParams & { project_id?: string; status?: string }) {
  return useQuery({
    queryKey: adminKeys.uploadTasks(params),
    queryFn: () => adminApi.getAdminUploadTasks(params),
  });
}

// CLI Monitoring
export function useAdminCliSessions(params?: PaginationParams & {
  server_id?: string;
  project_id?: string;
  actor_user_id?: string;
  session_type?: string;
}) {
  return useQuery({
    queryKey: adminKeys.cliSessions(params),
    queryFn: () => adminApi.getAdminCliSessions(params),
  });
}

export function useAdminCliLogObjects(params?: PaginationParams & { server_id?: string; project_id?: string }) {
  return useQuery({
    queryKey: adminKeys.cliLogObjects(params),
    queryFn: () => adminApi.getAdminCliLogObjects(params),
  });
}

export function useAdminCliMetrics(params?: PaginationParams & { server_id?: string; project_id?: string }) {
  return useQuery({
    queryKey: adminKeys.cliMetrics(params),
    queryFn: () => adminApi.getAdminCliMetrics(params),
  });
}

// Lab Monitoring
export function useAdminLabOverview() {
  return useQuery({
    queryKey: adminKeys.labOverview(),
    queryFn: adminApi.getAdminLabOverview,
  });
}

export function useAdminLabAgents(params?: PaginationParams & {
  project_id?: string;
  status?: string;
  template_id?: string;
}) {
  return useQuery({
    queryKey: adminKeys.labAgents(params),
    queryFn: () => adminApi.getAdminLabAgents(params),
  });
}

export function useAdminAgentTemplates(params?: PaginationParams & { q?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: adminKeys.labTemplates(params),
    queryFn: () => adminApi.getAdminAgentTemplates(params),
  });
}

export function useUpdateAdminAgentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string;
      input: AdminAgentTemplateUpdateInput;
    }) => adminApi.updateAdminAgentTemplate(templateId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.labTemplatesBase() });
    },
  });
}

export function useAdminLabQuests(params?: PaginationParams & { project_id?: string; status?: string }) {
  return useQuery({
    queryKey: adminKeys.labQuests(params),
    queryFn: () => adminApi.getAdminLabQuests(params),
  });
}

export function useAdminLabQuestDetail(questId?: string) {
  return useQuery({
    queryKey: adminKeys.labQuestDetail(questId),
    queryFn: () => adminApi.getAdminLabQuestDetail(questId || ''),
    enabled: Boolean(questId),
  });
}

export function useAdminLabQuestEvents(
  questId?: string,
  params?: { branch?: string; cursor?: string; limit?: number; includePayload?: boolean }
) {
  return useQuery({
    queryKey: adminKeys.labQuestEvents(questId, params),
    queryFn: () => adminApi.getAdminLabQuestEvents(questId || '', params),
    enabled: Boolean(questId),
  });
}

export function useAdminLabQuestPiControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, payload }: { questId: string; payload: LabPiControlRequest }) =>
      adminApi.controlAdminLabQuestPi(questId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.labQuestDetail(variables.questId) });
      queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'labQuestEvents', variables.questId],
      });
    },
  });
}

export function useAdminAgentCreateQueue(params?: PaginationParams & { project_id?: string }) {
  return useQuery({
    queryKey: adminKeys.agentCreateQueue(params),
    queryFn: () => adminApi.getAdminAgentCreateQueue(params),
  });
}

export function useAckAdminAgentCreateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminAgentCreateQueueAckRequest) =>
      adminApi.ackAdminAgentCreateQueue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.agentCreateQueueBase() });
    },
  });
}

export function useAdminAgentSyncQueue() {
  return useQuery({
    queryKey: adminKeys.agentSyncQueue(),
    queryFn: adminApi.getAdminAgentSyncQueue,
  });
}

export function useRetryAdminAgentSyncQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminAgentSyncRetryRequest) =>
      adminApi.retryAdminAgentSyncQueue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.agentSyncQueue() });
    },
  });
}

export function useFreezeAdminLabAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentInstanceId, reason }: { agentInstanceId: string; reason?: string }) =>
      adminApi.freezeAdminLabAgent(agentInstanceId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.labAgentsBase() });
      queryClient.invalidateQueries({ queryKey: adminKeys.labOverview() });
    },
  });
}

export function useUnfreezeAdminLabAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentInstanceId, reason }: { agentInstanceId: string; reason?: string }) =>
      adminApi.unfreezeAdminLabAgent(agentInstanceId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.labAgentsBase() });
      queryClient.invalidateQueries({ queryKey: adminKeys.labOverview() });
    },
  });
}

// Plugin Monitoring
export function useAdminBackendPlugins() {
  return useQuery({
    queryKey: adminKeys.backendPlugins(),
    queryFn: adminApi.getAdminBackendPlugins,
  });
}

export function useAdminPluginTools() {
  return useQuery({
    queryKey: adminKeys.pluginTools(),
    queryFn: adminApi.getAdminPluginTools,
  });
}

// AI Usage Monitoring
export function useAdminAIUsage(params?: PaginationParams & {
  user_id?: string;
  project_id?: string;
  source?: string;
  provider?: string;
  model?: string;
}) {
  return useQuery({
    queryKey: adminKeys.aiUsage(params),
    queryFn: () => adminApi.getAdminAIUsage(params),
  });
}

export function useAdminAIUsageSummary(params?: PaginationParams) {
  return useQuery({
    queryKey: adminKeys.aiUsageSummary(params),
    queryFn: () => adminApi.getAdminAIUsageSummary(params),
  });
}

// System Health / Events
export function useAdminSystemHealth() {
  return useQuery({
    queryKey: adminKeys.systemHealth(),
    queryFn: adminApi.getAdminSystemHealth,
  });
}

export function useAdminSystemEvents(params?: PaginationParams & { severity?: string; source?: string }) {
  return useQuery({
    queryKey: adminKeys.systemEvents(params),
    queryFn: () => adminApi.getAdminSystemEvents(params),
  });
}

// Export Center
export function useAdminExports(params?: PaginationParams & { status?: string; export_type?: string }) {
  return useQuery({
    queryKey: adminKeys.exports(params),
    queryFn: () => adminApi.getAdminExports(params),
  });
}

export function useAdminExportAccessLogs(exportId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: adminKeys.exportAccessLogs(exportId, params),
    queryFn: () => adminApi.getAdminExportAccessLogs({ export_id: exportId, ...params }),
    enabled: !!exportId,
  });
}

export function useCreateAdminExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createAdminExport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.exports() });
    },
  });
}

// Search & Saved Views
export function useAdminSearch(query: string, scope?: string) {
  return useQuery({
    queryKey: [...adminKeys.all, 'search', query, scope],
    queryFn: () => adminApi.adminSearch(query, scope),
    enabled: query.trim().length >= 2,
  });
}

export function useAdminSearchQueries(params?: PaginationParams & { scope?: string }) {
  return useQuery({
    queryKey: adminKeys.searchQueries(params),
    queryFn: () => adminApi.getAdminSearchQueries(params),
  });
}

export function useAdminSavedViews(params?: PaginationParams & { module?: string }) {
  return useQuery({
    queryKey: adminKeys.savedViews(params),
    queryFn: () => adminApi.getAdminSavedViews(params),
  });
}

export function useCreateAdminSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createAdminSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.savedViews() });
    },
  });
}

export function useDeleteAdminSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => adminApi.deleteAdminSavedView(viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.savedViews() });
    },
  });
}
