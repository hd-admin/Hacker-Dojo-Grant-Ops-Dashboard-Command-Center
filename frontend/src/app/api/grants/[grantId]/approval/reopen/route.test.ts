/**
 * Grant Approval Reopen API Route Tests
 *
 * Tests the /api/grants/[grantId]/approval/reopen POST route.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../../shared/types';
import * as repository from '../../../../../../server/grant-ops/repository';
import { POST } from './route';

function createGrant(id: string, status: Grant['status'] = 'review'): Grant {
  return {
    id,
    title: 'Test Grant for Reopen',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 85,
    tags: ['Test'],
    status,
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
  };
}

function makeReopenRequest(grantId: string, body: unknown) {
  return new Request(`http://localhost/api/grants/${grantId}/approval/reopen`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeParams = (grantId: string) => ({ params: Promise.resolve({ grantId }) });

describe('/api/grants/[grantId]/approval/reopen route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('reopens an approved grant and resets status to draft', async () => {
    const grant = createGrant('grant-reopen-1', 'review');
    await repository.addGrant(grant);
    await repository.addApprovalRecord({
      id: 'approval-1',
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'human',
    });

    const response = await POST(
      makeReopenRequest(grant.id, { reason: 'Found errors in the submission' }) as never,
      routeParams(grant.id),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify grant status was reset to draft
    const updatedGrant = await repository.getGrant(grant.id);
    expect(updatedGrant?.status).toBe('draft');
    expect(updatedGrant?.statusLabel).toBe('Drafting');

    // Verify approval record was removed
    const approval = await repository.getApprovalRecord(grant.id);
    expect(approval).toBeNull();

    // Verify audit event was recorded
    const events = await repository.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('draft_reopened');
    expect(events[0]?.entityId).toBe(grant.id);
    expect(events[0]?.metadata).toMatchObject({
      reason: 'Found errors in the submission',
      previousApprovedBy: 'human',
    });
  });

  it('records reopen reason in audit metadata', async () => {
    const grant = createGrant('grant-reopen-2', 'review');
    await repository.addGrant(grant);
    await repository.addApprovalRecord({
      id: 'approval-2',
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'operator',
    });

    const reason = 'Budget numbers need to be updated for the new fiscal year';
    const response = await POST(
      makeReopenRequest(grant.id, { reason }) as never,
      routeParams(grant.id),
    );

    expect(response.status).toBe(200);

    const events = await repository.getAuditEvents();
    expect(events[0]?.metadata.reason).toBe(reason);
    expect(events[0]?.metadata.previousApprovedBy).toBe('operator');
  });

  it('returns 400 when reason is too short', async () => {
    const grant = createGrant('grant-reopen-3');
    await repository.addGrant(grant);
    await repository.addApprovalRecord({
      id: 'approval-3',
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'human',
    });

    const response = await POST(
      makeReopenRequest(grant.id, { reason: 'short' }) as never,
      routeParams(grant.id),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid reopen payload/i);
  });

  it('returns 400 when reason is missing', async () => {
    const grant = createGrant('grant-reopen-4');
    await repository.addGrant(grant);
    await repository.addApprovalRecord({
      id: 'approval-4',
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'human',
    });

    const response = await POST(
      makeReopenRequest(grant.id, {}) as never,
      routeParams(grant.id),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid reopen payload/i);
  });

  it('returns 404 when approval record does not exist', async () => {
    const grant = createGrant('grant-reopen-5');
    await repository.addGrant(grant);
    // No approval record added

    const response = await POST(
      makeReopenRequest(grant.id, { reason: 'Need to revise the budget section' }) as never,
      routeParams(grant.id),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Approval not found/i);
  });

  it('returns 404 when grant does not exist', async () => {
    const response = await POST(
      makeReopenRequest('non-existent', { reason: 'Some valid reason here' }) as never,
      routeParams('non-existent'),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Approval not found/i);
  });

  it('rejects malformed JSON body', async () => {
    const grant = createGrant('grant-reopen-6');
    await repository.addGrant(grant);
    await repository.addApprovalRecord({
      id: 'approval-6',
      grantId: grant.id,
      draftVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: 'human',
    });

    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/approval/reopen`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }) as never,
      routeParams(grant.id),
    );
    const { status } = response;

    expect(status).toBe(400);
  });
});
