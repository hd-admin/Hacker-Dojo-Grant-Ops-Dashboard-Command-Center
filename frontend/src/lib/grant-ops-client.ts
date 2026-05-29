/**
 * Grant Ops HTTP Client
 *
 * Typed client for calling Next.js API routes from the browser.
 * This is the sole transport for the web-only application.
 */

import type {
	ApprovalRecord,
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
	OpencodeSettings,
	OrganizationProfile,
	Source,
	SubmissionMethod,
	SubmissionRecord,
	Task,
	TaskStatus,
} from "../../../shared/types";

// Base fetch wrapper with error handling
async function apiFetch<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<T> {
	const headers = new Headers(options?.headers);
	if (options?.body instanceof FormData) {
		headers.delete("Content-Type");
	} else if (options?.body !== undefined && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(endpoint, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `API error: ${response.status}`);
	}

	return response.json();
}

async function apiFetchOptional<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<T | null> {
	const headers = new Headers(options?.headers);
	if (options?.body instanceof FormData) {
		headers.delete("Content-Type");
	} else if (options?.body !== undefined && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(endpoint, {
		...options,
		headers,
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `API error: ${response.status}`);
	}

	return response.json();
}

// ============ Sources API ============

export interface AddSourceRequest {
	name: string;
	url: string;
	type?: "website" | "database" | "api";
	reviewStatus?: "pending-review" | "approved" | "rejected";
}

export const sourcesApi = {
	getAll: () => apiFetch<Source[]>("/api/sources"),

	add: (source: AddSourceRequest) =>
		apiFetch<{ success: boolean; source: Source }>("/api/sources", {
			method: "POST",
			body: JSON.stringify(source),
		}),

	remove: (id: string) =>
		apiFetch<{ success: boolean }>(
			`/api/sources?id=${encodeURIComponent(id)}`,
			{
				method: "DELETE",
			},
		),
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
	trigger: () =>
		apiFetch<ResearchResponse>("/api/research", { method: "POST" }),

	/**
	 * Get crawl run status
	 */
	getRuns: () => apiFetch<CrawlRunsResponse>("/api/research"),
};

// ============ Grants API ============

export interface GrantOverrideRequest {
  field: 'status' | 'statusLabel' | 'fit' | 'award' | 'deadline' | 'title' | 'funder' | 'funderShort' | 'category' | `task.${string}.status`;
  newValue: unknown;
  rationale: string;
  overrideType: 'score' | 'category' | 'task' | 'status';
}

export const grantsApi = {
	getAll: () => apiFetch<Grant[]>("/api/grants"),

	getById: (grantId: string) =>
		apiFetch<GrantDetailResponse>(`/api/grants/${encodeURIComponent(grantId)}`),

	update: (grantId: string, updates: GrantDetailUpdate) =>
		apiFetch<GrantDetailResponse>(
			`/api/grants/${encodeURIComponent(grantId)}`,
			{
				method: "PATCH",
				body: JSON.stringify(updates),
			},
		),

	updateStatus: (grantId: string, status: GrantStatus, statusLabel: string) =>
		apiFetch<{ success: boolean }>(
			`/api/grants/${encodeURIComponent(grantId)}/status`,
			{
				method: "PATCH",
				body: JSON.stringify({ status, statusLabel }),
			},
		),

	override: (grantId: string, override: GrantOverrideRequest) =>
		apiFetch<Grant>(
			`/api/grants/${encodeURIComponent(grantId)}/override`,
			{
				method: "POST",
				body: JSON.stringify(override),
			},
		),
};

// ============ Draft API ============

export interface DraftCreateRequest {
	revisionNotes?: string;
}

export interface QueuedJobResponse {
	queued: true;
	job: JobQueueItem;
}

export const draftApi = {
	get: (grantId: string) =>
		apiFetch<DraftArtifact[]>(
			`/api/grants/${encodeURIComponent(grantId)}/draft`,
		),

	create: (grantId: string, request: DraftCreateRequest) =>
		apiFetch<DraftArtifact | QueuedJobResponse>(
			`/api/grants/${encodeURIComponent(grantId)}/draft`,
			{
				method: "POST",
				body: JSON.stringify(request),
			},
		),
};

// ============ Approval API ============

export interface ApprovalCreateRequest {
	approvedBy?: string;
	lockedUntil?: string;
}

export const approvalApi = {
	get: (grantId: string) =>
		apiFetch<ApprovalRecord | null>(
			`/api/grants/${encodeURIComponent(grantId)}/approval`,
		),

	create: (grantId: string, request: ApprovalCreateRequest) =>
		apiFetch<ApprovalRecord>(
			`/api/grants/${encodeURIComponent(grantId)}/approval`,
			{
				method: "POST",
				body: JSON.stringify(request),
			},
		),
};

// ============ Submit API ============

export interface SubmitCreateRequest {
	method: SubmissionMethod;
	notes?: string;
}

export const submitApi = {
	get: (grantId: string) =>
		apiFetch<SubmissionRecord | null>(
			`/api/grants/${encodeURIComponent(grantId)}/submit`,
		),

	create: (grantId: string, request: SubmitCreateRequest) =>
		apiFetch<SubmissionRecord>(
			`/api/grants/${encodeURIComponent(grantId)}/submit`,
			{
				method: "POST",
				body: JSON.stringify(request),
			},
		),
};

// ============ Submission Manifest API ============

export interface SubmissionManifestCreateRequest {
	instructions?: string;
	portalUrl?: string;
	fileConstraints?: string;
	dueDate?: string;
	materialRefs?: SubmissionManifestItem[];
	notes?: string;
}

export const manifestApi = {
	get: (grantId: string) =>
		apiFetchOptional<SubmissionManifest>(
			`/api/grants/${encodeURIComponent(grantId)}/manifest`,
		),

	create: (grantId: string, request: SubmissionManifestCreateRequest) =>
		apiFetch<SubmissionManifest>(
			`/api/grants/${encodeURIComponent(grantId)}/manifest`,
			{
				method: "POST",
				body: JSON.stringify({ materialRefs: [], ...request }),
			},
		),
};

// ============ Jobs API ============

export const jobsApi = {
	get: (jobId: string) => apiFetch<JobQueueItem>(`/api/jobs/${encodeURIComponent(jobId)}`),

	retry: (jobId: string) =>
		apiFetch<{ success: boolean; newJobId: string }>(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
			method: "POST",
		}),
};

// ============ Follow-ups API ============

export const followUpsApi = {
	getAll: () => apiFetch<FollowUp[]>("/api/follow-ups"),

	getFiltered: (params: { grantId?: string; status?: string }) => {
		const searchParams = new URLSearchParams();
		if (params.grantId) searchParams.set('grantId', params.grantId);
		if (params.status) searchParams.set('status', params.status);
		const qs = searchParams.toString();
		return apiFetch<FollowUp[]>(`/api/follow-ups${qs ? `?${qs}` : ''}`);
	},

	create: (followUp: Omit<FollowUp, "id" | "createdAt">) =>
		apiFetch<FollowUp>("/api/follow-ups", {
			method: "POST",
			body: JSON.stringify(followUp),
		}),

	update: (followUp: FollowUp) =>
		apiFetch<{ success: boolean }>("/api/follow-ups", {
			method: "PATCH",
			body: JSON.stringify(followUp),
		}),

	delete: (id: string) =>
		apiFetch<{ success: boolean }>(
			`/api/follow-ups?id=${encodeURIComponent(id)}`,
			{ method: "DELETE" },
		),
};

// ============ Profile API ============

export const profileApi = {
	get: () => apiFetch<OrganizationProfile>("/api/profile"),

	update: (profile: OrganizationProfile) =>
		apiFetch<OrganizationProfile>("/api/profile", {
			method: "PUT",
			body: JSON.stringify(profile),
		}),
};

// ============ Revisions API ============

export const revisionsApi = {
	create: (grantId: string, notes: string, requestedBy?: string) =>
		apiFetch(`/api/grants/${encodeURIComponent(grantId)}/revisions`, {
			method: "POST",
			body: JSON.stringify({ notes, requestedBy: requestedBy || "human" }),
		}),
};

// ============ Opencode Settings API ============

export interface OpencodeSettingsRequest {
	binaryPath: string;
	workingDirectory: string;
	timeoutMs: number;
	profile?: string;
	isConfigured?: boolean;
}

export const opencodeSettingsApi = {
	get: () => apiFetch<OpencodeSettings>("/api/opencode-settings"),

	update: (settings: OpencodeSettingsRequest) =>
		apiFetch<{ success: boolean }>("/api/opencode-settings", {
			method: "PUT",
			body: JSON.stringify(settings),
		}),
};

// ============ Notifications API ============

export const notificationsApi = {
	getAll: () => apiFetch<Notification[]>("/api/notifications"),

	update: (notifications: Notification[]) =>
		apiFetch<{ success: boolean }>("/api/notifications", {
			method: "PATCH",
			body: JSON.stringify({ notifications }),
		}),

	create: (notification: Omit<Notification, "id">) =>
		apiFetch<Notification>("/api/notifications", {
			method: "POST",
			body: JSON.stringify(notification),
		}),
};

// ============ Tasks API ============

export interface TaskOverrideRequest {
	newValue: TaskStatus;
	rationale: string;
	overrideType: 'task';
}

export const tasksApi = {
	getAll: () => apiFetch<Task[]>("/api/tasks"),

	update: (tasks: Task[]) =>
		apiFetch<{ success: boolean }>("/api/tasks", {
			method: "PATCH",
			body: JSON.stringify({ tasks }),
		}),

	create: (task: Omit<Task, "id">) =>
		apiFetch<Task>("/api/tasks", {
			method: "POST",
			body: JSON.stringify(task),
		}),

	override: (taskId: string, request: TaskOverrideRequest) =>
		apiFetch<Task>(`/api/tasks/${encodeURIComponent(taskId)}/override`, {
			method: "POST",
			body: JSON.stringify(request),
		}),
};

// ============ Documents API ============

export const documentsApi = {
	getAll: () => apiFetch<DocumentMetadata[]>("/api/documents"),

	create: (
		file: File,
		metadata: Partial<
			Omit<
				DocumentMetadata,
				| "id"
				| "storagePath"
				| "extractedText"
				| "contentSnippet"
				| "extractionError"
				| "extractionStatus"
			>
		> = {},
	) => {
		const formData = new FormData();
		formData.append("file", file);
		if (metadata.name) formData.append("name", metadata.name);
		if (metadata.type) formData.append("type", metadata.type);
		if (metadata.lastUsed) formData.append("lastUsed", metadata.lastUsed);
		if (metadata.version) formData.append("version", metadata.version);
		if (typeof metadata.audited === "boolean")
			formData.append("audited", String(metadata.audited));
		if (metadata.uploadedAt) formData.append("uploadedAt", metadata.uploadedAt);
		return apiFetch<DocumentMetadata>("/api/documents", {
			method: "POST",
			body: formData,
		});
	},

	update: (id: string, updates: Partial<DocumentMetadata>) =>
		apiFetch<{ success: boolean }>("/api/documents", {
			method: "PATCH",
			body: JSON.stringify({ id, ...updates }),
		}),
};

// ============ Duplicates API ============

export const duplicatesApi = {
	getAll: () => apiFetch<DuplicateCandidate[]>(`/api/duplicates`),

	getById: (id: string) =>
		apiFetchOptional<DuplicateCandidate>(
			`/api/duplicates/${encodeURIComponent(id)}`,
		),

	resolve: (id: string, action: 'merge' | 'keep-separate' | 'defer') =>
		apiFetch<DuplicateCandidate>(
			`/api/duplicates/${encodeURIComponent(id)}`,
			{
				method: 'PATCH',
				body: JSON.stringify({ action }),
			},
		),
};

// ============ Grant Ops Client ============

/**
 * Creates the Grant Ops HTTP client.
 * This is the sole transport for the web-only application.
 */
export function createGrantOpsClient() {
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
		opencodeSettings: opencodeSettingsApi,
		revisions: revisionsApi,
		notifications: notificationsApi,
		tasks: tasksApi,
		documents: documentsApi,
		duplicates: duplicatesApi,
	};
}

export type GrantOpsClient = ReturnType<typeof createGrantOpsClient>;

// Re-export for convenience
export const client = createGrantOpsClient();
