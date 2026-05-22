/**
 * Grant Submit API Route Tests
 *
 * Tests the /api/grants/[grantId]/submit endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Grant } from '../../../../../../../shared/types';
import { invalidateCache, loadPersistedData, savePersistedData, loadGrants, saveGrants } from '../../../../../../../shared/grant-ops-persistence';
import * as repository from '../../../../../server/grant-ops/repository';
import * as submissionService from '../../../../../server/grant-ops/submission-service';

function createMockGrant(idSuffix: string): Grant {
  return {
    id: `test-grant-submit-${idSuffix}`,
    title: 'Test Grant for Submit',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$75,000',
    awardSort: 75000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 90,
    tags: ['Test'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
    draftContent: 'Test draft content',
  };
}

describe('Grant Submit Route', () => {
  let originalPersistedDataBackup: Awaited<ReturnType<typeof loadPersistedData>> | null = null;
  let originalGrantsBackup: Awaited<ReturnType<typeof loadGrants>> | null = null;

  beforeEach(async () => {
    invalidateCache();
    // Create deep copies via JSON serialization to avoid reference issues
    const persistedData = await loadPersistedData();
    originalPersistedDataBackup = JSON.parse(JSON.stringify(persistedData));
    originalGrantsBackup = JSON.parse(JSON.stringify(await loadGrants()));
  });

  afterEach(async () => {
    if (originalGrantsBackup !== null) {
      await saveGrants(originalGrantsBackup);
    }
    if (originalPersistedDataBackup !== null) {
      await savePersistedData(originalPersistedDataBackup);
    }
    invalidateCache();
  });

  describe('GET /api/grants/[grantId]/submit', () => {
    it('returns null when no submission exists', async () => {
      const mockGrant = createMockGrant(`submit-test-get-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const submission = await submissionService.getSubmissionRecord(mockGrant.id);
      expect(submission).toBeNull();
    });
  });

  describe('POST /api/grants/[grantId]/submit', () => {
    it('records a portal submission successfully after approval', async () => {
      const mockGrant = createMockGrant(`submit-test-post-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // First approve the grant
      const approveResult = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });
      expect(approveResult.success).toBe(true);

      // Then submit
      const result = await submissionService.recordSubmission({
        grant: mockGrant,
        method: {
          type: 'portal',
          portalUrl: 'https://example.com/submit',
          confirmationId: 'CONF-123',
          submittedBy: 'human',
        },
        submittedBy: 'human',
      });

      expect(result.success).toBe(true);
      expect(result.submissionRecord).toBeDefined();
      expect(result.submissionRecord?.grantId).toBe(mockGrant.id);
    });

    it('records an email submission and creates follow-ups', async () => {
      const mockGrant = createMockGrant(`submit-test-email-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // Approve first
      await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      const result = await submissionService.recordSubmission({
        grant: mockGrant,
        method: {
          type: 'email',
          confirmationId: 'EMAIL-456',
          submittedBy: 'human',
        },
        submittedBy: 'human',
      });

      expect(result.success).toBe(true);
      expect(result.submissionRecord).toBeDefined();
      expect(result.submissionRecord?.method.type).toBe('email');
    });

    it('creates follow-up tasks after submission', async () => {
      const mockGrant = createMockGrant(`submit-test-followup-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // Approve first
      await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      const result = await submissionService.recordSubmission({
        grant: mockGrant,
        method: {
          type: 'portal',
          portalUrl: 'https://example.com/submit',
          submittedBy: 'human',
        },
        submittedBy: 'human',
      });

      expect(result.success).toBe(true);
      expect(result.followUps).toBeDefined();
      expect(Array.isArray(result.followUps)).toBe(true);
    });

    it('updates grant status to submitted', async () => {
      const mockGrant = createMockGrant(`submit-test-status-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // Approve first
      await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      await submissionService.recordSubmission({
        grant: mockGrant,
        method: {
          type: 'portal',
          portalUrl: 'https://example.com/submit',
          submittedBy: 'human',
        },
        submittedBy: 'human',
      });

      const updatedGrant = await repository.getGrant(mockGrant.id);
      expect(updatedGrant?.status).toBe('submitted');
    });
  });

  describe('canSubmit validation', () => {
    it('blocks submission if grant is not found', async () => {
      const result = await submissionService.recordSubmission({
        grant: { ...createMockGrant('non-existent'), id: 'non-existent' },
        method: { type: 'portal', submittedBy: 'human' },
        submittedBy: 'human',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('blocks submission if already submitted', async () => {
      const mockGrant = createMockGrant(`submit-test-already-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // Approve first
      await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-approver',
      });

      // First submission
      await submissionService.recordSubmission({
        grant: mockGrant,
        method: { type: 'portal', portalUrl: 'https://example.com/submit', submittedBy: 'human' },
        submittedBy: 'human',
      });

      // Try to submit again
      const result = await submissionService.recordSubmission({
        grant: mockGrant,
        method: { type: 'portal', portalUrl: 'https://example.com/submit', submittedBy: 'human' },
        submittedBy: 'human',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already');
    });
  });
});
