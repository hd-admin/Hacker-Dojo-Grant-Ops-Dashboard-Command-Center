/**
 * Profile Service Tests
 *
 * Tests organization profile CRUD, missing-field detection,
 * submission-readiness blocking, restricted-document enforcement,
 * and document freshness tracking.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type { OrganizationProfile, DocumentMetadata } from '../../../../shared/types';
import * as repository from './repository';
import * as profileService from './profile-service';

function makeFullProfile(overrides: Partial<OrganizationProfile> = {}): OrganizationProfile {
  return {
    legalName: 'Hacker Dojo',
    ein: '12-3456789',
    samUEI: 'XK7N4HQ2P3M9',
    nonprofitStatus: '501(c)(3)',
    yearFounded: 2009,
    contactInfo: {
      address: '3350 Thomas Road, Santa Clara, CA 95054',
      phone: '408-123-4567',
      email: 'info@hackerdojo.com',
      website: 'https://hackerdojo.com',
    },
    geography: 'Regional',
    mission: 'Expanding access to technology education and community innovation.',
    programAreas: ['STEM Education', 'Workforce Development', 'Community Building'],
    populationsServed: ['Youth', 'Underrepresented Minorities', 'Veterans'],
    fundingHistory: [
      { year: 2024, amount: 50000, source: 'NSF', purpose: 'EdTech Innovation' },
      { year: 2023, amount: 25000, source: 'Google.org', purpose: 'Community STEM Labs' },
    ],
    partnerships: ['Code.org', 'Girls Who Code', 'Local Community College'],
    complianceFacts: ['Registered with SAM.gov', 'UEI verified', 'Annual 990 filed'],
    boardMembers: [{ name: 'Test Board', role: 'Board Member' }],
    docTypes: ['PDF', 'XLS', 'DOC'],
    searchThemes: ['technology education', 'STEM', 'workforce'],
    agentBehavior: {
      autoDraftThreshold: 75,
      submissionPolicy: 'Human approval required',
      notifyEmail: 'grants@hackerdojo.com',
      voiceAndTone: 'Plain-spoken, evidence-led, builder-community framing.',
    },
    ...overrides,
  };
}

describe('ProfileService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    invalidateCache();
  });

  describe('getProfile', () => {
    it('returns the persisted profile', async () => {
      const profile = makeFullProfile();
      await repository.updateOrgProfile(profile);

      const result = await profileService.getProfile();

      expect(result).toBeDefined();
      expect(result?.legalName).toBe('Hacker Dojo');
      expect(result?.nonprofitStatus).toBe('501(c)(3)');
      expect(result?.programAreas).toEqual(['STEM Education', 'Workforce Development', 'Community Building']);
    });

    it('returns default profile when none exists', async () => {
      const result = await profileService.getProfile();

      expect(result).toBeDefined();
      expect(result?.legalName).toBe('Hacker Dojo, a California nonprofit corporation');
      expect(result?.mission).toContain('Hacker Dojo is a collaborative hackerspace');
    });
  });

  describe('updateProfile', () => {
    it('updates and persists profile fields', async () => {
      const profile = makeFullProfile();
      await profileService.updateProfile(profile);

      const result = await repository.getOrgProfile();
      expect(result?.legalName).toBe('Hacker Dojo');
      expect(result?.geography).toBe('Regional');
      expect(result?.fundingHistory).toHaveLength(2);
    });

    it('updates only specified fields without affecting others', async () => {
      const initial = makeFullProfile({
        legalName: 'Initial Org',
        mission: 'Initial mission',
      });
      await profileService.updateProfile(initial);

      await profileService.updateProfile({
        legalName: 'Updated Org',
        mission: initial.mission,
        ein: initial.ein,
        samUEI: initial.samUEI,
        nonprofitStatus: initial.nonprofitStatus,
        yearFounded: initial.yearFounded,
        contactInfo: initial.contactInfo,
        geography: initial.geography,
        programAreas: initial.programAreas,
        populationsServed: initial.populationsServed,
        fundingHistory: initial.fundingHistory,
        partnerships: initial.partnerships,
        complianceFacts: initial.complianceFacts,
        boardMembers: initial.boardMembers,
        docTypes: initial.docTypes,
        searchThemes: initial.searchThemes,
        agentBehavior: initial.agentBehavior,
      });

      const result = await repository.getOrgProfile();
      expect(result?.legalName).toBe('Updated Org');
      expect(result?.mission).toBe('Initial mission');
    });
  });

  describe('getMissingRequiredFields', () => {
    it('returns empty array when all required fields are filled', async () => {
      const profile = makeFullProfile();
      await repository.updateOrgProfile(profile);

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toEqual([]);
    });

    it('returns missing fields when required fields are empty', async () => {
      const profile = makeFullProfile({
        legalName: '',
        ein: '',
        samUEI: '',
        mission: '',
      });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('legalName');
      expect(missing).toContain('ein');
      expect(missing).toContain('samUEI');
      expect(missing).toContain('mission');
    });

    it('detects empty nonprofitStatus', async () => {
      const profile = makeFullProfile({ nonprofitStatus: '' });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('nonprofitStatus');
    });

    it('detects empty geography', async () => {
      const profile = makeFullProfile({ geography: '' });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('geography');
    });

    it('detects empty program areas', async () => {
      const profile = makeFullProfile({ programAreas: [] });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('programAreas');
    });

    it('detects empty populations served', async () => {
      const profile = makeFullProfile({ populationsServed: [] });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('populationsServed');
    });

    it('does not flag optional fields like partnerships', async () => {
      const profile = makeFullProfile({ partnerships: [] });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).not.toContain('partnerships');
    });

    it('does not flag complianceFacts as required', async () => {
      const profile = makeFullProfile({ complianceFacts: [] });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).not.toContain('complianceFacts');
    });

    it('does not flag fundingHistory as required', async () => {
      const profile = makeFullProfile({ fundingHistory: [] });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).not.toContain('fundingHistory');
    });

    it('flags empty agentBehavior.notifyEmail', async () => {
      const profile = makeFullProfile({
        agentBehavior: {
          ...makeFullProfile().agentBehavior,
          notifyEmail: '',
        },
      });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('agentBehavior.notifyEmail');
    });

    it('returns missing contact info sub-fields', async () => {
      const profile = makeFullProfile({
        contactInfo: { address: '', phone: '', email: '' },
      });

      const missing = profileService.getMissingRequiredFields(profile);
      expect(missing).toContain('contactInfo.address');
      expect(missing).toContain('contactInfo.email');
    });
  });

  describe('isSubmissionReady', () => {
    it('returns true when all required fields are filled', async () => {
      const profile = makeFullProfile();
      const result = await profileService.isSubmissionReady(profile);
      expect(result.ready).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.blockingReason).toBeNull();
    });

    it('returns false with blocking reason when fields are missing', async () => {
      const profile = makeFullProfile({
        legalName: '',
        mission: '',
      });

      const result = await profileService.isSubmissionReady(profile);
      expect(result.ready).toBe(false);
      expect(result.missingFields).toContain('legalName');
      expect(result.missingFields).toContain('mission');
      expect(result.blockingReason).toContain('legalName');
      expect(result.blockingReason).toContain('mission');
    });
  });

  describe('enforceRestrictedDocuments', () => {
    it('returns empty array when no documents are restricted', async () => {
      const docs: DocumentMetadata[] = [
        { id: 'doc-1', name: '990.pdf', type: 'PDF', audited: true },
        { id: 'doc-2', name: 'mission.pdf', type: 'PDF', audited: true },
      ];

      const restricted = profileService.enforceRestrictedDocuments(docs);
      expect(restricted).toEqual([]);
    });

    it('flags documents matching restricted patterns', async () => {
      const docs: DocumentMetadata[] = [
        { id: 'doc-1', name: 'tax-return-2024.pdf', type: 'PDF' },
        { id: 'doc-2', name: 'bank-statement-q1.pdf', type: 'PDF' },
        { id: 'doc-3', name: 'mission-statement.pdf', type: 'PDF' },
        { id: 'doc-4', name: 'internal-audit-2024.xlsx', type: 'XLS' },
      ];

      const restricted = profileService.enforceRestrictedDocuments(docs);
      expect(restricted).toHaveLength(3);
      const restrictedIds = restricted.map((d) => d.id);
      expect(restrictedIds).toContain('doc-1');
      expect(restrictedIds).toContain('doc-2');
      expect(restrictedIds).toContain('doc-4');
      // mission statement should NOT be restricted
      expect(restrictedIds).not.toContain('doc-3');
    });
  });

  describe('getDocumentFreshness', () => {
    it('returns clean status for recently updated documents', async () => {
      const now = new Date();
      const docs: DocumentMetadata[] = [
        {
          id: 'doc-1',
          name: '990.pdf',
          type: 'PDF',
          lastUsed: now.toISOString(),
          audited: true,
        },
      ];

      const freshness = profileService.getDocumentFreshness(docs);
      expect(freshness.isStale).toBe(false);
      expect(freshness.staleCount).toBe(0);
    });

    it('flags stale documents older than 90 days', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 120);

      const docs: DocumentMetadata[] = [
        {
          id: 'doc-1',
          name: '990.pdf',
          type: 'PDF',
          lastUsed: staleDate.toISOString(),
          audited: false,
        },
      ];

      const freshness = profileService.getDocumentFreshness(docs);
      expect(freshness.isStale).toBe(true);
      expect(freshness.staleCount).toBe(1);
      expect(freshness.staleDocuments).toHaveLength(1);
      expect(freshness.staleDocuments[0]?.id).toBe('doc-1');
    });

    it('handles documents without lastUsed date', async () => {
      const docs: DocumentMetadata[] = [
        { id: 'doc-1', name: '990.pdf', type: 'PDF' },
      ];

      const freshness = profileService.getDocumentFreshness(docs);
      // Documents without lastUsed are considered stale
      expect(freshness.staleCount).toBe(1);
    });

    it('stale documents are not audited', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 120);

      const docs: DocumentMetadata[] = [
        {
          id: 'doc-1',
          name: '990.pdf',
          type: 'PDF',
          lastUsed: staleDate.toISOString(),
          audited: false,
        },
      ];

      const freshness = profileService.getDocumentFreshness(docs);
      expect(freshness.unauditedCount).toBe(1);
    });
  });
});
