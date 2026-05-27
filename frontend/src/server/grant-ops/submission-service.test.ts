/**
 * Submission Service Tests
 *
 * Tests the submission workflow: approval gating, submission recording,
 * and follow-up generation.
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type { Grant, ApprovalRecord, OrganizationProfile } from '../../../../shared/types';
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
      await repository.addSubmissionManifest({
        id: `manifest-${Date.now()}`,
        grantId: grant.id,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        materialRefs: [],
      });

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

  describe('notification HTML escaping', () => {
    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
    });

    it('escapes HTML special characters in grant.funder, grant.title, confirmationId, and notifyEmail in email submission notification', async () => {
      const htmlGrant: Grant = {
        ...mockGrant,
        id: `escape-${Date.now()}`,
        title: 'NSF <Technology> Grant & Award',
        funder: 'National & Science Foundation',
        status: 'review',
      };
      await repository.addGrant(htmlGrant);
      const profile: OrganizationProfile = {
        legalName: 'Hacker Dojo',
        ein: '12-3456789',
        samUEI: 'XyxabC123AB',
        mission: 'Test mission',
        docTypes: [],
        searchThemes: [],
        agentBehavior: {
          autoDraftThreshold: 80,
          submissionPolicy: 'human-review-required',
          notifyEmail: 'test<user>@example.com',
          voiceAndTone: 'professional',
        },
      };
      await repository.updateOrgProfile(profile);
      await repository.addSubmissionManifest({
        id: `manifest-${Date.now()}`,
        grantId: htmlGrant.id,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        materialRefs: [],
      });

      await submissionService.approveGrant({ grant: htmlGrant, approvedBy: 'test-user' });
      const result = await submissionService.recordSubmission({
        grant: htmlGrant,
        method: { type: 'email', submittedBy: 'test-user', confirmationId: '<CONF-123>' },
        submittedBy: 'test-user',
      });

      expect(result.success).toBe(true);
      const notifications = await repository.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
      const notif = notifications[0]!;

      // Assert HTML-escaped values are present
      expect(notif.text).toContain('NSF &lt;Technology&gt; Grant &amp; Award');
      expect(notif.text).toContain('National &amp; Science Foundation');
      expect(notif.text).toContain('&lt;CONF-123&gt;');
      expect(notif.text).toContain('test&lt;user&gt;@example.com');

      // Assert raw HTML-hostile values are absent
      expect(notif.text).not.toContain('<Technology>');
      expect(notif.text).not.toContain('National & Science Foundation');
      expect(notif.text).not.toContain('<CONF-123>');
    });
  });
});
