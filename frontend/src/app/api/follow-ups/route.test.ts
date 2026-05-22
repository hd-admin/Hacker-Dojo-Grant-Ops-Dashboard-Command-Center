/**
 * Follow-ups API Route Tests
 *
 * Tests the /api/follow-ups endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FollowUp } from '../../../../../shared/types';
import { invalidateCache, loadPersistedData, savePersistedData } from '../../../../../shared/grant-ops-persistence';
import * as submissionService from '../../../server/grant-ops/submission-service';

describe('Follow-ups Route', () => {
  let originalPersistedDataBackup: Awaited<ReturnType<typeof loadPersistedData>> | null = null;

  beforeEach(async () => {
    invalidateCache();
    originalPersistedDataBackup = await loadPersistedData();
  });

  afterEach(async () => {
    if (originalPersistedDataBackup !== null) {
      await savePersistedData(originalPersistedDataBackup);
    }
    invalidateCache();
  });

  describe('GET /api/follow-ups', () => {
    it('returns an array of follow-ups', async () => {
      const followUps = await submissionService.getFollowUps();
      expect(Array.isArray(followUps)).toBe(true);
    });
  });

  describe('POST /api/follow-ups', () => {
    it('creates a follow-up with required fields', async () => {
      const followUp: FollowUp = {
        id: 'followup-test-1',
        grantId: 'test-grant-1',
        type: 'progress_check',
        title: 'Check on application status',
        description: 'Follow up with funder about our application',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const created = await submissionService.createFollowUp(followUp);

      expect(created.id).toBe(followUp.id);
      expect(created.title).toBe(followUp.title);
    });

    it('creates follow-up with grant association', async () => {
      const followUp: FollowUp = {
        id: 'followup-test-2',
        grantId: 'test-grant-associated',
        type: 'report_due',
        title: 'Submit progress report',
        description: 'Report due for awarded grant',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const created = await submissionService.createFollowUp(followUp);

      expect(created.grantId).toBe('test-grant-associated');
    });
  });

  describe('PATCH /api/follow-ups', () => {
    it('updates follow-up status', async () => {
      const followUp: FollowUp = {
        id: 'followup-test-update-1',
        type: 'progress_check',
        title: 'Test update',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await submissionService.createFollowUp(followUp);

      // Update the follow-up
      await submissionService.updateFollowUp({
        ...followUp,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      const allFollowUps = await submissionService.getFollowUps();
      const updated = allFollowUps.find((f) => f.id === followUp.id);

      expect(updated?.status).toBe('completed');
    });

    it('updates follow-up with new due date', async () => {
      const followUp: FollowUp = {
        id: 'followup-test-update-2',
        type: 'next_steps',
        title: 'Review feedback',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await submissionService.createFollowUp(followUp);

      const newDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await submissionService.updateFollowUp({
        ...followUp,
        dueDate: newDueDate,
      });

      const allFollowUps = await submissionService.getFollowUps();
      const updated = allFollowUps.find((f) => f.id === followUp.id);

      expect(updated?.dueDate).toBe(newDueDate);
    });
  });
});
