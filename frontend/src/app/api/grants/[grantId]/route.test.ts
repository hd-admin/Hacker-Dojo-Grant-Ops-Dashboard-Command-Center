// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import type { ApprovalRecord, DraftArtifact, Grant, RevisionRequest, SubmissionRecord } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { resetDependencies } from '@/server/grant-ops/dependencies';
import { GET, PATCH } from './route';

function buildGrant(id: string): Grant {
  return {
    id,
    title: 'Grant Detail Workflow Test',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 82,
    tags: ['EdTech'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
  };
}

describe('/api/grants/[grantId]', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    resetDependencies();

    grant = buildGrant(`grant-${Date.now()}`);
    await repository.addGrant(grant);

    const draft: DraftArtifact = {
      id: `draft-${Date.now()}`,
      grantId: grant.id,
      version: 1,
      content: 'Draft body',
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
    };
    await repository.addDraftArtifact(draft);

    const revision: RevisionRequest = {
      id: `revision-${Date.now()}`,
      grantId: grant.id,
      draftVersion: 1,
      notes: 'Tighten the outcome metrics',
      requestedAt: new Date().toISOString(),
      requestedBy: 'human',
      status: 'pending',
    };
    await repository.addRevisionRequest(revision);

    const approval: ApprovalRecord = {
      id: `approval-${Date.now()}`,
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'human',
    };
    await repository.addApprovalRecord(approval);

    const submission: SubmissionRecord = {
      id: `submission-${Date.now()}`,
      grantId: grant.id,
      submittedAt: new Date().toISOString(),
      method: {
        type: 'portal',
        portalUrl: 'https://example.com/portal',
        submittedBy: 'human',
      },
      notes: 'Submitted by human',
      followUpsCreated: [],
    };
    await repository.addSubmissionRecord(submission);

    await repository.addFollowUp({
      id: `followup-${Date.now()}`,
      grantId: grant.id,
      submissionId: submission.id,
      type: 'progress_check',
      title: 'Check submission status',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns a hydrated GrantDetailResponse for GET', async () => {
    const response = await GET(new Request(`http://localhost/api/grants/${grant.id}`) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.grant.id).toBe(grant.id);
    expect(data.latestDraft.version).toBe(1);
    expect(data.latestRevisionRequest.notes).toBe('Tighten the outcome metrics');
    expect(data.approvalRecord.approvedBy).toBe('human');
    expect(data.submissionRecord.method.type).toBe('portal');
    expect(data.followUps).toHaveLength(1);
    expect(data.workflow.canApprove).toBe(false);
    expect(data.workflow.canSubmit).toBe(false);
    expect(data.workflow.blockingReason).toBe('Grant has already been submitted');
  });

  it('updates supported detail fields and returns the hydrated response for PATCH', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          funderSummary: 'Updated funder summary',
          sourceCount: 4,
          groundedDocumentCount: 2,
          latestDraftVersion: 3,
        }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.grant.funderSummary).toBe('Updated funder summary');
    expect(data.grant.sourceCount).toBe(4);
    expect(data.grant.groundedDocumentCount).toBe(2);
    expect(data.grant.latestDraftVersion).toBe(3);
    expect(data.workflow.canSubmit).toBe(false);
  });

  it('rejects malformed payloads with 400', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unsupportedField: true }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid grant detail payload');
  });

  it('returns 404 for missing grants', async () => {
    const response = await GET(new Request('http://localhost/api/grants/missing') as never, {
      params: Promise.resolve({ grantId: 'missing' }),
    });

    expect(response.status).toBe(404);
  });
});
