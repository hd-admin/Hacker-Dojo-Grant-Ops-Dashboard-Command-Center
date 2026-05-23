/**
 * Submission Service Tests
 *
 * Tests the submission workflow: approval gating, submission recording,
 * and follow-up generation.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type { Grant, ApprovalRecord } from '../../../../shared/types';
import * as repository from './repository';
import * as submissionService from './submission-service';

const mockGrant: Grant = {
  id: 'test-grant-1',
  title: 'Test Grant',
  funder: 'Test Funder',
  funderShort: 'TG',
  award: '$50,000',
  awardSort: 50000,
  deadline: '2026-12-31',
  daysOut: 200,
  fit: 80,
  tags: ['Community'],
  status: 'review',
  statusLabel: 'Review',
  matchedAt: '2026-05-01',
  checklist: [],
  draftContent: 'Test draft content',
};

describe('SubmissionService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
  });

  describe('canSubmit', () => {
    it('returns false for non-existent grant', async () => {
      const result = await submissionService.canSubmit('non-existent');
      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe('Grant not found');
    });

    it('returns true when a grant has approval and no submission record', async () => {
      tempDataDir = await withTempDataDir();
      const grant: Grant = {
        ...mockGrant,
        id: `approved-${Date.now()}`,
      };
      await repository.addGrant(grant);
      const approval: ApprovalRecord = {
        id: `approval-${Date.now()}`,
        grantId: grant.id,
        draftVersion: 1,
        approvedAt: new Date().toISOString(),
        approvedBy: 'human',
      };
      await repository.addApprovalRecord(approval);

      const result = await submissionService.canSubmit(grant.id);
      expect(result.canSubmit).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns false when a submission already exists', async () => {
      tempDataDir = await withTempDataDir();
      const grant: Grant = {
        ...mockGrant,
        id: `submitted-${Date.now()}`,
      };
      await repository.addGrant(grant);
      await repository.addApprovalRecord({
        id: `approval-${Date.now()}`,
        grantId: grant.id,
        draftVersion: 1,
        approvedAt: new Date().toISOString(),
        approvedBy: 'human',
      });
      await repository.addSubmissionRecord({
        id: `submission-${Date.now()}`,
        grantId: grant.id,
        submittedAt: new Date().toISOString(),
        method: {
          type: 'portal',
          portalUrl: 'https://example.com/submit',
          submittedBy: 'human',
        },
        followUpsCreated: [],
      });

      const result = await submissionService.canSubmit(grant.id);
      expect(result.canSubmit).toBe(false);
      expect(result.reason).toBe('Grant has already been submitted');
    });
  });

  describe('approveGrant', () => {
    it('approves a grant and returns approval record', async () => {
      const result = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'test-user',
      });

      expect(result.success).toBe(true);
      expect(result.approvalRecord).toBeDefined();
      expect(result.approvalRecord?.grantId).toBe(mockGrant.id);
      expect(result.approvalRecord?.approvedBy).toBe('test-user');
    });

    it('creates an approval record with a valid id', async () => {
      const result = await submissionService.approveGrant({
        grant: mockGrant,
        approvedBy: 'human',
      });

      expect(result.approvalRecord?.id).toBeDefined();
      expect(result.approvalRecord?.id.startsWith('approval-')).toBe(true);
    });
  });

  describe('recordSubmission', () => {
    it('returns error when grant is not approved', async () => {
      const result = await submissionService.recordSubmission({
        grant: mockGrant,
        method: {
          type: 'portal',
          portalUrl: 'https://example.com/submit',
          submittedBy: 'test-user',
        },
        submittedBy: 'test-user',
      });

      // Should fail because grant is not approved
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getApprovalRecord', () => {
    it('returns null for unknown grant', async () => {
      const record = await submissionService.getApprovalRecord('unknown-grant');
      expect(record).toBeNull();
    });
  });

  describe('getSubmissionRecord', () => {
    it('returns null for unknown grant', async () => {
      const record = await submissionService.getSubmissionRecord('unknown-grant');
      expect(record).toBeNull();
    });
  });

  describe('getFollowUps', () => {
    it('returns array', async () => {
      const followUps = await submissionService.getFollowUps();
      expect(Array.isArray(followUps)).toBe(true);
    });
  });
});
