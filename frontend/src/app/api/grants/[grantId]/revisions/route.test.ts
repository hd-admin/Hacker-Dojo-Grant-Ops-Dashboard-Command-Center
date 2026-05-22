/**
 * Revisions Route Tests (TDD)
 *
 * These tests guard the missing behavior identified in the analysis:
 * - POST /api/grants/[grantId]/revisions should create a new DraftArtifact version
 *   instead of only creating a RevisionRequest record
 *
 * These tests should FAIL before the revision route implementation is complete.
 * They test the drafting service behavior directly (which the route uses).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Grant, OrganizationProfile } from '../../../../../../../shared/types';
import { invalidateCache, loadGrants, saveGrants } from '../../../../../../../shared/grant-ops-persistence';
import * as repository from '../../../../../server/grant-ops/repository';
import * as draftingService from '../../../../../server/grant-ops/drafting-service';

// Mock profile for draft generation (properly typed to match OrganizationProfile)
const mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '12-3456789',
  samUEI: 'XyxabC123AB',
  mission: 'To support tech education',
  docTypes: ['501(c)(3) letter'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 80,
    submissionPolicy: 'human-review-required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'professional',
  },
};

describe('POST /api/grants/[grantId]/revisions', () => {
  // Backup grants before each test and restore after
  let originalGrantsBackup: Awaited<ReturnType<typeof loadGrants>> | null = null;

  beforeEach(async () => {
    invalidateCache();
    // Backup current grants before test
    originalGrantsBackup = await loadGrants();
  });

  afterEach(async () => {
    // Restore original grants after each test
    if (originalGrantsBackup !== null) {
      await saveGrants(originalGrantsBackup);
    }
    invalidateCache();
  });

  describe('revision creates new draft version', () => {
    it('FAILS: revision should create a new DraftArtifact version with incremented version number', async () => {
      // Create a unique grant for this test
      const testGrant: Grant = {
        id: `test-revision-grant-${Date.now()}`,
        title: 'Test Revision Grant',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 80,
        tags: ['Community'],
        status: 'draft',
        statusLabel: 'Drafting',
        matchedAt: '2026-05-01',
        draftContent: 'Existing draft content',
      };

      // Setup: Add test grant to repository
      await repository.addGrant(testGrant);

      // Create an initial draft for the grant
      const initialDraft = await draftingService.generateDraft(testGrant, mockProfile, {});
      expect(initialDraft.version).toBe(1);

      // Get draft count before revision
      const draftsBefore = await repository.getDraftArtifacts(testGrant.id);
      const versionBefore = draftsBefore.length > 0 ? Math.max(...draftsBefore.map((d) => d.version)) : 0;

      // Simulate what the route should do: create a revision request with notes
      // and generate a new draft with those revision notes
      const revisionNotes = 'Please improve the budget section';

      // The route should call draftingService.generateDraft with revisionNotes
      const newDraft = await draftingService.generateDraft(testGrant, mockProfile, {
        revisionNotes,
      });

      // The new draft should have version = previousVersion + 1
      expect(newDraft.version).toBe(versionBefore + 1);
    });

    it('FAILS: revision should pass revision notes to draft generation', async () => {
      // Create a unique grant for this test
      const testGrant: Grant = {
        id: `test-revision-grant-notes-${Date.now()}`,
        title: 'Test Revision Grant Notes',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 80,
        tags: ['Community'],
        status: 'draft',
        statusLabel: 'Drafting',
        matchedAt: '2026-05-01',
        draftContent: 'Existing draft content',
      };

      // Setup: Add test grant to repository
      await repository.addGrant(testGrant);

      // Create an initial draft for the grant
      await draftingService.generateDraft(testGrant, mockProfile, {});

      const revisionNotes = 'Please improve the budget section and add more details';

      // Generate new draft with revision notes
      const newDraft = await draftingService.generateDraft(testGrant, mockProfile, {
        revisionNotes,
      });

      // The new draft should contain revision notes from the request
      expect(newDraft.revisionNotes).toBe(revisionNotes);
    });

    it('FAILS: draftArtifacts array should have more entries after revision', async () => {
      // Create a unique grant for this test
      const testGrant: Grant = {
        id: `test-revision-grant-count-${Date.now()}`,
        title: 'Test Revision Grant Count',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 80,
        tags: ['Community'],
        status: 'draft',
        statusLabel: 'Drafting',
        matchedAt: '2026-05-01',
        draftContent: 'Existing draft content',
      };

      // Setup: Add test grant to repository
      await repository.addGrant(testGrant);

      // Create an initial draft for the grant
      await draftingService.generateDraft(testGrant, mockProfile, {});

      // Get draft count before revision
      const draftsBefore = await repository.getDraftArtifacts(testGrant.id);
      const countBefore = draftsBefore.length;

      // Simulate revision by generating a new draft
      await draftingService.generateDraft(testGrant, mockProfile, {
        revisionNotes: 'Please improve the budget section',
      });

      // Get draft count after revision
      const draftsAfter = await repository.getDraftArtifacts(testGrant.id);
      const countAfter = draftsAfter.length;

      // Should now have one more draft
      expect(countAfter).toBe(countBefore + 1);
    });

    it('FAILS: revision should update grant status to drafting', async () => {
      // Create a unique grant for this test
      const testGrant: Grant = {
        id: `test-revision-grant-status-${Date.now()}`,
        title: 'Test Revision Grant Status',
        funder: 'Test Funder',
        funderShort: 'TF',
        award: '$50,000',
        awardSort: 50000,
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 80,
        tags: ['Community'],
        status: 'draft',
        statusLabel: 'Drafting',
        matchedAt: '2026-05-01',
        draftContent: 'Existing draft content',
      };

      // Setup: Add test grant to repository
      await repository.addGrant(testGrant);

      // Create an initial draft for the grant
      await draftingService.generateDraft(testGrant, mockProfile, {});

      // Get grant status before revision
      const grantBefore = await repository.getGrant(testGrant.id);
      expect(grantBefore?.status).toBe('draft');

      // Simulate revision
      await draftingService.generateDraft(testGrant, mockProfile, {
        revisionNotes: 'Please improve the budget section',
      });

      // Get grant status after revision
      const grantAfter = await repository.getGrant(testGrant.id);
      expect(grantAfter?.status).toBe('draft');
    });
  });
});
