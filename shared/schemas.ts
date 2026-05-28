import { z } from 'zod';
import type {
  Grant as _Grant,
  GrantStatus,
  OrganizationProfile as _OrganizationProfile,
  ActivityEvent,
  FitScoreBreakdown,
  CrawlStatus,
  Notification,
  DocumentMetadata as _DocumentMetadata,
  Source as _Source,
  CrawlRun as _CrawlRun,
  DraftArtifact as _DraftArtifact,
  RevisionRequest,
  ApprovalRecord as _ApprovalRecord,
  SubmissionRecord as _SubmissionRecord,
  FollowUp as _FollowUp,
  OpencodeSettings as _OpencodeSettings,
  WorkflowState,
  DocumentExtractionStatus,
  SourceReviewStatus,
  SourceCategory,
  JobFailureCategory,
} from './types';

// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export const GrantStatusSchema: z.ZodType<GrantStatus> = z.enum([
  'matched',
  'draft',
  'review',
  'approved',
  'submission-ready',
  'submitted',
  'follow-up',
  'awarded',
  'declined',
  'closed',
  'archived',
]);

export const FitScoreBreakdownSchema: z.ZodType<FitScoreBreakdown> = z.object({
  missionAlignment: z.number().min(0).max(100),
  geographicFocus: z.number().min(0).max(100),
  programTrackrecord: z.number().min(0).max(100),
  budgetCapacity: z.number().min(0).max(100),
  partnershipReadiness: z.number().min(0).max(100),
});

export const ChecklistItemSchema = z.object({
  label: z.string(),
  done: z.boolean(),
  source: z.string(),
  required: z.boolean().optional(),
});

export const HumanOverrideSchema = z.object({
  field: z.string(),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  rationale: z.string(),
  overriddenAt: z.string(),
  overriddenBy: z.string(),
  overrideType: z.enum(['score', 'category', 'task', 'status']),
});

export const GrantSchema = z.object({
  id: z.string(),
  title: z.string(),
  funder: z.string(),
  funderShort: z.string(),
  award: z.string(),
  awardSort: z.number(),
  deadline: z.string(),
  daysOut: z.number(),
  fit: z.number(),
  tags: z.array(z.string()),
  status: GrantStatusSchema,
  statusLabel: z.string(),
  matchedAt: z.string().optional(),
  fitBreakdown: FitScoreBreakdownSchema.optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
  draftContent: z.string().optional(),
  externalUrl: z.string().optional(),
  researchEvidence: z.array(z.lazy(() => ResearchEvidenceSchema)).optional(),
  researchRationale: z.string().optional(),
  category: z.string().optional(),
  manualSource: z.boolean().optional(),
  humanOverrides: z.array(HumanOverrideSchema).optional(),
});

export const ContactInfoSchema = z.object({
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
});

export const FundingHistoryEntrySchema = z.object({
  year: z.number().int().min(1900).max(2100),
  amount: z.number().min(0),
  source: z.string(),
  purpose: z.string(),
});

export const OrganizationProfileSchema = z.object({
  legalName: z.string(),
  ein: z.string(),
  samUEI: z.string(),
  nonprofitStatus: z.string(),
  contactInfo: ContactInfoSchema,
  geography: z.string(),
  mission: z.string(),
  programAreas: z.array(z.string()),
  populationsServed: z.array(z.string()),
  fundingHistory: z.array(FundingHistoryEntrySchema),
  partnerships: z.array(z.string()),
  complianceFacts: z.array(z.string()),
  docTypes: z.array(z.string()),
  searchThemes: z.array(z.string()),
  agentBehavior: z.object({
    autoDraftThreshold: z.number(),
    submissionPolicy: z.string(),
    notifyEmail: z.string(),
    voiceAndTone: z.string(),
  }),
});

export const ActivityEventSchema: z.ZodType<ActivityEvent> = z.object({
  dot: z.string(),
  text: z.string(),
  time: z.string(),
});

export const CrawlStatusSchema: z.ZodType<CrawlStatus> = z.object({
  online: z.boolean(),
  lastSync: z.string(),
});

export const NotificationSchema: z.ZodType<Notification> = z.object({
  id: z.string(),
  text: z.string(),
  time: z.string(),
  dot: z.string(),
});

export const TaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  grantId: z.string().optional(),
  taskStatus: z.enum(['blocked', 'in-progress', 'completed', 'waived', 'not-applicable']).optional(),
  responsibilityTag: z.enum(['finance', 'program', 'review', 'follow-up']).optional(),
  dependsOn: z.array(z.string()).optional(),
  justification: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  evidence: z.string().optional(),
  blockSubmission: z.boolean().optional(),
});

export const DocumentExtractionStatusSchema: z.ZodType<DocumentExtractionStatus> = z.enum([
  'pending',
  'extracted',
  'stored_unparsed',
  'failed',
]);

export const DocumentMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  lastUsed: z.string().optional(),
  version: z.string().optional(),
  audited: z.boolean().optional(),
  uploadedAt: z.string().optional(),
  storagePath: z.string().optional(),
  extractionStatus: DocumentExtractionStatusSchema.optional(),
  extractedText: z.string().optional(),
  contentSnippet: z.string().optional(),
  extractionError: z.string().optional(),
  mimeType: z.string().optional(),
});

export const OpencodeSettingsSchema = z.object({
  binaryPath: z.string(),
  workingDirectory: z.string(),
  timeoutMs: z.number(),
  profile: z.string().optional(),
  isConfigured: z.boolean(),
});

// ============ NEW WORKFLOW SCHEMAS ============

export const WorkflowStateSchema: z.ZodType<WorkflowState> = z.enum([
  'source_added',
  'researching',
  'matched',
  'drafting',
  'revision_requested',
  'review',
  'approved',
  'submission_blocked',
  'submitted',
  'awarded',
]);

export const SourceReviewStatusSchema: z.ZodType<SourceReviewStatus> = z.enum([
  'pending-review',
  'approved',
  'rejected',
]);

export const SourceCategorySchema: z.ZodType<SourceCategory> = z.enum([
  'foundation',
  'government',
  'corporate',
  'community',
  'other',
]);

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.enum(['website', 'database', 'api']),
  createdAt: z.string(),
  lastCrawledAt: z.string().optional(),
  isActive: z.boolean(),
  reviewStatus: SourceReviewStatusSchema.optional(),
  suggestedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  suggestionReason: z.string().optional(),
  category: SourceCategorySchema.optional(),
  categoryRationale: z.string().optional(),
});

export const SourceDiscoverySuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.enum(['website', 'database', 'api']),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedBy: z.literal('ai'),
  createdAt: z.string(),
});

export const CrawlScheduleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  intervalHours: z.number().min(1),
  lastScheduledAt: z.string().optional(),
  nextScheduledAt: z.string(),
  isEnabled: z.boolean(),
  createdAt: z.string(),
});

export const CrawlRunSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(['running', 'completed', 'failed']),
  sourcesCrawled: z.number(),
  grantsFound: z.number(),
  grantsMatched: z.number(),
  errorMessage: z.string().optional(),
});

export const ResearchEvidenceSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  evidenceType: z.enum(['fit_score', 'deadline', 'award_amount', 'eligibility', 'requirements']),
  content: z.string(),
  url: z.string().optional(),
  capturedAt: z.string(),
});

export const ResearchGrantSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  funder: z.string(),
  funderShort: z.string().optional(),
  award: z.string().optional(),
  awardSort: z.number().optional(),
  deadline: z.string().optional(),
  daysOut: z.number().optional(),
  fit: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const ResearchResponseSchema = z.object({
  grants: z.array(ResearchGrantSchema),
  evidence: z.array(ResearchEvidenceSchema).optional(),
  rationale: z.string().optional(),
});

export const RankingRationaleSchema = z.object({
  criteria: z.string(),
  score: z.number(),
  maxScore: z.number(),
  justification: z.string(),
});

export const DraftArtifactSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  version: z.number(),
  content: z.string(),
  createdAt: z.string(),
  createdBy: z.enum(['agent', 'human']),
  revisionNotes: z.string().optional(),
  groundingSections: z.array(z.object({
    sectionTitle: z.string(),
    evidence: z.array(z.string()),
    isGrounded: z.boolean(),
  })).optional(),
});

export const RevisionRequestSchema: z.ZodType<RevisionRequest> = z.object({
  id: z.string(),
  grantId: z.string(),
  draftVersion: z.number(),
  notes: z.string(),
  requestedAt: z.string(),
  requestedBy: z.string(),
  status: z.enum(['pending', 'addressed', 'superseded']),
});

export const ApprovalRecordSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  draftVersion: z.number(),
  approvedAt: z.string(),
  approvedBy: z.string(),
  lockedUntil: z.string().optional(),
});

export const SubmissionMethodSchema = z.object({
  type: z.enum(['portal', 'email', 'mail', 'other']),
  portalUrl: z.string().optional(),
  confirmationId: z.string().optional(),
  submittedBy: z.string(),
});

export const SubmissionManifestItemSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  version: z.string().optional(),
  role: z.string(),
});

export const SubmissionManifestSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  instructions: z.string().optional(),
  portalUrl: z.string().optional(),
  fileConstraints: z.string().optional(),
  dueDate: z.string().optional(),
  materialRefs: z.array(SubmissionManifestItemSchema),
  notes: z.string().optional(),
});

export const SubmissionRecordSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  submittedAt: z.string(),
  method: SubmissionMethodSchema,
  notes: z.string().optional(),
  followUpsCreated: z.array(z.string()),
  manifestId: z.string().optional(),
  confirmationNumber: z.string().optional(),
});

export const FollowUpSchema = z.object({
  id: z.string(),
  grantId: z.string().optional(),
  submissionId: z.string().optional(),
  type: z.enum(['report_due', 'progress_check', 'stipulation', 'next_steps', 'other']),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'completed', 'overdue']),
  completedAt: z.string().optional(),
  createdAt: z.string(),
});

export const JobFailureCategorySchema: z.ZodType<JobFailureCategory> = z.enum([
  'connectivity',
  'timeout',
  'rate-limit',
  'quota-exhausted',
  'capacity',
  'logic',
  'unknown',
]);

export const JobQueueItemSchema = z.object({
  id: z.string(),
  jobType: z.enum(['research', 'draft']),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  stage: z.string().optional(),
  lastUpdate: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  entityId: z.string().optional(),
  retryCount: z.number().optional(),
  errorMessage: z.string().optional(),
  resultSummary: z.string().optional(),
  failureCategory: JobFailureCategorySchema.optional(),
});

export const DuplicateCandidateSchema = z.object({
  id: z.string(),
  grantId1: z.string(),
  grantId2: z.string(),
  confidenceScore: z.number(),
  status: z.enum(['pending', 'merged', 'kept-separate', 'deferred']),
  detectedAt: z.string(),
  conflictingFields: z.array(z.string()),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
});

export const ConflictRecordSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  fieldName: z.string(),
  values: z.array(z.object({ value: z.string(), sourceId: z.string(), crawledAt: z.string() })),
  canonicalValue: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
});

export const AuditEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  entityId: z.string(),
  entityType: z.string(),
  actorLabel: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const HealthCheckResultSchema = z.object({
  storage: z.enum(['ok', 'error']),
  storageError: z.string().optional(),
  opencode: z.enum(['not-installed', 'not-reachable', 'incompatible', 'ok', 'error']),
  opencodeError: z.string().optional(),
  opencodeVersion: z.string().optional(),
  crawlerLastRunAt: z.string().optional(),
  crawlerStatus: z.enum(['ok', 'stale', 'never-run']),
  documentIndexer: z.enum(['ok', 'degraded', 'error']),
  documentIndexerError: z.string().optional(),
  documentIndexerFailedCount: z.number().optional(),
});

export const BackupManifestSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  grantCount: z.number(),
  sourceCount: z.number(),
  documentCount: z.number(),
  hasDocumentFiles: z.boolean(),
});

export const BackupVerificationRecordSchema = z.object({
  checkedAt: z.string(),
  outcome: z.string(),
  grantCount: z.number(),
  documentCount: z.number(),
  type: z.enum(['backup', 'restore']),
});

export const BackupFreshnessStatusSchema = z.object({
  lastBackupAt: z.string().nullable(),
  isStale: z.boolean(),
  lastBackupVerification: BackupVerificationRecordSchema.nullable(),
  lastRestoreVerification: BackupVerificationRecordSchema.nullable(),
});

export const WorkingContextSchema = z.object({
  activeView: z.string(),
  selectedGrantId: z.string().nullable(),
  recentGrantIds: z.array(z.string()),
  discoverySearch: z.string().optional(),
  discoverySort: z.string().optional(),
  discoveryCategory: z.string().optional(),
  pipelineViewMode: z.enum(['board', 'list']).optional(),
  pipelineStatusFilter: z.string().optional(),
  pipelineResponsibilityFilter: z.string().optional(),
  pipelineUrgencyFilter: z.string().optional(),
  pipelineFunderTypeFilter: z.string().optional(),
  recentDraftId: z.string().nullable().optional(),
});

// ============ THEME SCHEMAS ============

export const InclusionExclusionRuleSchema = z.object({
  id: z.string(),
  field: z.enum(['tags', 'funder', 'title', 'category']),
  operator: z.enum(['contains', 'equals', 'startsWith', 'regex']),
  value: z.string(),
  priority: z.number(),
});

export const MatchingPolicySchema = z.object({
  matchThreshold: z.number().min(0).max(100),
  autoDraftThreshold: z.number().min(0).max(100),
  includeRules: z.array(InclusionExclusionRuleSchema),
  excludeRules: z.array(InclusionExclusionRuleSchema),
});

export const KeywordClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
  weight: z.number().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PopulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StrategicPrioritySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  weight: z.number().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  keywordClusters: z.array(z.string()),
  regions: z.array(z.string()),
  populations: z.array(z.string()),
  strategicPriorities: z.array(z.string()),
  matchingPolicy: MatchingPolicySchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ThemesDataSchema = z.object({
  keywordClusters: z.array(KeywordClusterSchema),
  themes: z.array(ThemeSchema),
  regions: z.array(RegionSchema),
  populations: z.array(PopulationSchema),
  strategicPriorities: z.array(StrategicPrioritySchema),
});

// Re-export types
export type {
  Grant,
  GrantStatus,
  OrganizationProfile,
  ContactInfo,
  FundingHistoryEntry,
  ActivityEvent,
  FitScoreBreakdown,
  ChecklistItem,
  CrawlStatus,
  Notification,
  Task,
  DocumentMetadata,
  Source,
  CrawlRun,
  DraftArtifact,
  RevisionRequest,
  ApprovalRecord,
  SubmissionRecord,
  FollowUp,
  OpencodeSettings,
  WorkflowState,
  DocumentExtractionStatus,
  TaskStatus,
  ResponsibilityTag,
  SourceReviewStatus,
  SourceCategory,
  JobFailureCategory,
  JobQueueItem,
  DuplicateCandidate,
  ConflictRecord,
  SubmissionManifest,
  HealthCheckResult,
  BackupVerificationRecord,
  HumanOverride,
  WorkingContext,
  SourceDiscoverySuggestion,
  CrawlSchedule,
  AuditEvent,
  BackupManifest,
  BackupFreshnessStatus,
} from './types';
