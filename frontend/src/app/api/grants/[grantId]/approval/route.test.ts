/**
 * Grant Approval API Route Tests
 *
 * Tests the /api/grants/[grantId]/approval endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Grant } from '../../../../../../../shared/types';
import { invalidateCache, loadPersistedData, savePersistedData } from '../../../../../../../shared/grant-ops-persistence';
import * as repository from '../../../../../server/grant-ops/repository';
import * as submissionService from '../../../../../server/grant-ops/submission-service';

function createMockGrant(idSuffix: string): Grant {
  return {
    id: `test-grant-approval-${idSuffix}`,
    title: 'Test Grant for Approval',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 85,
    tags: ['Test'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
  };
}

describe('Grant Approval Route', () => {
  let originalPersistedDataBackup: Awaited<ReturnType<typeof loadPersistedData>> | null = null;
  let mockGrant: Grant;

  beforeEach(async () => {
    invalidateCache();
    originalPersistedDataBackup = await loadPersistedData();

    // Use unique grant ID per test to avoid cross-test pollution
    mockGrant = createMockGrant(`unique-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // Add test grant
    await repository.addGrant(mockGrant);
  });

  afterEach(async () => {
    if (originalPersistedDataBackup !== null) {
      await savePersistedData(originalPersistedDataBackup);
    }
    invalidateCache();
  });

  describe('GET /api/grants/[grantId]/approval', () => {
    it('returns null when no approval exists', async () => {
      const approval = await submissionService.getApprovalRecord(mockGrant.id);
      expect(approval).toBeNull();
    });

    it('returns approval record after grant is approved', async () => {
      await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      const approval = await submissionService.getApprovalRecord(mockGrant.id);
      expect(approval).not.toBeNull();
      expect(approval?.grantId).toBe(mockGrant.id);
    });
  });

  describe('POST /api/grants/[grantId]/approval', () => {
    it('approves a grant and returns approval record', async () => {
      const result = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      expect(result.success).toBe(true);
      expect(result.approvalRecord).toBeDefined();
      expect(result.approvalRecord?.grantId).toBe(mockGrant.id);
    });

    it('creates approval record with approvedBy', async () => {
      const result = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'human',
      });

      expect(result.approvalRecord?.approvedBy).toBe('human');
    });

    it('sets draft version in approval record', async () => {
      const result = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      expect(result.approvalRecord?.draftVersion).toBeDefined();
      expect(result.approvalRecord?.draftVersion).toBeGreaterThanOrEqual(1);
    });
  });
});
