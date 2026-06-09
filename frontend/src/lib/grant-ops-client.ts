/**
 * Grant Ops HTTP Client
 *
 * Typed client for calling Next.js API routes from the browser.
 * This is the sole transport for the web-only application.
 */

import type {
  ApprovalRecord,
  Award,
  AwardComplianceItem,
  AwardExpense,
  AwardReportDeadline,
  BackupFreshnessStatus,
  CrawlRun,
  DocumentMetadata,
  DraftArtifact,
  DuplicateCandidate,
  FollowUp,
  Grant,
  GrantDetailResponse,
  GrantDetailUpdate,
  GrantStatus,
  SubmissionManifest,
  SubmissionManifestItem,
  Notification,
  JobQueueItem,
  OrganizationProfile,
  Source,
  SubmissionMethod,
  SubmissionRecord,
  Task,
  TaskStatus,
  ThemesData,
} from '../../../shared/types';

// Base fetch wrapper with error handling
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body instanceof FormData) {
    headers.delete('Content-Type');
  } else if (options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody: { error?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: 'Unknown error' };
    }
    throw new Error(errorBody.error || `API error: ${response.status}`);
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error(
      `Malformed response body: ${err instanceof Error ? err.message : 'JSON parse error'}`,
    );
  }
}

async function apiFetchOptional<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  const headers = new Headers(options?.headers);
  if (options?.body instanceof FormData) {
    headers.delete('Content-Type');
  } else if (options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let errorBody: { error?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: 'Unknown error' };
    }
    throw new Error(errorBody.error || `API error: ${response.status}`);
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error(
      `Malformed response body: ${err instanceof Error ? err.message : 'JSON parse error'}`,
    );
  }
}

// ============ Sources API ============

interface AddSourceRequest {
  name: string;
  url: string;
  type?: 'website' | 'database' | 'api';
  reviewStatus?: 'pending-review' | 'approved' | 'rejected';
}

const sourcesApi = {
  getAll: () => apiFetch<Source[]>('/api/sources'),

  add: (source: AddSourceRequest) =>
    apiFetch<{ success: boolean; source: Source }>('/api/sources', {
      method: 'POST',
      body: JSON.stringify(source),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/sources?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

// ============ Research API ============

interface ResearchResponse {
  latestRun: CrawlRun;
  grantsFound: number;
  grantsMatched: number;
  sourcesCrawled: number;
}

interface CrawlRunsResponse {
  latestRun: CrawlRun | null;
  allRuns: CrawlRun[];
}

const researchApi = {
  /**
   * Trigger a new research/crawl run
   */
  trigger: () => apiFetch<ResearchResponse>('/api/research', { method: 'POST' }),

  /**
   * Get crawl run status
   */
  getRuns: () => apiFetch<CrawlRunsResponse>('/api/research'),
};

// ============ Grants API ============

interface GrantOverrideRequest {
  field:
    | 'status'
    | 'statusLabel'
    | 'fit'
    | 'award'
    | 'deadline'
    | 'title'
    | 'funder'
    | 'funderShort'
    | 'category'
    | 'fitRubric'
    | `task.${string}.status`;
  newValue: unknown;
  rationale: string;
  overrideType: 'score' | 'category' | 'task' | 'status' | 'rubric';
}

interface PaginatedGrantsResponse {
  items: Grant[];
  page: number;
  pageSize: number;
  total: number;
}

export const grantsApi = {
  getAll: (params?: { page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    const url = qs ? `/api/grants?${qs}` : '/api/grants';
    return apiFetch<PaginatedGrantsResponse>(url);
  },

  getById: (grantId: string) =>
    apiFetch<GrantDetailResponse>(`/api/grants/${encodeURIComponent(grantId)}`),

  update: (grantId: string, updates: GrantDetailUpdate) =>
    apiFetch<GrantDetailResponse>(`/api/grants/${encodeURIComponent(grantId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  updateStatus: (grantId: string, status: GrantStatus, statusLabel: string) =>
    apiFetch<{ success: boolean }>(`/api/grants/${encodeURIComponent(grantId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, statusLabel }),
    }),

  archive: (grantId: string, statusLabel: string) =>
    apiFetch<{ success: boolean }>(`/api/grants/${encodeURIComponent(grantId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived', statusLabel }),
    }),

  delete: (grantId: string) =>
    apiFetch<{ success: boolean; id: string }>(`/api/grants/${encodeURIComponent(grantId)}`, {
      method: 'DELETE',
    }),

  override: (grantId: string, override: GrantOverrideRequest) =>
    apiFetch<Grant>(`/api/grants/${encodeURIComponent(grantId)}/override`, {
      method: 'POST',
      body: JSON.stringify(override),
    }),
};

// ============ Draft API ============

interface DraftCreateRequest {
  revisionNotes?: string;
}

interface QueuedJobResponse {
  queued: true;
  job: JobQueueItem;
}

const draftApi = {
  get: (grantId: string) =>
    apiFetch<DraftArtifact[]>(`/api/grants/${encodeURIComponent(grantId)}/draft`),

  create: (grantId: string, request: DraftCreateRequest) =>
    apiFetch<DraftArtifact | QueuedJobResponse>(
      `/api/grants/${encodeURIComponent(grantId)}/draft`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    ),
};

// ============ Approval API ============

interface ApprovalCreateRequest {
  approvedBy?: string;
  lockedUntil?: string;
}

const approvalApi = {
  get: (grantId: string) =>
    apiFetch<ApprovalRecord | null>(`/api/grants/${encodeURIComponent(grantId)}/approval`),

  create: (grantId: string, request: ApprovalCreateRequest) =>
    apiFetch<ApprovalRecord>(`/api/grants/${encodeURIComponent(grantId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

// ============ Submit API ============

interface SubmitCreateRequest {
  method: SubmissionMethod;
  notes?: string;
}

const submitApi = {
  get: (grantId: string) =>
    apiFetch<SubmissionRecord | null>(`/api/grants/${encodeURIComponent(grantId)}/submit`),

  create: (grantId: string, request: SubmitCreateRequest) =>
    apiFetch<SubmissionRecord>(`/api/grants/${encodeURIComponent(grantId)}/submit`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

// ============ Submission Manifest API ============

interface SubmissionManifestCreateRequest {
  instructions?: string;
  portalUrl?: string;
  fileConstraints?: string;
  dueDate?: string;
  materialRefs?: SubmissionManifestItem[];
  notes?: string;
}

const manifestApi = {
  get: (grantId: string) =>
    apiFetchOptional<SubmissionManifest>(`/api/grants/${encodeURIComponent(grantId)}/manifest`),

  create: (grantId: string, request: SubmissionManifestCreateRequest) =>
    apiFetch<SubmissionManifest>(`/api/grants/${encodeURIComponent(grantId)}/manifest`, {
      method: 'POST',
      body: JSON.stringify({ materialRefs: [], ...request }),
    }),
};

// ============ Jobs API ============

const jobsApi = {
  get: (jobId: string) => apiFetch<JobQueueItem>(`/api/jobs/${encodeURIComponent(jobId)}`),

  retry: (jobId: string) =>
    apiFetch<{ success: boolean; newJobId: string }>(
      `/api/jobs/${encodeURIComponent(jobId)}/retry`,
      {
        method: 'POST',
      },
    ),
};

// ============ Follow-ups API ============

export const followUpsApi = {
  getAll: () => apiFetch<FollowUp[]>('/api/follow-ups'),

  getFiltered: (params: { grantId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.grantId) searchParams.set('grantId', params.grantId);
    if (params.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return apiFetch<FollowUp[]>(`/api/follow-ups${qs ? `?${qs}` : ''}`);
  },

  create: (followUp: Omit<FollowUp, 'id' | 'createdAt'>) =>
    apiFetch<FollowUp>('/api/follow-ups', {
      method: 'POST',
      body: JSON.stringify(followUp),
    }),

  update: (followUp: FollowUp) =>
    apiFetch<{ success: boolean }>('/api/follow-ups', {
      method: 'PATCH',
      body: JSON.stringify(followUp),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/follow-ups?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

// ============ Profile API ============

const profileApi = {
  get: () => apiFetch<OrganizationProfile>('/api/profile'),
};

// ============ Revisions API ============

const revisionsApi = {
  create: (grantId: string, notes: string, requestedBy?: string) =>
    apiFetch(`/api/grants/${encodeURIComponent(grantId)}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ notes, requestedBy: requestedBy || 'human' }),
    }),
};

// ============ Notifications API ============

export const notificationsApi = {
  getAll: () => apiFetch<Notification[]>('/api/notifications'),

  update: (notifications: Notification[]) =>
    apiFetch<{ success: boolean }>('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notifications }),
    }),

  create: (notification: Omit<Notification, 'id'>) =>
    apiFetch<Notification>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notification),
    }),
};

// ============ Tasks API ============

interface TaskOverrideRequest {
  newValue: TaskStatus;
  rationale: string;
  overrideType: 'task';
}

export const tasksApi = {
  getAll: () => apiFetch<Task[]>('/api/tasks'),

  update: (tasks: Task[]) =>
    apiFetch<{ success: boolean }>('/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ tasks }),
    }),

  create: (task: Omit<Task, 'id'>) =>
    apiFetch<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  override: (taskId: string, request: TaskOverrideRequest) =>
    apiFetch<Task>(`/api/tasks/${encodeURIComponent(taskId)}/override`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

// ============ Documents API ============

const documentsApi = {
  getAll: () => apiFetch<DocumentMetadata[]>('/api/documents'),

  create: (
    file: File,
    metadata: Partial<
      Omit<
        DocumentMetadata,
        | 'id'
        | 'storagePath'
        | 'extractedText'
        | 'contentSnippet'
        | 'extractionError'
        | 'extractionStatus'
      >
    > = {},
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.name) formData.append('name', metadata.name);
    if (metadata.type) formData.append('type', metadata.type);
    if (metadata.lastUsed) formData.append('lastUsed', metadata.lastUsed);
    if (metadata.version) formData.append('version', metadata.version);
    if (typeof metadata.audited === 'boolean') formData.append('audited', String(metadata.audited));
    if (metadata.uploadedAt) formData.append('uploadedAt', metadata.uploadedAt);
    return apiFetch<DocumentMetadata>('/api/documents', {
      method: 'POST',
      body: formData,
    });
  },

  update: (id: string, updates: Partial<DocumentMetadata>) =>
    apiFetch<{ success: boolean }>('/api/documents', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...updates }),
    }),
};

// ============ Duplicates API ============

const duplicatesApi = {
  getAll: () => apiFetch<DuplicateCandidate[]>(`/api/duplicates`),

  getById: (id: string) =>
    apiFetchOptional<DuplicateCandidate>(`/api/duplicates/${encodeURIComponent(id)}`),

  resolve: (id: string, action: 'merge' | 'keep-separate' | 'defer') =>
    apiFetch<DuplicateCandidate>(`/api/duplicates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
};

// ============ Awards API ============

interface AwardsListResponse {
  awards: Award[];
}

interface SpenddownAlertsResponse {
  alerts: { awardId: string; type: 'under' | 'over'; category: string }[];
}

interface CalendarEventsResponse {
  events: unknown[];
}

interface BudgetVsActualResponse {
  rows: {
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePct: number;
  }[];
}

interface ExpensesResponse {
  expenses: AwardExpense[];
}

interface ReportsResponse {
  reports: AwardReportDeadline[];
}

interface ComplianceResponse {
  compliance: AwardComplianceItem[];
}

interface CreateAwardRequest {
  grantId: string;
  funder: string;
  title: string;
  amount?: number;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'terminated' | 'pending';
  awardLetterPath?: string;
  notes?: string;
}

interface CreateExpenseRequest {
  awardId: string;
  categoryId?: string;
  description?: string;
  amount?: number;
  date?: string;
  isPlanned?: number;
  receiptPath?: string;
}

interface CreateExpenseForAwardRequest {
  categoryId?: string;
  description?: string;
  amount?: number;
  date?: string;
  isPlanned?: number;
  receiptPath?: string;
}

interface CreateReportRequest {
  reportType?: string;
  dueDate?: string;
  status?: 'pending' | 'submitted' | 'overdue';
  submittedAt?: string;
  submittedBy?: string;
  notes?: string;
}

interface CreateComplianceRequest {
  requirement?: string;
  dueDate?: string;
  status?: 'pending' | 'completed' | 'overdue' | 'waived';
  completedAt?: string;
  notes?: string;
}

const awardsApi = {
  getAll: () => apiFetch<AwardsListResponse>('/api/awards'),

  create: (award: CreateAwardRequest) =>
    apiFetch<{ award: Award }>('/api/awards', {
      method: 'POST',
      body: JSON.stringify(award),
    }),

  getSpenddownAlerts: () => apiFetch<SpenddownAlertsResponse>('/api/awards/spenddown-alerts'),

  getCalendar: () => apiFetch<CalendarEventsResponse>('/api/awards/calendar'),

  getExpenses: (awardId: string) =>
    apiFetch<ExpensesResponse>(`/api/awards/expenses?awardId=${encodeURIComponent(awardId)}`),

  createExpense: (expense: CreateExpenseRequest) =>
    apiFetch<{ expense: AwardExpense }>('/api/awards/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    }),

  getExpensesByAward: (awardId: string) =>
    apiFetch<ExpensesResponse>(`/api/awards/${encodeURIComponent(awardId)}/expenses`),

  createExpenseForAward: (awardId: string, expense: CreateExpenseForAwardRequest) =>
    apiFetch<{ expense: AwardExpense }>(`/api/awards/${encodeURIComponent(awardId)}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    }),

  getReports: (awardId: string) =>
    apiFetch<ReportsResponse>(`/api/awards/${encodeURIComponent(awardId)}/reports`),

  createReport: (awardId: string, report: CreateReportRequest) =>
    apiFetch<{ report: AwardReportDeadline }>(
      `/api/awards/${encodeURIComponent(awardId)}/reports`,
      {
        method: 'POST',
        body: JSON.stringify(report),
      },
    ),

  getBudgetVsActual: (awardId: string) =>
    apiFetch<BudgetVsActualResponse>(`/api/awards/${encodeURIComponent(awardId)}/budget-vs-actual`),

  getCompliance: (awardId: string) =>
    apiFetch<ComplianceResponse>(`/api/awards/${encodeURIComponent(awardId)}/compliance`),

  createCompliance: (awardId: string, item: CreateComplianceRequest) =>
    apiFetch<{ compliance: AwardComplianceItem }>(
      `/api/awards/${encodeURIComponent(awardId)}/compliance`,
      {
        method: 'PUT',
        body: JSON.stringify(item),
      },
    ),
};

// ============ Settings API ============

interface SettingsBody {
  operatorName?: string;
  agentSettings?: {
    autoDraftThreshold?: number;
    voiceAndTone?: string;
    maxConcurrentJobs?: number;
  };
  crawlSettings?: {
    intervalHours?: number;
    maxConcurrentCrawls?: number;
    requestDelayMs?: number;
    respectRobotsTxt?: boolean;
    userAgent?: string;
  };
  notificationSettings?: {
    notifyEmail?: string;
    notifyOnMatchAbove?: number;
    notifyOnDeadlineDays?: number;
  };
  backupSchedule?: {
    intervalHours?: number;
    maxBackups?: number;
    enabled?: boolean;
  };
  customFields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'select';
    options?: string[];
    visible?: boolean;
  }>;
}

const settingsApi = {
  get: () => apiFetch<Record<string, string>>('/api/settings'),

  update: (settings: SettingsBody) =>
    apiFetch<Record<string, string>>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// ============ Backup API ============

interface BackupSnapshot {
  version: string;
  createdAt: string;
  [key: string]: unknown;
}

const backupApi = {
  exportBackup: () => apiFetch<BackupSnapshot>('/api/backup'),

  getFreshness: () => apiFetch<BackupFreshnessStatus>('/api/backup/freshness'),

  restore: (backupData: object) =>
    apiFetch<{ success: boolean }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(backupData),
    }),
};

// ============ Themes API ============

const themesApi = {
  get: () => apiFetch<ThemesData>('/api/themes'),
  update: (data: Partial<ThemesData>) =>
    apiFetch<ThemesData>('/api/themes', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  rescore: () =>
    apiFetch<{ success: boolean; rescored: number }>('/api/themes/rescore', {
      method: 'POST',
    }),
};

// ============ Grant Ops Client ============

/**
 * Creates the Grant Ops HTTP client.
 * This is the sole transport for the web-only application.
 */
function createGrantOpsClient() {
  return {
    sources: sourcesApi,
    research: researchApi,
    grants: grantsApi,
    drafts: draftApi,
    approvals: approvalApi,
    submit: submitApi,
    manifest: manifestApi,
    jobs: jobsApi,
    followUps: followUpsApi,
    profile: profileApi,
    revisions: revisionsApi,
    notifications: notificationsApi,
    tasks: tasksApi,
    documents: documentsApi,
    duplicates: duplicatesApi,
    backup: backupApi,
    themes: themesApi,
    awards: awardsApi,
    settings: settingsApi,
  };
}

type _GrantOpsClient = ReturnType<typeof createGrantOpsClient>;

// Re-export for convenience
export const client = createGrantOpsClient();
