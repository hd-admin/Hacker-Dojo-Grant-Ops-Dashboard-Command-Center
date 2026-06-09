import { describe, it, expect } from 'vitest';
import {
  GrantSchema,
  OrganizationProfileSchema,
  GrantStatusSchema,
  FitScoreBreakdownSchema,
  FitRubricSchema,
  ChecklistItemSchema,
  HumanOverrideSchema,
  WorkingContextSchema,
  AuditEventSchema,
  BackupFreshnessStatusSchema,
  BackupManifestSchema,
  BackupVerificationRecordSchema,
  CrawlScheduleSchema,
  HealthCheckResultSchema,
  JobQueueItemSchema,
  SourceReviewStatusSchema,
} from './schemas';

describe('shared/schemas', () => {
  describe('GrantStatusSchema', () => {
    it('should accept valid grant statuses', () => {
      expect(GrantStatusSchema.safeParse('matched').success).toBe(true);
      expect(GrantStatusSchema.safeParse('draft').success).toBe(true);
      expect(GrantStatusSchema.safeParse('review').success).toBe(true);
      expect(GrantStatusSchema.safeParse('approved').success).toBe(true);
      expect(GrantStatusSchema.safeParse('submission-ready').success).toBe(true);
      expect(GrantStatusSchema.safeParse('submitted').success).toBe(true);
      expect(GrantStatusSchema.safeParse('follow-up').success).toBe(true);
      expect(GrantStatusSchema.safeParse('awarded').success).toBe(true);
      expect(GrantStatusSchema.safeParse('declined').success).toBe(true);
      expect(GrantStatusSchema.safeParse('closed').success).toBe(true);
      expect(GrantStatusSchema.safeParse('archived').success).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(GrantStatusSchema.safeParse('discarded').success).toBe(false);
      expect(GrantStatusSchema.safeParse('pending').success).toBe(false);
      expect(GrantStatusSchema.safeParse('').success).toBe(false);
    });
  });

  describe('FitScoreBreakdownSchema', () => {
    it('should accept valid fit score breakdown', () => {
      const valid = {
        missionAlignment: 90,
        geographicFocus: 85,
        programTrackrecord: 80,
        budgetCapacity: 75,
        partnershipReadiness: 70,
      };
      expect(FitScoreBreakdownSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject values outside 0-100 range', () => {
      const invalid = {
        missionAlignment: 150,
        geographicFocus: 85,
        programTrackrecord: 80,
        budgetCapacity: 75,
        partnershipReadiness: 70,
      };
      expect(FitScoreBreakdownSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('FitRubricSchema', () => {
    it('accepts a full rubric with per-dimension justifications and rationale', () => {
      const rubric = {
        missionAlignment: { score: 90, justification: 'Strong mission alignment' },
        geographicFocus: { score: 80, justification: 'Bay Area focus' },
        programTrackrecord: { score: 85, justification: 'Strong track record' },
        budgetCapacity: { score: 75, justification: 'Within band' },
        partnershipReadiness: { score: 80, justification: 'Existing partnerships' },
        overallRationale: 'Good fit for Hacker Dojo',
        rubricVersion: 1,
      };
      expect(FitRubricSchema.safeParse(rubric).success).toBe(true);
    });

    it('rejects missing justification on a dimension', () => {
      const bad = {
        missionAlignment: { score: 90 },
        geographicFocus: { score: 80, justification: 'g' },
        programTrackrecord: { score: 85, justification: 'p' },
        budgetCapacity: { score: 75, justification: 'b' },
        partnershipReadiness: { score: 80, justification: 'r' },
        overallRationale: 'good',
        rubricVersion: 1,
      };
      expect(FitRubricSchema.safeParse(bad).success).toBe(false);
    });
  });

  describe('ChecklistItemSchema', () => {
    it('should accept valid checklist item', () => {
      const item = {
        label: '501(c)(3) verification',
        done: true,
        source: 'From profile',
      };
      expect(ChecklistItemSchema.safeParse(item).success).toBe(true);
    });

    it('should reject checklist item with wrong types', () => {
      const item = {
        label: 123,
        done: 'yes',
        source: 456,
      };
      expect(ChecklistItemSchema.safeParse(item).success).toBe(false);
    });
  });

  describe('GrantSchema', () => {
    it('should accept valid grant', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-06-15',
        daysOut: 30,
        fit: 85,
        tags: ['Community', 'EdTech'],
        status: 'matched',
        statusLabel: 'Matched',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(true);
    });

    it('should accept grant with optional fields', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: 'Rolling',
        daysOut: 0,
        fit: 85,
        tags: [],
        status: 'matched',
        statusLabel: 'Matched',
        matchedAt: '2026-05-19',
        fitBreakdown: {
          missionAlignment: 90,
          geographicFocus: 85,
          programTrackrecord: 80,
          budgetCapacity: 75,
          partnershipReadiness: 70,
        },
        checklist: [{ label: 'Test', done: false, source: 'Test' }],
        draftContent: 'Draft content here',
        externalUrl: 'https://example.com',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(true);
    });

    it('should accept grant with new fitRubric + lastSeenAt + lastUpdatedAt + archivedAt fields', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: 'Rolling',
        daysOut: 0,
        fit: 85,
        tags: [],
        status: 'archived',
        statusLabel: 'Archived',
        matchedAt: '2026-05-19',
        fitRubric: {
          missionAlignment: { score: 90, justification: 'm' },
          geographicFocus: { score: 80, justification: 'g' },
          programTrackrecord: { score: 85, justification: 'p' },
          budgetCapacity: { score: 75, justification: 'b' },
          partnershipReadiness: { score: 80, justification: 'r' },
          overallRationale: 'good',
          rubricVersion: 1,
        },
        lastSeenAt: '2026-05-19T00:00:00.000Z',
        lastUpdatedAt: '2026-05-19T00:00:00.000Z',
        archivedAt: '2026-05-20T00:00:00.000Z',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(true);
    });

    it('should reject grant with invalid status', () => {
      const grant = {
        id: 'test-grant',
        title: 'Test Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-06-15',
        daysOut: 30,
        fit: 85,
        tags: [],
        status: 'discarded',
        statusLabel: 'Discarded',
      };
      expect(GrantSchema.safeParse(grant).success).toBe(false);
    });
  });

  describe('OrganizationProfileSchema', () => {
    it('should accept valid organization profile', () => {
      const profile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'XK7N4HQ2P3M9',
        nonprofitStatus: '501(c)(3)',
        yearFounded: 2009,
        contactInfo: {},
        geography: 'Regional',
        mission: 'Our mission',
        programAreas: ['STEM'],
        populationsServed: ['Youth'],
        fundingHistory: [],
        partnerships: [],
        complianceFacts: [],
        boardMembers: [],
        docTypes: ['PDF', 'XLS'],
        searchThemes: ['Theme 1', 'Theme 2'],
        agentBehavior: {
          autoDraftThreshold: 75,
          submissionPolicy: 'Human approval required',
          notifyEmail: 'test@example.com',
          voiceAndTone: 'Plain-spoken',
        },
      };
      expect(OrganizationProfileSchema.safeParse(profile).success).toBe(true);
    });

    it('should reject profile with invalid agent behavior', () => {
      const profile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'XK7N4HQ2P3M9',
        mission: 'Our mission',
        docTypes: [],
        searchThemes: [],
        agentBehavior: {
          autoDraftThreshold: 'high',
          submissionPolicy: 'Human approval required',
          notifyEmail: 'test@example.com',
          voiceAndTone: 'Plain-spoken',
        },
      };
      expect(OrganizationProfileSchema.safeParse(profile).success).toBe(false);
    });
  });

  describe('HumanOverrideSchema', () => {
    it('should accept valid human override', () => {
      const override = {
        field: 'fit',
        previousValue: 65,
        newValue: 85,
        rationale: 'Manual adjustment based on deeper research',
        overriddenAt: '2026-05-27T10:00:00.000Z',
        overriddenBy: 'operator',
        overrideType: 'score',
      };
      expect(HumanOverrideSchema.safeParse(override).success).toBe(true);
    });

    it('should accept human override with status overrideType', () => {
      const override = {
        field: 'status',
        previousValue: 'matched',
        newValue: 'draft',
        rationale: 'Operator reviewed and moved to drafting',
        overriddenAt: '2026-05-27T10:00:00.000Z',
        overriddenBy: 'operator',
        overrideType: 'status',
      };
      expect(HumanOverrideSchema.safeParse(override).success).toBe(true);
    });

    it('should accept human override with rubric overrideType', () => {
      const override = {
        field: 'fitRubric',
        previousValue: null,
        newValue: {
          missionAlignment: { score: 90, justification: 'm' },
          geographicFocus: { score: 80, justification: 'g' },
          programTrackrecord: { score: 85, justification: 'p' },
          budgetCapacity: { score: 75, justification: 'b' },
          partnershipReadiness: { score: 80, justification: 'r' },
          overallRationale: 'good',
          rubricVersion: 1,
        },
        rationale: 'Operator corrected the rubric after a manual review',
        overriddenAt: '2026-05-27T10:00:00.000Z',
        overriddenBy: 'operator',
        overrideType: 'rubric',
      };
      expect(HumanOverrideSchema.safeParse(override).success).toBe(true);
    });

    it('should reject override with invalid overrideType', () => {
      const override = {
        field: 'fit',
        previousValue: 65,
        newValue: 85,
        rationale: 'Manual adjustment',
        overriddenAt: '2026-05-27T10:00:00.000Z',
        overriddenBy: 'operator',
        overrideType: 'invalid-type',
      };
      expect(HumanOverrideSchema.safeParse(override).success).toBe(false);
    });

    it('should reject override with missing required fields', () => {
      const override = {
        field: 'fit',
        previousValue: 65,
        // missing rationale, overriddenAt, overriddenBy, overrideType
      };
      expect(HumanOverrideSchema.safeParse(override).success).toBe(false);
    });
  });

  describe('WorkingContextSchema', () => {
    it('should accept valid working context', () => {
      const context = {
        activeView: 'discovery',
        selectedGrantId: 'grant-123',
        recentGrantIds: ['grant-123', 'grant-456'],
        discoverySearch: 'education',
        discoverySort: 'fit',
        discoveryCategory: 'EdTech',
        pipelineViewMode: 'board',
        pipelineStatusFilter: 'matched',
        pipelineResponsibilityFilter: 'finance',
        pipelineUrgencyFilter: 'soon',
        pipelineFunderTypeFilter: 'foundation',
        recentDraftId: 'draft-789',
      };
      expect(WorkingContextSchema.safeParse(context).success).toBe(true);
    });

    it('should accept minimal working context', () => {
      const context = {
        activeView: 'dashboard',
        selectedGrantId: null,
        recentGrantIds: [],
      };
      expect(WorkingContextSchema.safeParse(context).success).toBe(true);
    });

    it('should reject working context with invalid viewMode', () => {
      const context = {
        activeView: 'discovery',
        selectedGrantId: null,
        recentGrantIds: [],
        pipelineViewMode: 'invalid-mode',
      };
      expect(WorkingContextSchema.safeParse(context).success).toBe(false);
    });

    it('should accept working context with list viewMode', () => {
      const context = {
        activeView: 'pipeline',
        selectedGrantId: 'grant-123',
        recentGrantIds: ['grant-123'],
        pipelineViewMode: 'list',
      };
      expect(WorkingContextSchema.safeParse(context).success).toBe(true);
    });
  });

  describe('workflow schemas', () => {
    it('accepts the health bootstrap shape used by the startup gate', () => {
      expect(
        HealthCheckResultSchema.safeParse({
          storage: 'ok',
          opencode: 'ok',
          opencodeVersion: '0.1.5',
          crawlerStatus: 'never-run',
          documentIndexer: 'ok',
        }).success,
      ).toBe(true);
    });

    it('accepts the working-context payload used for restoring the shell', () => {
      expect(
        WorkingContextSchema.safeParse({
          activeView: 'pipeline',
          selectedGrantId: 'grant-1',
          recentGrantIds: ['grant-1', 'grant-2'],
          discoverySearch: 'STEM',
          discoverySort: 'fit',
          discoveryCategory: 'Community',
          pipelineViewMode: 'list',
          pipelineStatusFilter: 'review',
          pipelineResponsibilityFilter: 'review',
          pipelineUrgencyFilter: 'urgent',
          pipelineFunderTypeFilter: 'foundation',
          recentDraftId: 'draft-1',
        }).success,
      ).toBe(true);
    });

    it('accepts the source review status values used by the source workflow', () => {
      expect(SourceReviewStatusSchema.safeParse('pending-review').success).toBe(true);
      expect(SourceReviewStatusSchema.safeParse('approved').success).toBe(true);
      expect(SourceReviewStatusSchema.safeParse('rejected').success).toBe(true);
      expect(SourceReviewStatusSchema.safeParse('draft').success).toBe(false);
    });

    it('accepts the crawl schedule payload used by scheduled crawls', () => {
      expect(
        CrawlScheduleSchema.safeParse({
          id: 'schedule-1',
          sourceId: 'source-1',
          intervalHours: 24,
          lastScheduledAt: '2026-05-26T12:00:00.000Z',
          nextScheduledAt: '2026-05-27T12:00:00.000Z',
          isEnabled: true,
          createdAt: '2026-05-26T12:00:00.000Z',
        }).success,
      ).toBe(true);
    });

    it('accepts the job queue payload used by retry and failure taxonomy flows', () => {
      expect(
        JobQueueItemSchema.safeParse({
          id: 'job-1',
          jobType: 'research',
          status: 'failed',
          stage: 'crawl',
          lastUpdate: '2026-05-26T12:00:00.000Z',
          createdAt: '2026-05-26T11:45:00.000Z',
          startedAt: '2026-05-26T11:46:00.000Z',
          completedAt: '2026-05-26T11:50:00.000Z',
          entityId: 'grant-1',
          retryCount: 2,
          errorMessage: 'Timed out',
          resultSummary: 'Crawl failed after retry',
          failureCategory: 'timeout',
        }).success,
      ).toBe(true);
    });

    it('accepts the audit event payload used by diagnostics and audit views', () => {
      expect(
        AuditEventSchema.safeParse({
          id: 'audit-1',
          eventType: 'grant_status_changed',
          entityId: 'grant-1',
          entityType: 'grant',
          actorLabel: 'system',
          timestamp: '2026-05-26T12:00:00.000Z',
          metadata: { from: 'matched', to: 'draft' },
        }).success,
      ).toBe(true);
    });

    it('accepts the backup and restore freshness payloads used for operator verification', () => {
      expect(
        BackupManifestSchema.safeParse({
          version: '1.0.0',
          createdAt: '2026-05-26T12:00:00.000Z',
          grantCount: 5,
          sourceCount: 3,
          documentCount: 7,
          hasDocumentFiles: true,
        }).success,
      ).toBe(true);

      expect(
        BackupVerificationRecordSchema.safeParse({
          checkedAt: '2026-05-26T12:05:00.000Z',
          outcome: 'verified',
          grantCount: 5,
          documentCount: 7,
          type: 'backup',
        }).success,
      ).toBe(true);

      expect(
        BackupFreshnessStatusSchema.safeParse({
          lastBackupAt: '2026-05-26T12:00:00.000Z',
          isStale: false,
          lastBackupVerification: {
            checkedAt: '2026-05-26T12:05:00.000Z',
            outcome: 'verified',
            grantCount: 5,
            documentCount: 7,
            type: 'backup',
          },
          lastRestoreVerification: null,
        }).success,
      ).toBe(true);
    });
  });
});
