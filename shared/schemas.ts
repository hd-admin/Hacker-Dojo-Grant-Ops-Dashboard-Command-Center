import { z } from 'zod';
import type {
  Grant as _Grant,
  GrantStatus,
  OrganizationProfile as _OrganizationProfile,
  ActivityEvent,
  FitScoreBreakdown,
  ChecklistItem,
  CrawlStatus,
  Notification,
  Task,
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
} from './types';

// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export const GrantStatusSchema: z.ZodType<GrantStatus> = z.enum([
  'matched',
  'draft',
  'review',
  'submitted',
  'awarded',
]);

export const FitScoreBreakdownSchema: z.ZodType<FitScoreBreakdown> = z.object({
  missionAlignment: z.number().min(0).max(100),
  geographicFocus: z.number().min(0).max(100),
  programTrackrecord: z.number().min(0).max(100),
  budgetCapacity: z.number().min(0).max(100),
  partnershipReadiness: z.number().min(0).max(100),
});

export const ChecklistItemSchema: z.ZodType<ChecklistItem> = z.object({
  label: z.string(),
  done: z.boolean(),
  source: z.string(),
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
});

export const OrganizationProfileSchema = z.object({
  legalName: z.string(),
  ein: z.string(),
  samUEI: z.string(),
  mission: z.string(),
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

export const TaskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
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

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.enum(['website', 'database', 'api']),
  createdAt: z.string(),
  lastCrawledAt: z.string().optional(),
  isActive: z.boolean(),
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

export const SubmissionRecordSchema = z.object({
  id: z.string(),
  grantId: z.string(),
  submittedAt: z.string(),
  method: SubmissionMethodSchema,
  notes: z.string().optional(),
  followUpsCreated: z.array(z.string()),
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

export const OpencodeSettingsSchema = z.object({
  binaryPath: z.string(),
  workingDirectory: z.string(),
  timeoutMs: z.number(),
  profile: z.string().optional(),
  isConfigured: z.boolean(),
});

export const StoreDataSchema = z.object({
  grants: z.array(GrantSchema),
  profile: OrganizationProfileSchema,
  crawlStatus: CrawlStatusSchema,
  notifications: z.array(NotificationSchema),
  tasks: z.array(TaskSchema),
  documents: z.array(DocumentMetadataSchema),
  activity: z.array(ActivityEventSchema),
  sources: z.array(SourceSchema).optional(),
  crawlRuns: z.array(CrawlRunSchema).optional(),
  draftArtifacts: z.array(DraftArtifactSchema).optional(),
  revisionRequests: z.array(RevisionRequestSchema).optional(),
  approvalRecords: z.array(ApprovalRecordSchema).optional(),
  submissionRecords: z.array(SubmissionRecordSchema).optional(),
  followUps: z.array(FollowUpSchema).optional(),
  opencodeSettings: OpencodeSettingsSchema.optional(),
});

export type {
  Grant,
  GrantStatus,
  OrganizationProfile,
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
} from './types';
