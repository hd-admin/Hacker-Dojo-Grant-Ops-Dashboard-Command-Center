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
export type SourceCrawlState = 'never-crawled' | 'queued' | 'running' | 'succeeded' | 'partially-failed' | 'failed';
export type SourceCrawlAccessCategory = 'crawlable' | 'crawlable-with-auth' | 'manual-only' | 'unsupported';

export type AgentTaskType =
	| 'research'
	| 'draft'
	| 'crawl'
	| 'match'
	| 'extract'
	| 'peer-discovery'
	| 'funder-insights'
	| 'eligibility-vetting'
	| 'budget-import';

export type JobStatus =
	| 'queued'
	| 'running'
	| 'verifying'
	| 'retrying'
	| 'completed'
	| 'failed'
	| 'cancelled';

export interface JobProgressUpdate {
	status: JobStatus;
	progress: number;
	stage: string;
	retryCount: number;
	maxRetries: number;
	errorMessage?: string;
}

export interface AgentJob {
	id: string;
	jobType: AgentTaskType;
	grantId?: string;
	params: Record<string, unknown>;
	status: JobStatus;
	progress: number;
	stage: string;
	retryCount: number;
	maxRetries: number;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	entityId?: string;
	errorMessage?: string;
	resultSummary?: string;
	failureCategory?: JobFailureCategory;
	partialOutput?: string;
}

export interface JobQueueItem {
	id: string;
	jobType: AgentTaskType;
	status: JobStatus;
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
	partialOutput?: string;
	progress?: number;
	maxRetries?: number;
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

export interface FailureHistoryEntry {
	id: string;
	timestamp: string;
	failureMode: string;
	errorMessage: string;
	resolved: boolean;
	resolvedAt?: string;
	rootCauseCategory?: FailureRootCauseCategory;
	resolutionSteps?: string[];
}

export type FailureRootCauseCategory =
	| 'binary-missing'
	| 'binary-incompatible'
	| 'api-key-invalid'
	| 'network-blocked'
	| 'disk-full'
	| 'memory-exhausted'
	| 'provider-overloaded'
	| 'quota-depleted'
	| 'session-interrupted'
	| 'unknown';

export interface HealthCheckResult {
	storage: "ok" | "error";
	storageError?: string;
	opencode: "not-installed" | "not-reachable" | "incompatible" | "ok" | "error";
	opencodeError?: string;
	opencodeVersion?: string;
	handshakeSuccess?: boolean;
	handshakeResponseTimeMs?: number;
	handshakeError?: string;
	capabilities?: string[];
	crawlerLastRunAt?: string;
	crawlerStatus: "ok" | "stale" | "never-run";
	documentIndexer: "ok" | "degraded" | "error";
	documentIndexerError?: string;
	documentIndexerFailedCount?: number;
	/** Recent failure history for diagnostics (max 10 entries) */
	failureHistory?: FailureHistoryEntry[];
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
	grantId?: string;
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
	sourceCrawlState: SourceCrawlState;
	lastFailedAt?: string;
	failureCategory?: JobFailureCategory;
	crawlAccessCategory: SourceCrawlAccessCategory;
	/** How authentication is handled for this source (e.g. 'API key', 'OAuth2', 'none') */
	authMethodDescription?: string;
	/** Recommended crawl interval in human-readable form (e.g. 'weekly', 'daily') */
	crawlFrequencyRecommendation?: string;
	/** ISO timestamp of the last manual review by an operator */
	lastManualReviewDate?: string;
	/** Free-form operator notes about this source */
	operatorNotes?: string;
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
	/** AI-suggested source category */
	suggestedCategory?: SourceCategory;
	/** AI-suggested crawl access classification */
	suggestedCrawlAccess?: SourceCrawlAccessCategory;
	/** AI-suggested auth method description */
	authMethodDescription?: string;
	/** AI-suggested crawl frequency */
	crawlFrequencyRecommendation?: string;
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

export interface GrantAttachment {
	id: string;
	name: string;
	type: 'file' | 'note';
	contentOrPath: string;
	uploadedAt: string;
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
	submissionMethod?: 'portal' | 'email' | 'mail' | 'other';
	confirmationNumber?: string;
	runbookCompleted?: boolean;
}

export interface Grant {
	id: string;
	title: string;
	funder: string;
	funderShort: string;
	award: string;
	awardSort: number;
	deadline: string;
	deadlineConfidence?: 'exact' | 'estimated' | 'rolling' | 'unknown';
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
	category?: string;
	manualSource?: boolean;
	manualOrigin?: boolean;
	enteredAt?: string;
	grantType?: string;
	humanOverrides?: HumanOverride[];
	attachments?: GrantAttachment[];
}

export interface ContactInfo {
	address?: string;
	phone?: string;
	email?: string;
	website?: string;
}

export interface FundingHistoryEntry {
	year: number;
	amount: number;
	source: string;
	purpose: string;
}

export interface OrganizationProfile {
	legalName: string;
	ein: string;
	samUEI: string;
	nonprofitStatus: string;
	contactInfo: ContactInfo;
	geography: string;
	mission: string;
	programAreas: string[];
	populationsServed: string[];
	fundingHistory: FundingHistoryEntry[];
	partnerships: string[];
	complianceFacts: string[];
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
	urgency?: 'info' | 'warning' | 'urgent';
}

export interface DocumentVersion {
	id: string;
	documentId: string;
	versionNumber: number;
	uploadedAt: string;
	storagePath: string;
	notes?: string;
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
	classification?: 'canonical' | 'draft-only' | 'archived' | 'restricted';
	versions?: DocumentVersion[];
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
	status: "running" | "completed" | "failed" | "partial-results";
	sourcesCrawled: number;
	grantsFound: number;
	grantsMatched: number;
	errorMessage?: string;
	sourceId?: string;
	failureCategory?: JobFailureCategory;
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
	status?: "generated" | "partial-failure";
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
	draftContent?: string;
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
	/** Configurable backoff multiplier for retry delays (default: 1000ms). Operator can tune from Settings. */
	backoffMultiplier?: number;
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

// ============ THEME & MATCHING POLICY TYPES ============

export interface KeywordCluster {
	id: string;
	name: string;
	keywords: string[];
	weight: number;
	createdAt: string;
	updatedAt: string;
}

export interface InclusionExclusionRule {
	id: string;
	field: "tags" | "funder" | "title" | "category";
	operator: "contains" | "equals" | "startsWith" | "regex";
	value: string;
	priority: number;
}

export interface MatchingPolicy {
	matchThreshold: number;
	autoDraftThreshold: number;
	includeRules: InclusionExclusionRule[];
	excludeRules: InclusionExclusionRule[];
}

export interface Region {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Population {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface StrategicPriority {
	id: string;
	name: string;
	description?: string;
	weight: number;
	createdAt: string;
	updatedAt: string;
}

export interface Theme {
	id: string;
	name: string;
	description?: string;
	keywordClusters: string[];
	regions: string[];
	populations: string[];
	strategicPriorities: string[];
	matchingPolicy: MatchingPolicy;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ThemesData {
	keywordClusters: KeywordCluster[];
	themes: Theme[];
	regions: Region[];
	populations: Population[];
	strategicPriorities: StrategicPriority[];
}

export interface FunderProfile {
	id: string;
	name: string;
	type: 'foundation' | 'government' | 'corporate' | 'community' | 'other';
	ein?: string;
	givingHistory: {
		year: number;
		totalGiving: number;
		grantsCount: number;
		averageGrantSize: number;
	}[];
	focusAreas: string[];
	geographicFocus: string[];
	typicalAwardRange: { min: number; max: number };
	applicationProcess: string;
	deadlines: string;
	sourceUrls: string[];
	lastUpdated: string;
}

export interface SavedSearch {
	id: string;
	name: string;
	queryText: string;
	filters: {
		categories?: string[];
		funderTypes?: string[];
		minAward?: number;
		maxAward?: number;
		geography?: string;
	};
	newResultsCount: number;
	lastCheckedAt: string;
	createdAt: string;
}

export interface PeerDiscoveryResult {
	id: string;
	funderName: string;
	funderType: 'foundation' | 'government' | 'corporate' | 'community' | 'other';
	relevanceRationale: string;
	sourceOrganization: string;
	confidence?: number;
	createdAt: string;
}

export interface EligibilityVetting {
	id: string;
	grantId: string;
	status: 'meets-all' | 'requires' | 'ineligible';
	missingRequirements: string[];
	recommendation?: string;
	checks: { requirement: string; met: boolean; detail: string }[];
	checkedAt: string;
}

export interface DraftSnippet {
	id: string;
	sectionTitle?: string | undefined;
	title?: string | undefined;
	content: string;
	sourceGrantId?: string | undefined;
	grantId?: string | undefined;
	sourceFunder?: string | undefined;
	topicTags?: string[] | undefined;
	category?: string | undefined;
	programArea?: string | undefined;
	usedCount?: number | undefined;
	lastUsedAt?: string | undefined;
	createdAt: string;
}

export interface Award {
	id: string;
	grantId: string;
	funder: string;
	title: string;
	amount: number;
	startDate: string;
	endDate: string;
	status: 'active' | 'completed' | 'terminated' | 'pending';
	awardLetterPath: string;
	notes: string;
	createdAt: string;
	updatedAt?: string;
}

export interface AwardBudgetCategory {
	id: string;
	awardId: string;
	category: string;
	budgeted: number;
	spent: number;
	restrictions?: string;
	internalCategory?: string;
}

export interface AwardExpense {
	id: string;
	awardId: string;
	categoryId?: string | undefined;
	date: string;
	description: string;
	amount: number;
	receiptPath?: string | undefined;
	isPlanned?: number | undefined;
}

export interface AwardReportDeadline {
	id: string;
	awardId: string;
	reportType: string;
	dueDate: string;
	notes?: string;
	status: 'pending' | 'submitted' | 'overdue';
	submittedAt?: string;
	submittedBy?: string;
}

export interface AwardComplianceItem {
	id: string;
	awardId: string;
	requirement: string;
	dueDate: string;
	status: 'pending' | 'completed' | 'overdue' | 'waived';
	notes?: string;
	completedAt?: string;
}

export interface PlannedExpense {
	id: string;
	awardId: string;
	categoryId: string;
	date: string;
	description: string;
	amount: number;
}

export interface PipelineTransition {
	id: string;
	grantId: string;
	fromState: string;
	toState: string;
	actor: string;
	timestamp: string;
	reason?: string;
}
