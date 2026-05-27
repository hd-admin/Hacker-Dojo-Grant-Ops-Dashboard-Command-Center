// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export type GrantStatus =
	| "matched"
	| "draft"
	| "review"
	| "approved"
	| "submission-ready"
	| "submitted"
	| "follow-up"
	| "awarded"
	| "declined"
	| "closed"
	| "archived";

export interface FitScoreBreakdown {
	missionAlignment: number;
	geographicFocus: number;
	programTrackrecord: number;
	budgetCapacity: number;
	partnershipReadiness: number;
}

export interface ChecklistItem {
	label: string;
	done: boolean;
	source: string;
	required?: boolean;
}

export type TaskStatus =
	| "blocked"
	| "in-progress"
	| "completed"
	| "waived"
	| "not-applicable";

export type ResponsibilityTag = "finance" | "program" | "review" | "follow-up";
export type SourceReviewStatus = "pending-review" | "approved" | "rejected";
export type SourceCategory = "foundation" | "government" | "corporate" | "community" | "other";
export type JobFailureCategory =
	| "connectivity"
	| "timeout"
	| "rate-limit"
	| "quota-exhausted"
	| "capacity"
	| "logic"
	| "unknown";
export type PipelineViewMode = "board" | "list";

export interface JobQueueItem {
	id: string;
	jobType: "research" | "draft";
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
	stage?: string;
	lastUpdate?: string;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	entityId?: string;
	retryCount?: number;
	errorMessage?: string | undefined;
	resultSummary?: string;
	failureCategory?: JobFailureCategory | undefined;
}

export interface HumanOverride {
	field: string;
	previousValue: unknown;
	newValue: unknown;
	rationale: string;
	overriddenAt: string;
	overriddenBy: string;
	overrideType: "score" | "category" | "task" | "status";
}

export interface AuditEvent {
	id: string;
	eventType: string;
	entityId: string;
	entityType: string;
	actorLabel: string;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
	storage: "ok" | "error";
	storageError?: string;
	opencode: "not-installed" | "not-reachable" | "incompatible" | "ok" | "error";
	opencodeError?: string;
	opencodeVersion?: string;
	crawlerLastRunAt?: string;
	crawlerStatus: "ok" | "stale" | "never-run";
	documentIndexer: "ok" | "degraded" | "error";
	documentIndexerError?: string;
	documentIndexerFailedCount?: number;
}

export interface BackupManifest {
	version: string;
	createdAt: string;
	grantCount: number;
	sourceCount: number;
	documentCount: number;
	hasDocumentFiles: boolean;
}

export interface BackupVerificationRecord {
	checkedAt: string;
	outcome: string;
	grantCount: number;
	documentCount: number;
	type: "backup" | "restore";
}

export interface BackupFreshnessStatus {
	lastBackupAt: string | null;
	isStale: boolean;
	lastBackupVerification: BackupVerificationRecord | null;
	lastRestoreVerification: BackupVerificationRecord | null;
}

export interface UnsavedChangesState {
	hasUnsaved: boolean;
	surfaceName: string;
	warningMessage: string;
}

export interface WorkingContext {
	activeView: string;
	selectedGrantId: string | null;
	recentGrantIds: string[];
	discoverySearch?: string;
	discoverySort?: string;
	discoveryCategory?: string;
	pipelineViewMode?: PipelineViewMode;
	pipelineStatusFilter?: string;
	pipelineResponsibilityFilter?: string;
	pipelineUrgencyFilter?: string;
	pipelineFunderTypeFilter?: string;
	recentDraftId?: string | null;
}

export interface Task {
	id: string;
	text: string;
	completed: boolean;
	taskStatus?: TaskStatus;
	responsibilityTag?: ResponsibilityTag;
	dependsOn?: string[];
	justification?: string;
	dueDate?: string;
	notes?: string;
	evidence?: string;
	blockSubmission?: boolean;
}

export interface Source {
	id: string;
	name: string;
	url: string;
	type: "website" | "database" | "api";
	createdAt: string;
	lastCrawledAt?: string;
	isActive: boolean;
	reviewStatus?: SourceReviewStatus;
	suggestedBy?: string;
	approvedAt?: string;
	rejectionReason?: string;
	suggestionReason?: string;
	category?: SourceCategory;
	categoryRationale?: string;
}

export interface SourceDiscoverySuggestion {
	id: string;
	name: string;
	url: string;
	type: "website" | "database" | "api";
	rationale: string;
	confidence: number;
	suggestedBy: "ai";
	createdAt: string;
}

export interface CrawlSchedule {
	id: string;
	sourceId: string;
	intervalHours: number;
	lastScheduledAt?: string;
	nextScheduledAt: string;
	isEnabled: boolean;
	createdAt: string;
}

export interface DuplicateCandidate {
	id: string;
	grantId1: string;
	grantId2: string;
	confidenceScore: number;
	status: "pending" | "merged" | "kept-separate" | "deferred";
	detectedAt: string;
	conflictingFields: string[];
	resolvedAt?: string;
	resolvedBy?: string;
}

export interface ConflictRecord {
	id: string;
	grantId: string;
	fieldName: string;
	values: Array<{ value: string; sourceId: string; crawledAt: string }>;
	canonicalValue?: string;
	resolvedAt?: string;
	resolvedBy?: string;
}

export interface SubmissionManifestItem {
	documentId: string;
	documentName: string;
	version?: string;
	role: string;
}

export interface SubmissionManifest {
	id: string;
	grantId: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	instructions?: string;
	portalUrl?: string;
	fileConstraints?: string;
	dueDate?: string;
	materialRefs: SubmissionManifestItem[];
	notes?: string;
}

export interface Grant {
	id: string;
	title: string;
	funder: string;
	funderShort: string;
	award: string;
	awardSort: number;
	deadline: string;
	daysOut: number;
	fit: number;
	tags: string[];
	status: GrantStatus;
	statusLabel: string;
	matchedAt?: string;
	fitBreakdown?: FitScoreBreakdown;
	checklist?: ChecklistItem[];
	draftContent?: string;
	externalUrl?: string;
	funderSummary?: string;
	latestDraftVersion?: number;
	groundedDocumentCount?: number;
	sourceCount?: number;
	responsibilityTag?: ResponsibilityTag;
	researchEvidence?: ResearchEvidence[];
	researchRationale?: string;
	manualSource?: boolean;
	humanOverrides?: HumanOverride[];
}

export interface OrganizationProfile {
	legalName: string;
	ein: string;
	samUEI: string;
	mission: string;
	docTypes: string[];
	searchThemes: string[];
	agentBehavior: {
		autoDraftThreshold: number;
		submissionPolicy: string;
		notifyEmail: string;
		voiceAndTone: string;
	};
}

export interface ActivityEvent {
	dot: string;
	text: string;
	time: string;
}

export interface CrawlStatus {
	online: boolean;
	lastSync: string;
}

export interface Notification {
	id: string;
	text: string;
	time: string;
	dot: string;
}

export interface DocumentMetadata {
	id: string;
	name: string;
	type: string;
	lastUsed?: string;
	version?: string;
	audited?: boolean;
	uploadedAt?: string;
	storagePath?: string;
	extractionStatus?: DocumentExtractionStatus;
	extractedText?: string;
	contentSnippet?: string;
	extractionError?: string;
	mimeType?: string;
}

export type DocumentExtractionStatus =
	| "pending"
	| "extracted"
	| "stored_unparsed"
	| "failed";

export interface BoardCard {
	id: string;
	title: string;
	funder: string;
	award: string;
	status: GrantStatus;
}

// ============ NEW WORKFLOW TYPES ============

export type WorkflowState =
	| "source_added"
	| "researching"
	| "matched"
	| "drafting"
	| "revision_requested"
	| "review"
	| "approved"
	| "submission_blocked"
	| "submitted"
	| "awarded";

export interface CrawlRun {
	id: string;
	startedAt: string;
	completedAt?: string;
	status: "running" | "completed" | "failed";
	sourcesCrawled: number;
	grantsFound: number;
	grantsMatched: number;
	errorMessage?: string;
}

export interface ResearchEvidence {
	id: string;
	grantId: string;
	sourceId: string;
	sourceName: string;
	evidenceType:
		| "fit_score"
		| "deadline"
		| "award_amount"
		| "eligibility"
		| "requirements";
	content: string;
	url?: string;
	capturedAt: string;
}

export interface RankingRationale {
	criteria: string;
	score: number;
	maxScore: number;
	justification: string;
}

export interface DraftArtifact {
	id: string;
	grantId: string;
	version: number;
	content: string;
	createdAt: string;
	createdBy: "agent" | "human";
	revisionNotes?: string;
	groundingSections?: Array<{ sectionTitle: string; evidence: string[]; isGrounded: boolean }>;
}

export interface RevisionRequest {
	id: string;
	grantId: string;
	draftVersion: number;
	notes: string;
	requestedAt: string;
	requestedBy: string;
	status: "pending" | "addressed" | "superseded";
}

export interface ApprovalRecord {
	id: string;
	grantId: string;
	draftVersion: number;
	approvedAt: string;
	approvedBy: string;
	lockedUntil?: string;
}

export interface SubmissionMethod {
	type: "portal" | "email" | "mail" | "other";
	portalUrl?: string;
	confirmationId?: string;
	submittedBy: string;
}

export interface SubmissionRecord {
	id: string;
	grantId: string;
	submittedAt: string;
	method: SubmissionMethod;
	notes?: string;
	followUpsCreated: string[];
	manifestId?: string;
	confirmationNumber?: string;
}

export interface FollowUp {
	id: string;
	grantId?: string;
	submissionId?: string;
	type:
		| "report_due"
		| "progress_check"
		| "stipulation"
		| "next_steps"
		| "other";
	title: string;
	description?: string;
	dueDate?: string;
	status: "pending" | "completed" | "overdue";
	completedAt?: string;
	createdAt: string;
}

export interface GrantDetailWorkflow {
	canGenerateDraft: boolean;
	canRequestRevision: boolean;
	canApprove: boolean;
	canSubmit: boolean;
	blockingReason: string | null;
}

export interface GrantDetailUpdate {
	fitBreakdown?: FitScoreBreakdown;
	checklist?: ChecklistItem[];
	funderSummary?: string;
	latestDraftVersion?: number;
	groundedDocumentCount?: number;
	sourceCount?: number;
}

export interface GrantDetailResponse {
	grant: Grant;
	latestDraft: DraftArtifact | null;
	latestRevisionRequest: RevisionRequest | null;
	approvalRecord: ApprovalRecord | null;
	submissionRecord: SubmissionRecord | null;
	followUps: FollowUp[];
	workflow: GrantDetailWorkflow;
}

export interface OpencodeSettings {
	binaryPath: string;
	workingDirectory: string;
	timeoutMs: number;
	profile?: string;
	isConfigured: boolean;
}

export interface StoreData {
	grants: Grant[];
	profile: OrganizationProfile;
	crawlStatus: CrawlStatus;
	notifications: Notification[];
	tasks: Task[];
	documents: DocumentMetadata[];
	activity: ActivityEvent[];
	sources: Source[];
	crawlRuns: CrawlRun[];
	draftArtifacts: DraftArtifact[];
	revisionRequests: RevisionRequest[];
	approvalRecords: ApprovalRecord[];
	submissionRecords: SubmissionRecord[];
	followUps: FollowUp[];
	opencodeSettings: OpencodeSettings;
}
