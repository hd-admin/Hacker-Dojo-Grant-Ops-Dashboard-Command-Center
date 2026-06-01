/**
 * Grant Detail Service Tests
 *
 * Tests for loadGrantDetail and helper functions.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadGrantDetail } from './grant-detail';
import { createDependencies, resetDependencies, setDependencies } from './dependencies';
import type {
  Grant,
  DraftArtifact,
  RevisionRequest,
  ApprovalRecord,
  SubmissionRecord,
  FollowUp,
} from '../../../../shared/types';

function createMockGrant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'grant-1',
    title: 'Test Grant',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$10,000',
    awardSort: 10000,
    deadline: '2026-12-31',
    daysOut: 100,
    fit: 85,
    tags: ['test'],
    status: 'draft',
    statusLabel: 'Draft',
    ...overrides,
  };
}

function createMockDraft(overrides: Partial<DraftArtifact> = {}): DraftArtifact {
  return {
    id: 'draft-1',
    grantId: 'grant-1',
    version: 1,
    content: 'Draft content',
    createdAt: '2026-05-01T00:00:00Z',
    createdBy: 'agent',
    ...overrides,
  };
}

describe('loadGrantDetail', () => {
  beforeEach(() => {
    resetDependencies();
  });

  afterEach(() => {
    resetDependencies();
  });

  it('returns null when grant is not found', async () => {
    const deps = createDependencies();
    const mockGetGrant = vi.fn().mockResolvedValue(null);
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: mockGetGrant as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('nonexistent');
    expect(result).toBeNull();
  });

  it('returns full detail with workflow for a draft grant', async () => {
    const grant = createMockGrant({ status: 'draft', draftContent: 'Draft content' });
    const draft = createMockDraft({ version: 1 });

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([draft]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.grant.id).toBe('grant-1');
    expect(result!.latestDraft).not.toBeNull();
    expect(result!.latestDraft!.version).toBe(1);
    expect(result!.workflow.canGenerateDraft).toBe(true);
    expect(result!.workflow.canApprove).toBe(true);
    expect(result!.workflow.canSubmit).toBe(false);
  });

  it('returns workflow with canSubmit=true when grant is approved and tasks complete', async () => {
    const grant = createMockGrant({ status: 'approved' });
    const draft = createMockDraft({ version: 1, approvedAt: '2026-05-01T00:00:00Z' });
    const approval: ApprovalRecord = {
      id: 'approval-1',
      grantId: 'grant-1',
      draftVersion: 1,
      approvedAt: '2026-05-01T00:00:00Z',
      approvedBy: 'operator',
    };

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([draft]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(approval) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi
          .fn()
          .mockResolvedValue([
            { id: 'task-1', text: 'Task 1', completed: true, grantId: 'grant-1' },
          ]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
        getSubmissionManifests: vi.fn().mockResolvedValue([
          {
            id: 'manifest-1',
            grantId: 'grant-1',
            version: 1,
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
            materialRefs: [],
          },
        ]) as unknown as typeof deps.repository.getSubmissionManifests,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.workflow.canSubmit).toBe(true);
    expect(result!.workflow.blockingReason).toBeNull();
  });

  it('returns workflow with canSubmit=false and blocking reason when tasks are incomplete', async () => {
    const grant = createMockGrant({ status: 'approved' });
    const draft = createMockDraft({ version: 1 });
    const approval: ApprovalRecord = {
      id: 'approval-1',
      grantId: 'grant-1',
      draftVersion: 1,
      approvedAt: '2026-05-01T00:00:00Z',
      approvedBy: 'operator',
    };

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([draft]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(approval) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([
          {
            id: 'task-1',
            text: 'Incomplete task',
            completed: false,
            grantId: 'grant-1',
            blockSubmission: true,
          },
        ]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.workflow.canSubmit).toBe(false);
    expect(result!.workflow.blockingReason).not.toBeNull();
  });

  it('returns latest draft by version when multiple drafts exist', async () => {
    const grant = createMockGrant({ status: 'draft' });
    const drafts: DraftArtifact[] = [
      createMockDraft({ id: 'draft-1', version: 1 }),
      createMockDraft({ id: 'draft-2', version: 3 }),
      createMockDraft({ id: 'draft-3', version: 2 }),
    ];

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue(drafts) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.latestDraft!.version).toBe(3);
    expect(result!.latestDraft!.id).toBe('draft-2');
  });

  it('returns latest revision request by requestedAt', async () => {
    const grant = createMockGrant({ status: 'draft' });
    const revisions: RevisionRequest[] = [
      {
        id: 'rev-1',
        grantId: 'grant-1',
        draftVersion: 1,
        notes: 'First revision',
        requestedAt: '2026-05-01T00:00:00Z',
        requestedBy: 'operator',
        status: 'pending',
      },
      {
        id: 'rev-2',
        grantId: 'grant-1',
        draftVersion: 2,
        notes: 'Second revision',
        requestedAt: '2026-05-15T00:00:00Z',
        requestedBy: 'operator',
        status: 'pending',
      },
    ];

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue(revisions) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.latestRevisionRequest).not.toBeNull();
    expect(result!.latestRevisionRequest!.id).toBe('rev-2');
  });

  it('filters follow-ups by grantId', async () => {
    const grant = createMockGrant({ status: 'submitted' });
    const followUps: FollowUp[] = [
      {
        id: 'fu-1',
        grantId: 'grant-1',
        title: 'Follow-up 1',
        type: 'other',
        status: 'pending',
        createdAt: '2026-05-01T00:00:00Z',
      },
      {
        id: 'fu-2',
        grantId: 'grant-2',
        title: 'Follow-up 2',
        type: 'other',
        status: 'pending',
        createdAt: '2026-05-01T00:00:00Z',
      },
      {
        id: 'fu-3',
        grantId: 'grant-1',
        title: 'Follow-up 3',
        type: 'other',
        status: 'completed',
        createdAt: '2026-05-01T00:00:00Z',
      },
    ];

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue(followUps) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.followUps).toHaveLength(2);
    expect(result!.followUps.map((f) => f.id)).toContain('fu-1');
    expect(result!.followUps.map((f) => f.id)).toContain('fu-3');
    expect(result!.followUps.map((f) => f.id)).not.toContain('fu-2');
  });

  it('normalizes grant fields with safe defaults', async () => {
    const grant = createMockGrant({
      status: 'draft',
    });

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.grant.latestDraftVersion).toBe(0);
    expect(result!.grant.groundedDocumentCount).toBe(0);
    expect(result!.grant.sourceCount).toBe(0);
    expect(result!.grant.funderSummary).toBe('');
    expect(result!.grant.checklist).toEqual([]);
  });

  it('sets terminal workflow state for submitted grants', async () => {
    const grant = createMockGrant({ status: 'submitted' });
    const submission: SubmissionRecord = {
      id: 'sub-1',
      grantId: 'grant-1',
      submittedAt: '2026-05-01T00:00:00Z',
      method: { type: 'portal', submittedBy: 'operator' },
      followUpsCreated: [],
    };

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(submission) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.workflow.canGenerateDraft).toBe(false);
    expect(result!.workflow.canApprove).toBe(false);
    expect(result!.workflow.canSubmit).toBe(false);
    expect(result!.workflow.blockingReason).toBe('Grant has already been submitted');
  });

  it('sets terminal workflow state for awarded grants', async () => {
    const grant = createMockGrant({ status: 'awarded' });

    const deps = createDependencies();
    setDependencies({
      ...deps,
      repository: {
        ...deps.repository,
        getGrant: vi.fn().mockResolvedValue(grant) as unknown as typeof deps.repository.getGrant,
        getDraftArtifacts: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDraftArtifacts,
        getRevisionRequests: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getRevisionRequests,
        getApprovalRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getApprovalRecord,
        getSubmissionRecord: vi
          .fn()
          .mockResolvedValue(null) as unknown as typeof deps.repository.getSubmissionRecord,
        getFollowUps: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getFollowUps,
        getTasks: vi.fn().mockResolvedValue([]) as unknown as typeof deps.repository.getTasks,
        getDocuments: vi
          .fn()
          .mockResolvedValue([]) as unknown as typeof deps.repository.getDocuments,
      },
    });

    const result = await loadGrantDetail('grant-1');
    expect(result).not.toBeNull();
    expect(result!.workflow.canGenerateDraft).toBe(false);
    expect(result!.workflow.canApprove).toBe(false);
    expect(result!.workflow.canSubmit).toBe(false);
    expect(result!.workflow.blockingReason).toBe('Grant has already been awarded');
  });
});
