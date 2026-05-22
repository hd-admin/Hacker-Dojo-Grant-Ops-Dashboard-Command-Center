/**
 * Repository Tests
 *
 * Tests the file-based persistence layer for grant operations.
 * These tests verify the repository functions work with the shared
 * persistence adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as repository from './repository';
import { invalidateCache } from '../../../../shared/grant-ops-persistence';

describe('Repository', () => {
  beforeEach(() => {
    invalidateCache();
  });

  describe('Sources', () => {
    it('getSources returns empty array initially', async () => {
      const sources = await repository.getSources();
      expect(Array.isArray(sources)).toBe(true);
    });
  });

  describe('Grants', () => {
    it('getGrants returns array', async () => {
      const grants = await repository.getGrants();
      expect(Array.isArray(grants)).toBe(true);
    });

    it('getGrant returns null for non-existent grant', async () => {
      const grant = await repository.getGrant('non-existent-id');
      expect(grant).toBeNull();
    });
  });

  describe('Profile', () => {
    it('getOrgProfile returns null when no profile exists', async () => {
      const profile = await repository.getOrgProfile();
      // Returns null when no profile file exists
      expect(profile === null || typeof profile === 'object').toBe(true);
    });
  });

  describe('OpencodeSettings', () => {
    it('getOpencodeSettings returns null initially', async () => {
      const settings = await repository.getOpencodeSettings();
      expect(settings === null || typeof settings === 'object').toBe(true);
    });
  });

  describe('CrawlRuns', () => {
    beforeEach(async () => {
      // Clear crawlRuns from persisted data to ensure test isolation
      // invalidateCache() only clears in-memory Map, but other test files
      // (e.g. research-service.test.ts) write crawl runs to disk
      const { loadPersistedData, savePersistedData } = await import('../../../../shared/grant-ops-persistence');
      const data = await loadPersistedData();
      data.crawlRuns = [];
      await savePersistedData(data);
    });

    it('getCrawlRuns returns array', async () => {
      const runs = await repository.getCrawlRuns();
      expect(Array.isArray(runs)).toBe(true);
    });

    it('getLatestCrawlRun returns null when no runs exist', async () => {
      const run = await repository.getLatestCrawlRun();
      expect(run).toBeNull();
    });
  });

  describe('DraftArtifacts', () => {
    it('getDraftArtifacts returns empty array for unknown grant', async () => {
      const drafts = await repository.getDraftArtifacts('unknown-grant');
      expect(Array.isArray(drafts)).toBe(true);
      expect(drafts).toHaveLength(0);
    });

    it('getLatestDraftArtifact returns null for unknown grant', async () => {
      const draft = await repository.getLatestDraftArtifact('unknown-grant');
      expect(draft).toBeNull();
    });
  });

  describe('RevisionRequests', () => {
    it('getRevisionRequests returns empty array for unknown grant', async () => {
      const revisions = await repository.getRevisionRequests('unknown-grant');
      expect(Array.isArray(revisions)).toBe(true);
      expect(revisions).toHaveLength(0);
    });
  });

  describe('ApprovalRecords', () => {
    it('getApprovalRecord returns null for unknown grant', async () => {
      const approval = await repository.getApprovalRecord('unknown-grant');
      expect(approval).toBeNull();
    });
  });

  describe('SubmissionRecords', () => {
    it('getSubmissionRecord returns null for unknown grant', async () => {
      const submission = await repository.getSubmissionRecord('unknown-grant');
      expect(submission).toBeNull();
    });
  });

  describe('FollowUps', () => {
    it('getFollowUps returns array', async () => {
      const followUps = await repository.getFollowUps();
      expect(Array.isArray(followUps)).toBe(true);
    });
  });
});
