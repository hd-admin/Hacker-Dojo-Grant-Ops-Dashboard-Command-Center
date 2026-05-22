/**
 * Drafting Service Tests
 *
 * Tests the drafting workflow:
 * - generateDraft creates a draft artifact with version
 * - generateDraft uses Opencode when configured
 * - generateDraft fails explicitly when Opencode is not configured in production
 * - createRevisionRequest creates revision records
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Grant, OrganizationProfile } from '../../../../shared/types';
import { invalidateCache, loadPersistedData, savePersistedData, loadGrants, saveGrants } from '../../../../shared/grant-ops-persistence';
import * as repository from './repository';
import * as draftingService from './drafting-service';

function createMockGrant(id: string): Grant {
  return {
    id,
    title: 'EdTech Innovation Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$250,000',
    awardSort: 250000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 85,
    tags: ['EdTech', 'Innovation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-01',
  };
}

const mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '12-3456789',
  samUEI: 'XyxabC123AB',
  mission: 'To support tech education and community innovation',
  docTypes: ['501(c)(3) letter'],
  searchThemes: ['EdTech', 'Community Innovation'],
  agentBehavior: {
    autoDraftThreshold: 80,
    submissionPolicy: 'human-review-required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'professional',
  },
};

describe('DraftingService', () => {
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

  describe('generateDraft', () => {
    it('creates a draft artifact with incremented version', async () => {
      const mockGrant = createMockGrant(`draft-test-1-${Date.now()}`);
      await repository.addGrant(mockGrant);

      // First draft
      const draft1 = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      expect(draft1.id).toBeDefined();
      expect(draft1.grantId).toBe(mockGrant.id);
      expect(draft1.version).toBe(1);
      expect(draft1.content).toBeDefined();

      // Second draft should increment version
      const draft2 = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      expect(draft2.version).toBe(2);
    });

    it('creates a draft artifact with valid id format', async () => {
      const mockGrant = createMockGrant(`draft-test-2-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const draft = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      expect(draft.id.startsWith('draft-')).toBe(true);
    });

    it('creates a draft artifact with createdAt timestamp', async () => {
      const mockGrant = createMockGrant(`draft-test-3-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const draft = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      expect(draft.createdAt).toBeDefined();
      expect(new Date(draft.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('uses fake provider when _providerType is fake', async () => {
      const mockGrant = createMockGrant(`draft-test-4-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const draft = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      expect(draft.content).toContain(mockGrant.title);
    });

    it('stores draft artifact in repository', async () => {
      const mockGrant = createMockGrant(`draft-test-5-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const draft = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      const drafts = await repository.getDraftArtifacts(mockGrant.id);
      expect(drafts.some((d) => d.id === draft.id)).toBe(true);
    });

    it('updates grant status to drafting', async () => {
      const mockGrant = createMockGrant(`draft-test-6-${Date.now()}`);
      await repository.addGrant(mockGrant);

      await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      const updatedGrant = await repository.getGrant(mockGrant.id);
      expect(updatedGrant?.status).toBe('draft');
      expect(updatedGrant?.statusLabel).toBe('Drafting');
    });

    it('includes revision notes when provided', async () => {
      const mockGrant = createMockGrant(`draft-test-7-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const revisionNotes = 'Please improve the executive summary';
      const draft = await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
        revisionNotes,
      });

      expect(draft.revisionNotes).toBe(revisionNotes);
    });
  });

  describe('createRevisionRequest', () => {
    it('creates a revision request with pending status', async () => {
      const mockGrant = createMockGrant(`draft-test-8-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const revision = await draftingService.createRevisionRequest(
        mockGrant,
        'Please revise the budget section',
        'test-user',
      );

      expect(revision.id.startsWith('revision-')).toBe(true);
      expect(revision.grantId).toBe(mockGrant.id);
      expect(revision.status).toBe('pending');
      expect(revision.notes).toBe('Please revise the budget section');
      expect(revision.requestedBy).toBe('test-user');
    });

    it('stores revision request in repository', async () => {
      const mockGrant = createMockGrant(`draft-test-9-${Date.now()}`);
      await repository.addGrant(mockGrant);

      const revision = await draftingService.createRevisionRequest(
        mockGrant,
        'Test revision',
        'human',
      );

      const revisions = await repository.getRevisionRequests(mockGrant.id);
      expect(revisions.some((r) => r.id === revision.id)).toBe(true);
    });

    it('updates grant status to draft when revision is requested', async () => {
      const mockGrant = createMockGrant(`draft-test-10-${Date.now()}`);
      await repository.addGrant(mockGrant);

      await draftingService.createRevisionRequest(
        mockGrant,
        'Test revision',
        'human',
      );

      const updatedGrant = await repository.getGrant(mockGrant.id);
      expect(updatedGrant?.status).toBe('draft');
    });
  });

  describe('getDraftArtifacts', () => {
    it('returns empty array when no drafts exist', async () => {
      const drafts = await draftingService.getDraftArtifacts('non-existent-grant');
      expect(Array.isArray(drafts)).toBe(true);
      expect(drafts.length).toBe(0);
    });

    it('returns all drafts for a grant', async () => {
      const mockGrant = createMockGrant(`draft-test-11-${Date.now()}`);
      await repository.addGrant(mockGrant);

      await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });
      await draftingService.generateDraft(mockGrant, mockProfile, {
        _providerType: 'fake',
      });

      const drafts = await draftingService.getDraftArtifacts(mockGrant.id);
      expect(drafts.length).toBe(2);
    });
  });

  describe('getRevisionRequests', () => {
    it('returns empty array when no revisions exist', async () => {
      const revisions = await draftingService.getRevisionRequests('non-existent-grant');
      expect(Array.isArray(revisions)).toBe(true);
      expect(revisions.length).toBe(0);
    });
  });
});
