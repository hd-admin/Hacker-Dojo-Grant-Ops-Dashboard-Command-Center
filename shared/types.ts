// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export type GrantStatus = 'matched' | 'draft' | 'review' | 'submitted' | 'awarded';

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

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export type DocumentExtractionStatus = 'pending' | 'extracted' | 'stored_unparsed' | 'failed';

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

export interface BoardCard {
  id: string;
  title: string;
  funder: string;
  award: string;
  status: GrantStatus;
}

// ============ NEW WORKFLOW TYPES ============

export type WorkflowState =
  | 'source_added'
  | 'researching'
  | 'matched'
  | 'drafting'
  | 'revision_requested'
  | 'review'
  | 'approved'
  | 'submission_blocked'
  | 'submitted'
  | 'awarded';

export interface Source {
  id: string;
  name: string;
  url: string;
  type: 'website' | 'database' | 'api';
  createdAt: string;
  lastCrawledAt?: string;
  isActive: boolean;
}

export interface CrawlRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
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
  evidenceType: 'fit_score' | 'deadline' | 'award_amount' | 'eligibility' | 'requirements';
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
  createdBy: 'agent' | 'human';
  revisionNotes?: string;
}

export interface RevisionRequest {
  id: string;
  grantId: string;
  draftVersion: number;
  notes: string;
  requestedAt: string;
  requestedBy: string;
  status: 'pending' | 'addressed' | 'superseded';
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
  type: 'portal' | 'email' | 'mail' | 'other';
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
}

export interface FollowUp {
  id: string;
  grantId?: string;
  submissionId?: string;
  type: 'report_due' | 'progress_check' | 'stipulation' | 'next_steps' | 'other';
  title: string;
  description?: string;
  dueDate?: string;
  status: 'pending' | 'completed' | 'overdue';
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
