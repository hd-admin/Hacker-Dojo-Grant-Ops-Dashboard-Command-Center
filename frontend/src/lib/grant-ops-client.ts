/**
 * Grant Ops HTTP Client
 *
 * Typed client for calling Next.js API routes from the browser.
 * Used when running in browser/non-Electron context (e.g., standalone dev server).
 * In Electron context, the renderer uses window.electronAPI IPC bridge instead.
 */

import type {
  Source,
  Grant,
  CrawlRun,
  FollowUp,
  DraftArtifact,
  ApprovalRecord,
  SubmissionRecord,
  OrganizationProfile,
  OpencodeSettings,
} from '../../../shared/types';

// Base fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ============ Sources API ============

export interface AddSourceRequest {
  name: string;
  url: string;
  type?: 'website' | 'database' | 'api';
}

export const sourcesApi = {
  getAll: () => apiFetch<Source[]>('/api/sources'),

  add: (source: AddSourceRequest) =>
    apiFetch<Source>('/api/sources', {
      method: 'POST',
      body: JSON.stringify(source),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/sources?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

// ============ Research API ============

export interface ResearchResponse {
  latestRun: CrawlRun;
  grantsFound: number;
  grantsMatched: number;
  sourcesCrawled: number;
}

export interface CrawlRunsResponse {
  latestRun: CrawlRun | null;
  allRuns: CrawlRun[];
}

export const researchApi = {
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

export const grantsApi = {
  getAll: () => apiFetch<Grant[]>('/api/grants'),

  getById: (grantId: string) =>
    apiFetch<Grant>(`/api/grants/${encodeURIComponent(grantId)}`),

  update: (grantId: string, updates: Partial<Grant>) =>
    apiFetch<Grant>(`/api/grants/${encodeURIComponent(grantId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
};

// ============ Draft API ============

export const draftApi = {
  get: (grantId: string) =>
    apiFetch<DraftArtifact[]>(`/api/grants/${encodeURIComponent(grantId)}/draft`),

  create: (grantId: string, artifact: Omit<DraftArtifact, 'id'>) =>
    apiFetch<DraftArtifact>(`/api/grants/${encodeURIComponent(grantId)}/draft`, {
      method: 'POST',
      body: JSON.stringify(artifact),
    }),
};

// ============ Approval API ============

export const approvalApi = {
  get: (grantId: string) =>
    apiFetch<ApprovalRecord | null>(
      `/api/grants/${encodeURIComponent(grantId)}/approval`,
    ),

  create: (grantId: string, record: Omit<ApprovalRecord, 'id'>) =>
    apiFetch<ApprovalRecord>(`/api/grants/${encodeURIComponent(grantId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(record),
    }),
};

// ============ Submit API ============

export const submitApi = {
  get: (grantId: string) =>
    apiFetch<SubmissionRecord | null>(
      `/api/grants/${encodeURIComponent(grantId)}/submit`,
    ),

  create: (
    grantId: string,
    record: Omit<SubmissionRecord, 'id' | 'followUpsCreated'>,
  ) =>
    apiFetch<SubmissionRecord>(`/api/grants/${encodeURIComponent(grantId)}/submit`, {
      method: 'POST',
      body: JSON.stringify(record),
    }),
};

// ============ Follow-ups API ============

export const followUpsApi = {
  getAll: () => apiFetch<FollowUp[]>('/api/follow-ups'),

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
};

// ============ Profile API ============

export const profileApi = {
  get: () => apiFetch<OrganizationProfile>('/api/profile'),

  update: (profile: OrganizationProfile) =>
    apiFetch<OrganizationProfile>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
};

// ============ Revisions API ============

export const revisionsApi = {
  create: (grantId: string, notes: string, requestedBy?: string) =>
    apiFetch(`/api/grants/${encodeURIComponent(grantId)}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ notes, requestedBy: requestedBy || 'human' }),
    }),
};

// ============ Opencode Settings API ============

export interface OpencodeSettingsRequest {
  binaryPath: string;
  workingDirectory: string;
  timeoutMs: number;
  profile?: string;
}

export const opencodeSettingsApi = {
  get: () => apiFetch<OpencodeSettings>('/api/opencode-settings'),

  update: (settings: OpencodeSettingsRequest) =>
    apiFetch<{ success: boolean }>('/api/opencode-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// ============ Type Guards ============

export function isElectronAPIavailable(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

/**
 * Determines whether to use the Electron IPC bridge or the HTTP client.
 * In Electron context, use window.electronAPI; otherwise use the HTTP client.
 *
 * This client is primarily for:
 * - Browser-based development without Electron
 * - E2E tests running in Playwright
 * - Any scenario where the Next.js server is accessible via HTTP
 */
export function createGrantOpsClient() {
  if (isElectronAPIavailable()) {
    // In Electron, use IPC bridge - return null to indicate IPC should be used
    return null;
  }
  // In browser/standalone mode, return the HTTP API client
  return {
    sources: sourcesApi,
    research: researchApi,
    grants: grantsApi,
    drafts: draftApi,
    approvals: approvalApi,
    submit: submitApi,
    followUps: followUpsApi,
    profile: profileApi,
    opencodeSettings: opencodeSettingsApi,
    revisions: revisionsApi,
  };
}

export type GrantOpsClient = ReturnType<typeof createGrantOpsClient>;
