import { apiClient } from './client';
import type {
  SystemConfig,
  UpdateConfigInput,
  AgentEngineResponse,
  AgentEngineUpdate,
  RegistrationConfigResponse,
  RegistrationConfigUpdate,
  AdminTestEmailRequest,
  AdminTestEmailResponse,
  AdminOutboundEmailSummary,
  AdminOutboundEmailDetail,
  AdminOutboundEmailListParams,
  AdminOutboundEmailCreateRequest,
  AdminOutboundEmailCreateResponse,
  MineruConfigResponse,
  MineruConfigUpdate,
  AdminReviewAgentStopInput,
  AdminReviewAgentStopResponse,
  AdminReviewWorkspaceListParams,
  AdminReviewWorkspaceListResponse,
  AutoFigureAdminSession,
  AutoFigureAdminSessionDetail,
  AutoFigureAdminSessionListResponse,
  AutoFigureAdminSessionsParams,
  AutoFigureEditAdminSession,
  AutoFigureEditAdminSessionDetail,
  AutoFigureEditAdminSessionListResponse,
  AutoFigureEditAdminRevisionSummary,
  AutoFigureEditAdminRevisionDetail,
  AutoFigureEditAdminRevisionListResponse,
  AutoFigureEditAdminSessionsParams,
  AutoFigureEditAdminStatsResponse,
  AutoFigureEditPricingConfig,
  AutoFigureEditPricingConfigUpdateInput,
  AutoFigureEditStylePreset,
  AutoFigureEditStylePresetCreateInput,
  AutoFigureEditStylePresetListResponse,
  AutoFigureEditStylePresetUpdateInput,
  AIProvider,
  CreateAIProviderInput,
  UpdateAIProviderInput,
  User,
  UpdateUserInput,
  Invitation,
  CreateInvitationInput,
  AuditLog,
  AuditLogFilter,
  AdminStats,
  AdminUsageDailyParams,
  AdminUsageDailyResponse,
  AdminLogSourcesResponse,
  AdminLogTailResponse,
  AdminLabOverview,
  AdminLabAgentSummary,
  AdminLabAgentListResponse,
  AdminLabAgentActionResponse,
  AdminLabQuestSummary,
  AdminLabQuestListResponse,
  AdminLabQuestDetailResponse,
  AdminAgentCreateQueueItem,
  AdminAgentCreateQueueResponse,
  AdminAgentCreateQueueAckRequest,
  AdminAgentCreateQueueAckResponse,
  AdminAgentSyncQueueResponse,
  AdminAgentSyncRetryRequest,
  AdminAgentSyncRetryResponse,
  AdminLabActionRequest,
  AdminAgentTemplateSummary,
  AdminAgentTemplateListResponse,
  AdminAgentTemplateUpdateInput,
  AdminBroadcast,
  AdminBroadcastListParams,
  AdminBroadcastListResponse,
  CreateBroadcastInput,
  UpdateBroadcastInput,
  AdminFeedback,
  AdminFeedbackListResponse,
  UpdateFeedbackInput,
  AdminProjectListResponse,
  AdminProjectSummary,
  AdminProjectDetail,
  AdminProjectAccessLog,
  AdminProjectAccessLogListResponse,
  AdminFileListResponse,
  AdminFileSummary,
  AdminFileVersionListResponse,
  AdminFileVersionSummary,
  AdminUploadTaskListResponse,
  AdminUploadTaskSummary,
  AdminCliSessionListResponse,
  AdminCliSessionSummary,
  AdminCliLogObjectListResponse,
  AdminCliLogObjectSummary,
  AdminCliMetricListResponse,
  AdminCliMetricSummary,
  AdminPluginListResponse,
  AdminPluginSummary,
  AdminPluginToolListResponse,
  AdminPluginToolSummary,
  AdminAIUsageListResponse,
  AdminAIUsageRecord,
  AdminAIUsageSummaryResponse,
  AdminAIUsageTotals,
  AdminAIUsageUserTotal,
  AdminSystemHealthResponse,
  AdminSystemEventListResponse,
  AdminSystemEvent,
  AdminExportCreateInput,
  AdminExportListResponse,
  AdminExportRecord,
  AdminExportAccessLogListResponse,
  AdminExportAccessLog,
  AdminSearchResponse,
  AdminSearchResultItem,
  AdminSearchQueryListResponse,
  AdminSearchQuery,
  AdminSavedViewCreateInput,
  AdminSavedViewListResponse,
  AdminSavedView,
  PaginatedResponse,
  PaginationParams,
} from '../types/admin';
import type {
  LabQuestGraphResponse,
  LabQuestEventListResponse,
  LabPiControlRequest,
  LabPiControlResponse,
} from './lab';

const API_PREFIX = '/api/v1';

// Helper to mask API key
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function toPaginatedResponse<T>({
  items,
  total,
  page,
  pageSize,
}: {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}): PaginatedResponse<T> {
  const safePageSize = Math.max(1, pageSize);
  return {
    items,
    total,
    page,
    page_size: safePageSize,
    total_pages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

// Dashboard
export async function getAdminStats(): Promise<AdminStats> {
  const response = await apiClient.get<AdminStats>(`${API_PREFIX}/admin/stats`);
  return response.data;
}

export async function getAdminUsageDaily(
  params?: AdminUsageDailyParams
): Promise<AdminUsageDailyResponse> {
  const response = await apiClient.get<AdminUsageDailyResponse>(`${API_PREFIX}/admin/usage/daily`, {
    params,
  });
  return response.data;
}

// System Configuration
export async function getConfigs(): Promise<SystemConfig[]> {
  const response = await apiClient.get<{ items: SystemConfig[] }>(`${API_PREFIX}/admin/config`);
  return response.data.items || [];
}

export async function getConfig(key: string): Promise<SystemConfig> {
  const response = await apiClient.get<SystemConfig>(`${API_PREFIX}/admin/config/${key}`);
  return response.data;
}

export async function updateConfig(input: UpdateConfigInput): Promise<SystemConfig> {
  const response = await apiClient.put<SystemConfig>(`${API_PREFIX}/admin/config`, input);
  return response.data;
}

export async function stopAdminReviewAnnotationAgent(
  workspaceId: string,
  input: AdminReviewAgentStopInput = {}
): Promise<AdminReviewAgentStopResponse> {
  const response = await apiClient.post<AdminReviewAgentStopResponse>(
    `${API_PREFIX}/admin/review/workspaces/${workspaceId}/annotation-agent/stop`,
    input
  )
  return response.data
}

export async function getAdminReviewWorkspaces(
  params?: AdminReviewWorkspaceListParams
): Promise<AdminReviewWorkspaceListResponse> {
  const response = await apiClient.get<AdminReviewWorkspaceListResponse>(
    `${API_PREFIX}/admin/review/workspaces`,
    {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 50,
        status: params?.status || undefined,
        run_status: params?.run_status || undefined,
        q: params?.q || undefined,
      },
    }
  )
  return response.data
}

export async function getAgentEngine(): Promise<AgentEngineResponse> {
  const response = await apiClient.get<AgentEngineResponse>(`${API_PREFIX}/config/agent-engine`);
  return response.data;
}

export async function updateAgentEngine(input: AgentEngineUpdate): Promise<AgentEngineResponse> {
  const response = await apiClient.put<AgentEngineResponse>(`${API_PREFIX}/config/agent-engine`, input);
  return response.data;
}

export async function getRegistrationConfig(): Promise<RegistrationConfigResponse> {
  const response = await apiClient.get<RegistrationConfigResponse>(`${API_PREFIX}/config/registration`);
  return response.data;
}

export async function updateRegistrationConfig(
  input: RegistrationConfigUpdate
): Promise<RegistrationConfigResponse> {
  const response = await apiClient.put<RegistrationConfigResponse>(`${API_PREFIX}/config/registration`, input);
  return response.data;
}

export async function sendTestEmail(input: AdminTestEmailRequest): Promise<AdminTestEmailResponse> {
  const response = await apiClient.post<AdminTestEmailResponse>(`${API_PREFIX}/admin/email/test`, input);
  return response.data;
}

// Outbound Email (admin-only)
export async function getAdminOutboundEmails(
  params?: AdminOutboundEmailListParams
): Promise<PaginatedResponse<AdminOutboundEmailSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 20;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<{ items: AdminOutboundEmailSummary[]; total: number; skip: number; limit: number }>(
    `${API_PREFIX}/admin/emails`,
    {
      params: {
        skip,
        limit,
        status: params?.status || undefined,
        kind: params?.kind || undefined,
        user_id: params?.user_id || undefined,
        broadcast_id: params?.broadcast_id || undefined,
        q: params?.q || undefined,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminOutboundEmail(emailId: string): Promise<AdminOutboundEmailDetail> {
  const response = await apiClient.get<AdminOutboundEmailDetail>(`${API_PREFIX}/admin/emails/${emailId}`);
  return response.data;
}

export async function createAdminOutboundEmail(
  input: AdminOutboundEmailCreateRequest
): Promise<AdminOutboundEmailCreateResponse> {
  const response = await apiClient.post<AdminOutboundEmailCreateResponse>(`${API_PREFIX}/admin/emails`, input);
  return response.data;
}

// AutoFigure Admin
export async function getAutoFigureSessions(
  params?: AutoFigureAdminSessionsParams
): Promise<PaginatedResponse<AutoFigureAdminSession>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 20;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AutoFigureAdminSessionListResponse>(
    `${API_PREFIX}/admin/autofigure/sessions`,
    {
      params: {
        skip,
        limit,
        user_id: params?.user_id,
        project_id: params?.project_id,
        status: params?.status,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAutoFigureSession(sessionId: string): Promise<AutoFigureAdminSessionDetail> {
  const response = await apiClient.get<AutoFigureAdminSessionDetail>(
    `${API_PREFIX}/admin/autofigure/sessions/${sessionId}`
  );
  return response.data;
}

export async function getAutoFigureEditSessions(
  params?: AutoFigureEditAdminSessionsParams
): Promise<PaginatedResponse<AutoFigureEditAdminSession>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 20;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AutoFigureEditAdminSessionListResponse>(
    `${API_PREFIX}/admin/autofigure-edit/sessions`,
    {
      params: {
        skip,
        limit,
        user_id: params?.user_id,
        workspace_id: params?.workspace_id,
        status: params?.status,
        feedback_submitted: params?.feedback_submitted,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAutoFigureEditSession(
  sessionId: string
): Promise<AutoFigureEditAdminSessionDetail> {
  const response = await apiClient.get<AutoFigureEditAdminSessionDetail>(
    `${API_PREFIX}/admin/autofigure-edit/sessions/${sessionId}`
  );
  return response.data;
}

export async function getAutoFigureEditStats(
  params?: Omit<AutoFigureEditAdminSessionsParams, 'page' | 'page_size'>
): Promise<AutoFigureEditAdminStatsResponse> {
  const response = await apiClient.get<AutoFigureEditAdminStatsResponse>(
    `${API_PREFIX}/admin/autofigure-edit/stats`,
    {
      params: {
        user_id: params?.user_id,
        workspace_id: params?.workspace_id,
        status: params?.status,
        feedback_submitted: params?.feedback_submitted,
      },
    }
  );
  return response.data;
}

export async function getAutoFigureEditPricingConfig(): Promise<AutoFigureEditPricingConfig> {
  const response = await apiClient.get<AutoFigureEditPricingConfig>(
    `${API_PREFIX}/admin/autofigure-edit/pricing`
  )
  return response.data
}

export async function updateAutoFigureEditPricingConfig(
  input: AutoFigureEditPricingConfigUpdateInput
): Promise<AutoFigureEditPricingConfig> {
  const response = await apiClient.put<AutoFigureEditPricingConfig>(
    `${API_PREFIX}/admin/autofigure-edit/pricing`,
    input
  )
  return response.data
}

export async function getAutoFigureEditSessionRevisions(
  sessionId: string,
  params?: PaginationParams
): Promise<PaginatedResponse<AutoFigureEditAdminRevisionSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AutoFigureEditAdminRevisionListResponse>(
    `${API_PREFIX}/admin/autofigure-edit/sessions/${sessionId}/revisions`,
    {
      params: { skip, limit },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAutoFigureEditSessionRevision(
  sessionId: string,
  revisionId: string
): Promise<AutoFigureEditAdminRevisionDetail> {
  const response = await apiClient.get<AutoFigureEditAdminRevisionDetail>(
    `${API_PREFIX}/admin/autofigure-edit/sessions/${sessionId}/revisions/${revisionId}`
  );
  return response.data;
}

export async function exportAutoFigureEditSessionRevisions(sessionId: string): Promise<Blob> {
  const response = await apiClient.get(
    `${API_PREFIX}/admin/autofigure-edit/sessions/${sessionId}/revisions/export`,
    {
      responseType: 'blob',
    }
  );
  return response.data as Blob;
}

export async function getAutoFigureEditStylePresets(): Promise<AutoFigureEditStylePreset[]> {
  const response = await apiClient.get<AutoFigureEditStylePresetListResponse>(
    `${API_PREFIX}/admin/autofigure-edit/style-presets`
  )
  return response.data.items || []
}

export async function createAutoFigureEditStylePreset(
  input: AutoFigureEditStylePresetCreateInput,
  styleImageFile: File
): Promise<AutoFigureEditStylePreset> {
  const formData = new FormData()
  formData.append('code', input.code)
  formData.append('name_en', input.name_en)
  if (input.name_zh) formData.append('name_zh', input.name_zh)
  if (input.description_en) formData.append('description_en', input.description_en)
  if (input.description_zh) formData.append('description_zh', input.description_zh)
  if (input.warning_en) formData.append('warning_en', input.warning_en)
  if (input.warning_zh) formData.append('warning_zh', input.warning_zh)
  if (input.reference_asset_name?.trim()) {
    formData.append('reference_asset_name', input.reference_asset_name.trim())
  }
  if (input.aliases?.length) formData.append('aliases', input.aliases.join(','))
  if (input.badge_type) formData.append('badge_type', input.badge_type)
  if (input.badge_text_en) formData.append('badge_text_en', input.badge_text_en)
  if (input.badge_text_zh) formData.append('badge_text_zh', input.badge_text_zh)
  if (typeof input.sort_order === 'number') formData.append('sort_order', String(input.sort_order))
  if (typeof input.is_active === 'boolean') formData.append('is_active', String(input.is_active))
  if (typeof input.is_default === 'boolean') formData.append('is_default', String(input.is_default))
  formData.append('style_image', styleImageFile)

  const response = await apiClient.post<AutoFigureEditStylePreset>(
    `${API_PREFIX}/admin/autofigure-edit/style-presets`,
    formData,
    {
      headers: {
        'Content-Type': undefined,
      },
    }
  )
  return response.data
}

export async function updateAutoFigureEditStylePreset(
  presetId: string,
  input: AutoFigureEditStylePresetUpdateInput
): Promise<AutoFigureEditStylePreset> {
  const response = await apiClient.patch<AutoFigureEditStylePreset>(
    `${API_PREFIX}/admin/autofigure-edit/style-presets/${presetId}`,
    input
  )
  return response.data
}

export async function reorderAutoFigureEditStylePresets(
  items: Array<{ id: string; sort_order: number }>
): Promise<AutoFigureEditStylePreset[]> {
  const response = await apiClient.post<AutoFigureEditStylePresetListResponse>(
    `${API_PREFIX}/admin/autofigure-edit/style-presets/reorder`,
    { items }
  )
  return response.data.items || []
}

export async function deleteAutoFigureEditStylePreset(presetId: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/autofigure-edit/style-presets/${presetId}`)
}

export async function replaceAutoFigureEditStylePresetImage(
  presetId: string,
  styleImageFile: File
): Promise<AutoFigureEditStylePreset> {
  const formData = new FormData()
  formData.append('style_image', styleImageFile)
  const response = await apiClient.post<AutoFigureEditStylePreset>(
    `${API_PREFIX}/admin/autofigure-edit/style-presets/${presetId}/image`,
    formData,
    {
      headers: {
        'Content-Type': undefined,
      },
    }
  )
  return response.data
}

// MinerU Configuration
export async function getMineruConfig(): Promise<MineruConfigResponse> {
  const response = await apiClient.get<MineruConfigResponse>(`${API_PREFIX}/admin/settings/mineru`);
  return response.data;
}

export async function updateMineruConfig(input: MineruConfigUpdate): Promise<MineruConfigResponse> {
  const response = await apiClient.put<MineruConfigResponse>(`${API_PREFIX}/admin/settings/mineru`, input);
  return response.data;
}

// AI Providers
export async function getAIProviders(): Promise<AIProvider[]> {
  const response = await apiClient.get<{ items: AIProvider[] }>(`${API_PREFIX}/admin/ai-providers`, {
    params: { include_inactive: true },
  });
  return response.data.items || [];
}

export async function createAIProvider(input: CreateAIProviderInput): Promise<AIProvider> {
  const response = await apiClient.post<AIProvider>(`${API_PREFIX}/admin/ai-providers`, input);
  return response.data;
}

export async function updateAIProvider(name: string, input: UpdateAIProviderInput): Promise<AIProvider> {
  const response = await apiClient.put<AIProvider>(`${API_PREFIX}/admin/ai-providers/${name}`, input);
  return response.data;
}

export async function deleteAIProvider(name: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/ai-providers/${name}`);
}

// Users
export async function getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 10;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<{ items: User[]; total: number; skip: number; limit: number }>(
    `${API_PREFIX}/admin/users`,
    { params: { skip, limit } }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const response = await apiClient.put<User>(`${API_PREFIX}/admin/users/${id}`, input);
  return response.data;
}

export async function disableUser(id: string): Promise<void> {
  await apiClient.post(`${API_PREFIX}/admin/users/${id}/disable`);
}

export async function enableUser(id: string): Promise<void> {
  await apiClient.post(`${API_PREFIX}/admin/users/${id}/enable`);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/users/${id}`);
}

// User tokens (admin-only)
export interface AdminUserTokenResponse {
  api_token: string;
  token_id: string;
  created_at: string;
  last_used_at?: string | null;
  is_legacy_hashed?: boolean;
  message?: string | null;
}

export async function getUserToken(id: string): Promise<AdminUserTokenResponse> {
  const response = await apiClient.get<AdminUserTokenResponse>(`${API_PREFIX}/admin/users/${id}/token`);
  return response.data;
}

export async function rotateUserToken(id: string): Promise<AdminUserTokenResponse> {
  const response = await apiClient.post<AdminUserTokenResponse>(`${API_PREFIX}/admin/users/${id}/token/rotate`);
  return response.data;
}

// Invitations
export async function getInvitations(): Promise<Invitation[]> {
  const response = await apiClient.get<{ items: Invitation[]; total: number }>(`${API_PREFIX}/admin/invitations`, {
    params: { skip: 0, limit: 100 },
  });
  return response.data.items || [];
}

export async function createInvitation(input?: CreateInvitationInput): Promise<Invitation> {
  const response = await apiClient.post<Invitation>(`${API_PREFIX}/admin/invitations`, input || {});
  return response.data;
}

export async function deleteInvitation(code: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/invitations/${code}`);
}

// Audit Logs
export async function getAuditLogs(
  params?: PaginationParams & AuditLogFilter
): Promise<PaginatedResponse<AuditLog>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 20;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<{
    items: AuditLog[];
    total: number;
    skip: number;
    limit: number;
  }>(`${API_PREFIX}/admin/audit-logs`, {
    params: {
      skip,
      limit,
      admin_id: params?.admin_id || undefined,
      action: params?.action || undefined,
      resource_type: params?.resource_type || undefined,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// Server Logs (admin-only)
export async function getLogSources(): Promise<AdminLogSourcesResponse> {
  const response = await apiClient.get<AdminLogSourcesResponse>(`${API_PREFIX}/admin/log-sources`);
  return response.data;
}

// Lab admin
export async function getAdminLabOverview(): Promise<AdminLabOverview> {
  const response = await apiClient.get<AdminLabOverview>(`${API_PREFIX}/admin/labs/overview`);
  return response.data;
}

export async function getAdminLabAgents(params?: PaginationParams & {
  project_id?: string;
  status?: string;
  template_id?: string;
}): Promise<PaginatedResponse<AdminLabAgentSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminLabAgentListResponse>(`${API_PREFIX}/admin/labs/agents`, {
    params: {
      skip,
      limit,
      project_id: params?.project_id,
      status: params?.status,
      template_id: params?.template_id,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminLabQuests(params?: PaginationParams & {
  project_id?: string;
  status?: string;
}): Promise<PaginatedResponse<AdminLabQuestSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminLabQuestListResponse>(`${API_PREFIX}/admin/labs/quests`, {
    params: {
      skip,
      limit,
      project_id: params?.project_id,
      status: params?.status,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminLabQuestDetail(questId: string): Promise<AdminLabQuestDetailResponse> {
  const response = await apiClient.get<AdminLabQuestDetailResponse>(
    `${API_PREFIX}/admin/labs/quests/${questId}`
  );
  return response.data;
}

export async function getAdminLabQuestGraph(
  questId: string,
  params?: { view?: string; search?: string }
): Promise<LabQuestGraphResponse> {
  const response = await apiClient.get<LabQuestGraphResponse>(
    `${API_PREFIX}/admin/labs/quests/${questId}/graph`,
    { params }
  );
  return response.data;
}

export async function getAdminLabQuestEvents(
  questId: string,
  params?: { branch?: string; cursor?: string; limit?: number; includePayload?: boolean }
): Promise<LabQuestEventListResponse> {
  const response = await apiClient.get<LabQuestEventListResponse>(
    `${API_PREFIX}/admin/labs/quests/${questId}/events`,
    { params }
  );
  return response.data;
}

export async function controlAdminLabQuestPi(
  questId: string,
  payload: LabPiControlRequest
): Promise<LabPiControlResponse> {
  const response = await apiClient.post<LabPiControlResponse>(
    `${API_PREFIX}/admin/labs/quests/${questId}/pi/control`,
    payload
  );
  return response.data;
}

export async function getAdminAgentCreateQueue(params?: PaginationParams & {
  project_id?: string;
}): Promise<PaginatedResponse<AdminAgentCreateQueueItem>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminAgentCreateQueueResponse>(
    `${API_PREFIX}/admin/queues/agent-create`,
    {
      params: {
        skip,
        limit,
        project_id: params?.project_id,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function ackAdminAgentCreateQueue(
  payload: AdminAgentCreateQueueAckRequest
): Promise<AdminAgentCreateQueueAckResponse> {
  const response = await apiClient.post<AdminAgentCreateQueueAckResponse>(
    `${API_PREFIX}/admin/queues/agent-create/ack`,
    payload
  );
  return response.data;
}

export async function getAdminAgentSyncQueue(): Promise<AdminAgentSyncQueueResponse> {
  const response = await apiClient.get<AdminAgentSyncQueueResponse>(
    `${API_PREFIX}/admin/queues/agent-sync`
  );
  return response.data;
}

export async function retryAdminAgentSyncQueue(
  payload: AdminAgentSyncRetryRequest
): Promise<AdminAgentSyncRetryResponse> {
  const response = await apiClient.post<AdminAgentSyncRetryResponse>(
    `${API_PREFIX}/admin/queues/agent-sync/retry`,
    payload
  );
  return response.data;
}

export async function freezeAdminLabAgent(
  agentInstanceId: string,
  input?: AdminLabActionRequest
): Promise<AdminLabAgentActionResponse> {
  const response = await apiClient.post<AdminLabAgentActionResponse>(
    `${API_PREFIX}/admin/labs/agents/${agentInstanceId}/freeze`,
    input || {}
  );
  return response.data;
}

export async function unfreezeAdminLabAgent(
  agentInstanceId: string,
  input?: AdminLabActionRequest
): Promise<AdminLabAgentActionResponse> {
  const response = await apiClient.post<AdminLabAgentActionResponse>(
    `${API_PREFIX}/admin/labs/agents/${agentInstanceId}/unfreeze`,
    input || {}
  );
  return response.data;
}

export async function getAdminAgentTemplates(params?: PaginationParams & {
  q?: string;
  enabled?: boolean;
}): Promise<PaginatedResponse<AdminAgentTemplateSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminAgentTemplateListResponse>(
    `${API_PREFIX}/admin/labs/templates`,
    {
      params: {
        skip,
        limit,
        q: params?.q,
        enabled: typeof params?.enabled === 'boolean' ? params.enabled : undefined,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function updateAdminAgentTemplate(
  templateId: string,
  input: AdminAgentTemplateUpdateInput
): Promise<AdminAgentTemplateSummary> {
  const response = await apiClient.patch<AdminAgentTemplateSummary>(
    `${API_PREFIX}/admin/labs/templates/${templateId}`,
    input
  );
  return response.data;
}

export async function getLogTail(source: string, lines: number = 200): Promise<AdminLogTailResponse> {
  const response = await apiClient.get<AdminLogTailResponse>(`${API_PREFIX}/admin/logs/${encodeURIComponent(source)}`, {
    params: { lines },
  });
  return response.data;
}

export async function trackAdminPageView(input: {
  path: string;
  title?: string;
  referrer?: string;
}): Promise<void> {
  if (!input.path) return;
  await apiClient.post(`${API_PREFIX}/admin/page-views`, input);
}

// Broadcasts (admin-only)
export async function getAdminBroadcasts(params?: AdminBroadcastListParams): Promise<AdminBroadcastListResponse> {
  const response = await apiClient.get<AdminBroadcastListResponse>(`${API_PREFIX}/admin/broadcasts`, {
    params,
  });
  return response.data;
}

export async function getAdminBroadcast(broadcastId: string): Promise<AdminBroadcast> {
  const response = await apiClient.get<AdminBroadcast>(`${API_PREFIX}/admin/broadcasts/${broadcastId}`);
  return response.data;
}

export async function createAdminBroadcast(input: CreateBroadcastInput): Promise<AdminBroadcast> {
  const response = await apiClient.post<AdminBroadcast>(`${API_PREFIX}/admin/broadcasts`, input);
  return response.data;
}

export async function updateAdminBroadcast(
  broadcastId: string,
  input: UpdateBroadcastInput
): Promise<AdminBroadcast> {
  const response = await apiClient.patch<AdminBroadcast>(
    `${API_PREFIX}/admin/broadcasts/${broadcastId}`,
    input
  );
  return response.data;
}

export async function deleteAdminBroadcast(broadcastId: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/broadcasts/${broadcastId}`);
}

// Feedback (admin-only)
export async function getAdminFeedbacks(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  type?: string;
  priority?: string;
  user_id?: string;
  project_id?: string;
  q?: string;
}): Promise<AdminFeedbackListResponse> {
  const response = await apiClient.get<AdminFeedbackListResponse>(`${API_PREFIX}/admin/feedbacks`, {
    params,
  });
  return response.data;
}

export async function updateAdminFeedback(
  feedbackId: string,
  input: UpdateFeedbackInput
): Promise<AdminFeedback> {
  const response = await apiClient.patch<AdminFeedback>(`${API_PREFIX}/admin/feedbacks/${feedbackId}`, input);
  return response.data;
}

// Project Monitoring (admin-only)
export async function getAdminProjects(params?: PaginationParams & { q?: string; include_deleted?: boolean })
  : Promise<PaginatedResponse<AdminProjectSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 50;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminProjectListResponse>(`${API_PREFIX}/admin/projects`, {
    params: {
      skip,
      limit,
      q: params?.q,
      include_deleted: params?.include_deleted,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminProjectDetail(projectId: string): Promise<AdminProjectDetail> {
  const response = await apiClient.get<AdminProjectDetail>(`${API_PREFIX}/admin/projects/${projectId}`);
  return response.data;
}

export async function getAdminProjectAccessLogs(params?: PaginationParams & {
  project_id?: string;
  user_id?: string;
}): Promise<PaginatedResponse<AdminProjectAccessLog>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminProjectAccessLogListResponse>(
    `${API_PREFIX}/admin/project-access-logs`,
    {
      params: {
        skip,
        limit,
        project_id: params?.project_id,
        user_id: params?.user_id,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// File/Storage Monitoring
export async function getAdminFiles(params?: PaginationParams & {
  project_id?: string;
  file_type?: string;
  deleted?: boolean;
  q?: string;
  include_storage_key?: boolean;
}): Promise<PaginatedResponse<AdminFileSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminFileListResponse>(`${API_PREFIX}/admin/files`, {
    params: {
      skip,
      limit,
      project_id: params?.project_id,
      file_type: params?.file_type,
      deleted: params?.deleted,
      q: params?.q,
      include_storage_key: params?.include_storage_key,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminFileVersions(params?: PaginationParams & {
  file_id?: string;
  project_id?: string;
  include_storage_key?: boolean;
}): Promise<PaginatedResponse<AdminFileVersionSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminFileVersionListResponse>(
    `${API_PREFIX}/admin/files/versions`,
    {
      params: {
        skip,
        limit,
        file_id: params?.file_id,
        project_id: params?.project_id,
        include_storage_key: params?.include_storage_key,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminUploadTasks(params?: PaginationParams & {
  project_id?: string;
  status?: string;
}): Promise<PaginatedResponse<AdminUploadTaskSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminUploadTaskListResponse>(`${API_PREFIX}/admin/uploads`, {
    params: {
      skip,
      limit,
      project_id: params?.project_id,
      status: params?.status,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// CLI Monitoring
export async function getAdminCliSessions(params?: PaginationParams & {
  server_id?: string;
  project_id?: string;
  actor_user_id?: string;
  session_type?: string;
}): Promise<PaginatedResponse<AdminCliSessionSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminCliSessionListResponse>(`${API_PREFIX}/admin/cli/sessions`, {
    params: {
      skip,
      limit,
      server_id: params?.server_id,
      project_id: params?.project_id,
      actor_user_id: params?.actor_user_id,
      session_type: params?.session_type,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminCliLogObjects(params?: PaginationParams & {
  server_id?: string;
  project_id?: string;
  start_time?: string;
  end_time?: string;
  include_object_key?: boolean;
}): Promise<PaginatedResponse<AdminCliLogObjectSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminCliLogObjectListResponse>(`${API_PREFIX}/admin/cli/log-objects`, {
    params: {
      skip,
      limit,
      server_id: params?.server_id,
      project_id: params?.project_id,
      start_time: params?.start_time,
      end_time: params?.end_time,
      include_object_key: params?.include_object_key,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminCliMetrics(params?: PaginationParams & {
  server_id?: string;
  project_id?: string;
  start_time?: string;
  end_time?: string;
}): Promise<PaginatedResponse<AdminCliMetricSummary>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 200;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminCliMetricListResponse>(`${API_PREFIX}/admin/cli/metrics`, {
    params: {
      skip,
      limit,
      server_id: params?.server_id,
      project_id: params?.project_id,
      start_time: params?.start_time,
      end_time: params?.end_time,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// Plugin Monitoring
export async function getAdminBackendPlugins(): Promise<AdminPluginSummary[]> {
  const response = await apiClient.get<AdminPluginListResponse>(`${API_PREFIX}/admin/plugins/backend`);
  return response.data.items || [];
}

export async function getAdminPluginTools(): Promise<AdminPluginToolSummary[]> {
  const response = await apiClient.get<AdminPluginToolListResponse>(`${API_PREFIX}/admin/plugins/tools`);
  return response.data.items || [];
}

// AI Usage Monitoring
export async function getAdminAIUsage(params?: PaginationParams & {
  user_id?: string;
  project_id?: string;
  source?: string;
  provider?: string;
  model?: string;
  start_time?: string;
  end_time?: string;
}): Promise<PaginatedResponse<AdminAIUsageRecord>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminAIUsageListResponse>(`${API_PREFIX}/admin/ai-usage`, {
    params: {
      skip,
      limit,
      user_id: params?.user_id,
      project_id: params?.project_id,
      source: params?.source,
      provider: params?.provider,
      model: params?.model,
      start_time: params?.start_time,
      end_time: params?.end_time,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminAIUsageSummary(params?: PaginationParams): Promise<{
  totals: AdminAIUsageTotals;
  users: PaginatedResponse<AdminAIUsageUserTotal>;
}> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminAIUsageSummaryResponse>(`${API_PREFIX}/admin/ai-usage/summary`, {
    params: { skip, limit },
  });

  return {
    totals: response.data.totals,
    users: toPaginatedResponse({
      items: response.data.users || [],
      total: response.data.users_total || 0,
      page,
      pageSize,
    }),
  };
}

// System Health / Events
export async function getAdminSystemHealth(): Promise<AdminSystemHealthResponse> {
  const response = await apiClient.get<AdminSystemHealthResponse>(`${API_PREFIX}/admin/system/health`);
  return response.data;
}

export async function getAdminSystemEvents(params?: PaginationParams & {
  severity?: string;
  source?: string;
}): Promise<PaginatedResponse<AdminSystemEvent>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminSystemEventListResponse>(`${API_PREFIX}/admin/system/events`, {
    params: {
      skip,
      limit,
      severity: params?.severity,
      source: params?.source,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// Export Center
export async function createAdminExport(input: AdminExportCreateInput): Promise<AdminExportRecord> {
  const response = await apiClient.post<AdminExportRecord>(`${API_PREFIX}/admin/exports`, input);
  return response.data;
}

export async function getAdminExports(params?: PaginationParams & {
  status?: string;
  export_type?: string;
}): Promise<PaginatedResponse<AdminExportRecord>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminExportListResponse>(`${API_PREFIX}/admin/exports`, {
    params: {
      skip,
      limit,
      status: params?.status,
      export_type: params?.export_type,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminExport(exportId: string): Promise<AdminExportRecord> {
  const response = await apiClient.get<AdminExportRecord>(`${API_PREFIX}/admin/exports/${exportId}`);
  return response.data;
}

export function getAdminExportDownloadUrl(exportId: string): string {
  return `${API_PREFIX}/admin/exports/${exportId}/download`;
}

export async function getAdminExportAccessLogs(params: PaginationParams & { export_id: string })
  : Promise<PaginatedResponse<AdminExportAccessLog>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminExportAccessLogListResponse>(
    `${API_PREFIX}/admin/exports/${params.export_id}/access-logs`,
    {
      params: {
        skip,
        limit,
      },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

// Search & Saved Views
export async function adminSearch(query: string, scope?: string): Promise<AdminSearchResultItem[]> {
  const response = await apiClient.get<AdminSearchResponse>(`${API_PREFIX}/admin/search`, {
    params: { q: query, scope },
  });
  return response.data.items || [];
}

export async function getAdminSearchQueries(params?: PaginationParams & { scope?: string })
  : Promise<PaginatedResponse<AdminSearchQuery>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminSearchQueryListResponse>(
    `${API_PREFIX}/admin/search/queries`,
    {
      params: { skip, limit, scope: params?.scope },
    }
  );

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function getAdminSavedViews(params?: PaginationParams & { module?: string })
  : Promise<PaginatedResponse<AdminSavedView>> {
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 100;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const response = await apiClient.get<AdminSavedViewListResponse>(`${API_PREFIX}/admin/saved-views`, {
    params: {
      skip,
      limit,
      module: params?.module,
    },
  });

  return toPaginatedResponse({
    items: response.data.items || [],
    total: response.data.total || 0,
    page,
    pageSize,
  });
}

export async function createAdminSavedView(input: AdminSavedViewCreateInput): Promise<AdminSavedView> {
  const response = await apiClient.post<AdminSavedView>(`${API_PREFIX}/admin/saved-views`, input);
  return response.data;
}

export async function deleteAdminSavedView(viewId: string): Promise<void> {
  await apiClient.delete(`${API_PREFIX}/admin/saved-views/${viewId}`);
}
